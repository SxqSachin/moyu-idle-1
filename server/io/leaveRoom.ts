import { DefaultEventsMap, Socket } from "socket.io"

export default function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: any) {
    socket.leave("room-" + data.user.uuid)
}