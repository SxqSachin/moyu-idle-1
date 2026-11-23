import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { beginExpeditionTeam, createKittyExpeditionTeam, deleteKittyExpeditionTeam, getAllKittyExpeditionTeams, getKittyExpeditionTeam, getKittyExpeditionTeamByKittyUuid, getKittyExpeditionTeamHistoryByKittyUuid, joinKittyExpeditionTeam, leaveKittyExpeditionTeam, returnExpeditionTeam } from "~/server/utils/game/kittyExpedition";
import { getAllKittyByOwner, getKitty } from "~/server/utils/game/kitty";
import { KittyExpeditionTeamInGame, } from "~/shared/types/kittyExpedition";

const refreshUserKittyExpeditionTeams = async (userUuid: string) => {
    const kitties = await getAllKittyByOwner(userUuid);
    let res: { [kittyUuid: string]: KittyExpeditionTeamInGame | null } = {}

    let uuidSet: string[] = [];

    for (const kitty of kitties) {
        const info = await getKittyExpeditionTeamByKittyUuid(kitty.uuid);

        if (!info) {
            continue;
        }

        if (uuidSet.includes(info.uuid)) {
            continue;
        }

        uuidSet.push(info.uuid);

        res[kitty.uuid] = info
    }


    emitEventToUser(userUuid, "kitty:getAll:success", kitties)
    emitEventToUser(userUuid, "kittyExpedition:my:success", { data: res });
}

// 获取用户所有探险队
export async function handleGetAllExpeditionTeams(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    try {
        const teams = await getAllKittyExpeditionTeams();
        // 只返回属于该用户的队伍
        emitEventToUser(userUuid, "kittyExpedition:list:success", { teams: teams });
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:list:fail", { message: e.message || "获取失败" });
    }
}

export async function handleGetAllExpeditionFinishHistoryAboutUser(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    try {
        const kitties = await getAllKittyByOwner(userUuid);
        let res: KittyExpeditionTeamInGame[] = []

        let uuidSet: string[] = [];

        for (const kitty of kitties) {
            const infoList = await getKittyExpeditionTeamHistoryByKittyUuid(kitty.uuid);

            if (!infoList?.length) {
                continue;
            }

            for(const info of infoList) {
                if (uuidSet.includes(info.uuid)) {
                    continue;
                }
                uuidSet.push(info.uuid);
                res.push(info);
            }
        }
        emitEventToUser(userUuid, "kittyExpedition:myHistory:success", { data: res });
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:myHistory:fail", { message: e.message || "获取失败" });
    }
}

export async function handleGetAllExpeditionInfoAboutUser(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    try {
        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:my:fail", { message: e?.message || "获取失败" });
    }
}

// 创建探险队
export async function handleCreateExpeditionTeam(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ kittyUuids: string[], name: string, expeditionAreaId: string }>
) {
    const userUuid = data.user.uuid;
    const { kittyUuids, name, expeditionAreaId } = data.data;

    try {
        const team = await createKittyExpeditionTeam(kittyUuids, userUuid, name, expeditionAreaId, { });
        emitEventToUser(userUuid, "kittyExpedition:create:success", { team });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:create:fail", { message: e?.message || "创建失败" });
    }
}

export async function handleJoinExpeditionTeam(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ teamUuid: string, kittyUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { teamUuid, kittyUuid } = data.data;

    let kitty = await getKitty(kittyUuid)

    if (kitty?.owner != userUuid) {
        emitEventToUser(userUuid, "kittyExpedition:join:fail", { message: "你不是这只猫咪的主人，无法加入探险队" });
        return;
    }

    try {
        const team = await joinKittyExpeditionTeam(teamUuid, kittyUuid);
        emitEventToUser(userUuid, "kittyExpedition:join:success", { team });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:join:fail", { message: e.message || "加入失败" });
    }
}

export async function handleLeaveExpeditionTeam(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ teamUuid: string, kittyUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { teamUuid, kittyUuid } = data.data;

    let kitty = await getKitty(kittyUuid)

    if (kitty?.owner != userUuid) {
        emitEventToUser(userUuid, "kittyExpedition:leave:fail", { message: "你不是这只猫咪的主人，无法离开探险队" });
        return;
    }

    try {
        const team = await leaveKittyExpeditionTeam(teamUuid, kittyUuid);

        emitEventToUser(userUuid, "kittyExpedition:leave:success", { team });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:leave:fail", { message: e.message || "离开失败" });
    }
}

// 删除探险队
export async function handleDeleteExpeditionTeam(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ teamUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { teamUuid } = data.data;

    let team = await getKittyExpeditionTeam(teamUuid);

    if (team?.owner != userUuid) {
        emitEventToUser(userUuid, "kittyExpedition:delete:fail", { message: "你不是该探险队的主人，无法删除" });
        return;
    }

    try {
        await deleteKittyExpeditionTeam(teamUuid);
        emitEventToUser(userUuid, "kittyExpedition:delete:success", { teamUuid });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:delete:fail", { teamUuid, message: e.message || "删除失败" });
    }
}

// 开始探险
export async function handleBeginExpedition(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ teamUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { teamUuid } = data.data;

    let team = await getKittyExpeditionTeam(teamUuid);
    if (team?.owner != userUuid) {
        emitEventToUser(userUuid, "kittyExpedition:begin:fail", { teamUuid, message: "你不是该探险队的主人，无法开始探险" });
        return;
    }

    try {
        const team = await beginExpeditionTeam(teamUuid);
        emitEventToUser(userUuid, "kittyExpedition:begin:success", { team });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:begin:fail", { teamUuid, message: e.message || "开始探险失败" });
    }
}

export async function handleReturnExpedition(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ teamUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { teamUuid } = data.data;

    let team = await getKittyExpeditionTeam(teamUuid);
    if (team?.owner != userUuid) {
        emitEventToUser(userUuid, "kittyExpedition:return:fail", { teamUuid, message: "你不是该探险队的主人，无法结束探险" });
        return;
    }

    try {
        await returnExpeditionTeam(teamUuid);
        emitEventToUser(userUuid, "kittyExpedition:return:success", { team });

        await refreshUserKittyExpeditionTeams(userUuid);
    } catch (e: any) {
        emitEventToUser(userUuid, "kittyExpedition:return:fail", { teamUuid, message: e.message || "结束探险失败" });
    }
}