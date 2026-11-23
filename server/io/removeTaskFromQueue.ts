import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { getFirstTask, getTaskQueueInRedis, removeTaskByIndex, updateFirstTaskInfo, removeFirstTask } from "../utils/game/taskQueue"
import { returnTaskUsedResource } from "../utils/game/task"
import { scheduleUserImmediate, unscheduleUser } from "../utils/game/schedule"
import { emitEventToUser } from "."

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<number>) {
    const userUuid = data.user.uuid

    await withUniqueLock("removeTaskFromQueue:" + userUuid, async () => {
      if (data.data == 0) {
        const firstTask = await getFirstTask(userUuid);

        if (!firstTask) {
          return;
        }

        await removeFirstTask(userUuid);
        const updatedTaskAboutUser = await getTaskQueueInRedis(userUuid);

        emitEventToUser(userUuid, "needResetCurrentActionProgress");
        emitEventToUser(
          userUuid,
          "dispatchTaskQueueToClient",
          updatedTaskAboutUser
        );

        if (firstTask.hasDeductFirstTaskResource) {
          await returnTaskUsedResource(userUuid, firstTask);
        }

        // 标记删除：立即调度一次（业务层会在下次 runUserTask 中 remove + refund）
        await scheduleUserImmediate(userUuid);

        const queue = await getTaskQueueInRedis(userUuid);
        if (queue.length === 0) {
          await unscheduleUser(userUuid);
        }
      } else {
        await removeTaskByIndex(userUuid, data.data);
        const queue = await getTaskQueueInRedis(userUuid);
        if (queue.length === 0) {
          await unscheduleUser(userUuid);
        }
      }

      const taskQueue = await getTaskQueueInRedis(userUuid);

      emitEventToUser(data.user.uuid, "dispatchTaskQueueToClient", taskQueue);
    });
}