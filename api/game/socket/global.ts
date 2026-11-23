import { registerSocketEventListener } from "./socket";

export const onSensitiveCheckError = registerSocketEventListener<{message: string}>("sensitiveCheck:error");