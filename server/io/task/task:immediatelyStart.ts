import { DefaultEventsMap, Socket } from "socket.io"
import { emitEventToUser} from "../"
import { GameTask } from "~/shared/types/gameTask"

import { addTaskToQueueInRedis, getTaskQueueInRedis, immediatelyStartTask } from "../../utils/game/taskQueue"
import { GameSocketData } from "~/shared/types/socket"
import { checkTaskRequirement } from "~/server/utils/game/task"
import { getBuildingInfo } from "~/server/utils/game/building"
import { AllGameBuildingID } from "~/shared/types/building"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<GameTask>) {
    const userUuid = data.user.uuid

    await withUniqueLock('userTask:' + userUuid, async () => {
        let checkRequirement = await checkTaskRequirement(userUuid, data.data)

        if (!checkRequirement) {
            emitEventToUser(data.user.uuid, "task:immediatelyStart:failed", {
                message: "不满足执行要求"
            })
            return
        }

        if (data.data.actionId.startsWith("build_")) {
            let buildingId = data.data.actionId.replace("build_", "") as AllGameBuildingID;

            let characterBuildingInfo = await getBuildingInfo(userUuid)
            if (characterBuildingInfo[buildingId]?.status == 'BUILDING' || characterBuildingInfo[buildingId]?.status == 'BUILT') {
                emitEventToUser(data.user.uuid, "task:immediatelyStart:failed", {
                    message: "此建筑正在建造或已建造"
                })
            }
        }

        try {
            await immediatelyStartTask(userUuid, data.data)

            const taskQueue = await getTaskQueueInRedis(userUuid)

            emitEventToUser(data.user.uuid, "task:immediatelyStart:success");
            emitEventToUser(data.user.uuid, "dispatchTaskQueueToClient", taskQueue)
        } catch (e: any) {
            emitEventToUser(data.user.uuid, "task:immediatelyStart:failed", {
                message: e.message
            })
        }
    })
}