import { createClient } from "redis";
import { Emitter } from "@socket.io/redis-emitter"

const runtimeConfig = useRuntimeConfig()

const redisClient = createClient({
    url: runtimeConfig.REDIS_URL
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));
await redisClient.connect();

const emitter = new Emitter(redisClient);

export { redisClient, emitter };