import Pako from "pako";
import { io } from "socket.io-client";
import type { FuncAction, } from "~/shared/types";
import type { GameSocketData } from "~/shared/types/socket";

import { WebSocket } from "engine.io-client";
import { useSocketDisconnected } from "~/composables/game/useSocketDisconnected";

const socketDisconnected = useSocketDisconnected()

// Local helper that returns a promise plus its resolve/reject functions.
// Prefer this over augmenting the global Promise in order to avoid global
// mutation and to be explicit about usage.
export function selfWithResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

WebSocket.prototype.createSocket = function (url: string, protocols?: string | string[]) {
    // @ts-ignore
    return new globalThis._WebSocket(url, protocols);
}

export const socket = io({
    transports: [WebSocket],
    withCredentials: true
});

let isConnected: boolean = false
let transport: string = "N/A"

const _onDisconnect = () => {
    socketDisconnected.value = true;

    // setTimeout(() => {
    //     location.reload()
    // }, 
    // Math.floor(Math.random() * (12000 - 5000 + 1)) + 5000)
    console.error("Unhandled client disconnect event");
}

const _onConnected = () => {
    connectResolve()

    isConnected = true;
    transport = socket.io.engine.transport.name;

    // socketDisconnected.value = false;

    socket.io.engine.on("upgrade", (rawTransport) => {
        transport = rawTransport.name;
    });
}

socket.on("disconnect", _onDisconnect)
socket.on("connect", _onConnected)

socket.on("connect_error", (err) => {
  // the reason of the error, for example "xhr poll error"
  console.error(err.message);

  // some additional description, for example the status code of the initial HTTP response
  // @ts-ignore
  console.error(err.description);

  // some additional context, for example the XMLHttpRequest object
  // @ts-ignore
  console.error(err.context);
});

// 离开网页时，中断socket链接
window.addEventListener("beforeunload", () => {
    socket.disconnect();
});


const { promise: connectPromise, reject, resolve: connectResolve } = selfWithResolvers<void>()

export async function waitUtilConnected(): Promise<void> {
    if (socket.connected) {
        return Promise.resolve();
    }

    return connectPromise
}

export async function dispose() {
    socket.off("connect", _onConnected);
    socket.off("disconnect", _onDisconnect);
}

export function emitEventToServer(ev: string, data?: any) {
    const { user } = useUserSession()

    socket.emit(ev, {
        user: user.value,
        data: data ?? null,
    })
}

export const registerSocketEventListener = <T>(
  event: string,
): ((callback: (data: T) => void) => FuncAction) => {
  return (callback: (data: T) => void) => {
    let cb = (data: GameSocketData<T>) => {
      let parsed: any;
      try {
        if (typeof data === "string") {
          parsed = JSON.parse(data);
        } else {
          // binary/compressed path
          // @ts-ignore
          parsed = JSON.parse(Pako.inflate(data, { to: "string" }));
        }
      } catch (e) {
        console.error("[socket] failed to parse socket payload", e);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("moyu-socket-event", {
          detail: {
            event,
            data: parsed,
          },
        }),
      );

      if (Object.hasOwn(parsed, "data")) {
        callback(parsed.data);
      } else {
        callback(parsed);
      }
    };
    socket.on(event, cb);

    return () => socket.off(event, cb);
  };
};

// , callback: (data: T) => void) => 
// (): {
//     let cb = (data: GameSocketData<T>) => {
//         callback(data.data)
//     }
//     socket.on(event, cb)

//     return () => socket.off(event, cb)
// }