import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as kittyFurnitureService from "~/server/utils/game/kittyFurniture";
import { type AllKittyFurnitureID } from "~/shared/data/allKittyFurniture";
import { AllGameResourceID } from "~/shared/types/gameResource";

// 获取用户所有家具
export async function handleGetUserFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    
    try {
        const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
        emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:list:fail", { message: e.message || "获取失败" });
    }
}

// 安装家具
export async function handleInstallFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        const furnitureUuid = await kittyFurnitureService.installFurniture(userUuid, furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:install:success", { 
            furnitureId, 
            furnitureUuid 
        });
        
        // 发送更新后的家具列表
        const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
        emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:install:fail", { 
            furnitureId,
            message: e.message || "安装失败" 
        });
    }
}

// 修理家具
export async function handleRepairFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        const repairCost = await kittyFurnitureService.repairFurniture(userUuid, furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:repair:success", { 
            furnitureId,
            repairCost 
        });
        
        // 发送更新后的家具列表
        const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
        emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:repair:fail", { 
            furnitureId,
            message: e.message || "修理失败" 
        });
    }
}

// 启用/停用家具
export async function handleToggleFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID; active: boolean }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId, active } = data.data;

    try {
        await kittyFurnitureService.toggleFurniture(userUuid, furnitureId, active);
        emitEventToUser(userUuid, "kitty:furniture:toggle:success", { 
            furnitureId,
            active 
        });
        
        // 发送更新后的家具列表
        const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
        emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:toggle:fail", { 
            furnitureId,
            active,
            message: e.message || "操作失败" 
        });
    }
}

// 检查是否可以安装家具
export async function handleCheckCanInstallFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        const canInstall = await kittyFurnitureService.canInstallFurniture(userUuid, furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:canInstall", { 
            furnitureId,
            canInstall 
        });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:canInstall", { 
            furnitureId,
            canInstall: false,
            message: e.message || "检查失败" 
        });
    }
}

// 检查是否可以修理家具
export async function handleCheckCanRepairFurniture(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        const canRepair = await kittyFurnitureService.canRepairFurniture(userUuid, furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:canRepair", { 
            furnitureId,
            canRepair 
        });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:canRepair", { 
            furnitureId,
            canRepair: false,
            message: e.message || "检查失败" 
        });
    }
}

// 获取指定类型的家具
export async function handleGetFurnitureByType(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        const furniture = await kittyFurnitureService.getUserFurnitureByType(userUuid, furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:byType", { 
            furnitureId,
            furniture 
        });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:byType:fail", { 
            furnitureId,
            message: e.message || "获取失败" 
        });
    }
}

// 获取所有激活的指定类型家具（管理员功能）
export async function handleGetActiveFurnitureByType(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ furnitureId: AllKittyFurnitureID }>
) {
    const userUuid = data.user.uuid;
    const { furnitureId } = data.data;

    try {
        // 这里可以添加管理员权限检查
        const activeFurniture = await kittyFurnitureService.getActiveFurnitureByType(furnitureId);
        emitEventToUser(userUuid, "kitty:furniture:active:byType", { 
            furnitureId,
            activeFurniture 
        });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:active:byType:fail", { 
            furnitureId,
            message: e.message || "获取失败" 
        });
    }
}

// 减少家具耐久度（管理员功能）
export async function handleDecreaseFurnitureDurability(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ 
        userUuid?: string; 
        furnitureId?: AllKittyFurnitureID; 
        amount?: number 
    }>
) {
    // const adminUuid = data.user.uuid;
    // const { userUuid, furnitureId, amount } = data.data;

    // try {
    //     // 这里可以添加管理员权限检查
    //     await kittyFurnitureService.decreaseFurnitureDurability(userUuid, furnitureId, amount);
    //     emitEventToUser(adminUuid, "kitty:furniture:durability:decrease:success", { 
    //         userUuid,
    //         furnitureId,
    //         amount 
    //     });
        
    //     // 如果指定了用户，通知该用户家具状态变化
    //     if (userUuid) {
    //         const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
    //         emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    //     }
    // } catch (e: any) {
    //     emitEventToUser(adminUuid, "kitty:furniture:durability:decrease:fail", { 
    //         userUuid,
    //         furnitureId,
    //         amount,
    //         message: e.message || "操作失败" 
    //     });
    // }
}

// 配置家具
export async function handleConfigureFurniture_AutoFeeder(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ foodId: AllGameResourceID, count: number }>
) {
    const userUuid = data.user.uuid;
    const { foodId, count } = data.data;

    if (!foodId || count <= 0) {
        emitEventToUser(userUuid, "kitty:furniture:configure:fail", { 
            id: 'autoFeeder',
            message: "参数错误"
        });
        return;
    }

    try {
        await kittyFurnitureService.updateFurnitureConfig(userUuid, 'autoFeeder', {foodId, count});
        emitEventToUser(userUuid, "kitty:furniture:configure:success", { 
            name: 'autoFeeder',
            foodId
        });
        
        // 发送更新后的家具列表
        const furniture = await kittyFurnitureService.getUserAllFurniture(userUuid);
        emitEventToUser(userUuid, "kitty:furniture:list", { furniture });
    } catch (e: any) {
        emitEventToUser(userUuid, "kitty:furniture:configure:fail", { 
            id: 'autoFeeder',
            message: e.message || "配置失败" 
        });
    }
}