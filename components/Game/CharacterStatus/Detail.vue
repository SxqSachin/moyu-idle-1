<template>
    <el-popover placement="top" width="380" trigger="hover" :show-after="180">
        <template #reference>
            <el-card class="status-item flex flex-col" body-class="p-3!" shadow="hover">
                <div class="flex flex-col md:flex-row items-start md:items-center gap-0 md:gap-2 mb-2">
                    <div class="flex items-center gap-0 md:gap-2">
                        <span class="icon text-base md:text-xl">{{ allCharacterStatus[status].icon }}</span>
                        <span class="name font-bold text-base md:text-md">{{ allCharacterStatus[status].name
                            }}</span>
                    </div>
                    <span class="text-sm text-gray-500 ml-0 md:ml-auto">Lv.{{ visLevel }}
                        <template v-if="hasModify">
                            (<span>{{ statusDetail.level }}</span><span :class="modifyClass">{{ modifyText
                                }}</span>)
                        </template>
                    </span>
                </div>
                <div class="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 mb-2">
                    <span class="exp text-xs text-gray-400">当前: {{ statusDetail?.currentExp ?
                        statusDetail?.currentExp.toFixed(2) : 0 }} </span>
                    <span class="text-xs text-gray-400 ml-0 md:ml-auto">
                        升级所需: {{ getLevelExp(statusDetail?.level ?? 1) }} ({{ getExpPercent(statusDetail?.level ??
                        1,
                        statusDetail?.currentExp ?? 0) }}%)
                    </span>
                </div>
                <el-progress :percentage="getExpPercent(statusDetail?.level ?? 1, statusDetail?.currentExp ?? 0)"
                    :stroke-width="6" :show-text="false" class="w-full mb-0!" />
            </el-card>
        </template>

        <div v-if="allCharacterStatus[status].levelDesc || typeof (allCharacterStatus[status].calc) === 'function'">
            <template v-if="allCharacterStatus[status].levelDesc">
                {{ allCharacterStatus[status].levelDesc }}
            </template>

            <div v-if="allCharacterStatus[status].calc">
                <el-divider class="my-4! bg-transparent">当前加成</el-divider>
                <div v-for="(value, key) in (allCharacterStatus[status].calc?.(statusDetail) ?? {})" :key="key">
                    {{ key }}: {{ isNumber(value) ? value.toFixed(2) : value }}
                </div>
            </div>
        </div>

        <div>
            <el-divider class="my-4! bg-transparent">详细信息</el-divider>
            <div class="flex flex-col gap-1">
                <div v-if="statusDetail.level">
                    <span>基础等级:</span> <span>{{ statusDetail.level }}</span>
                </div>
                <div v-if="statusDetail.fromWorkEquipment ">
                    <span>生活装备:</span> <span>{{ statusDetail.fromWorkEquipment }}</span>
                </div>
                <div v-if="statusDetail.fromEquipment">
                    <span>战斗装备:</span> <span>{{ statusDetail.fromEquipment }}</span>
                </div>
                <div v-if="statusDetail.fromSkillTreeNode">
                    <span>专精:</span> <span>{{ statusDetail.fromSkillTreeNode}}</span>
                </div>
                <div v-if="statusDetail.fromAffix">
                    <span>祝福:</span> <span>{{ statusDetail.fromAffix}}</span>
                </div>
                <div v-if="Object.keys(statusDetail?.fromTitle ?? {}).length"
                    class="flex flex-col gap-1">
                    <span>已启用的称号:</span> 
                    <template v-for="(other, k) of statusDetail.fromTitle">
                        <span class="ml-2"> - {{ k }}: {{ other }} </span>
                    </template>
                </div>
                <div v-if="Object.keys(statusDetail?.fromInactiveTitle ?? {}).length"
                    class="flex flex-col gap-1">
                    <span>未启用的称号:</span> 
                    <template v-for="(other, k) of statusDetail.fromInactiveTitle">
                        <span class="ml-2"> - {{ k }}: {{ other }} </span>
                    </template>
                </div>
                <div v-if="statusOtherModifyList && Object.keys(statusOtherModifyList).length"
                    class="flex flex-col gap-1">
                    <span>其他加成:</span>
                    <template v-for="(other, k) of statusOtherModifyList">
                        <span class="ml-2"> - {{ k }}: {{ other }} </span>
                    </template>
                </div>
            </div>

        </div>

    </el-popover>
    <!-- <template v-if="allCharacterStatus[status].levelDesc">
    </template>
    <template v-else>
        <el-card class="status-item flex flex-col" body-class="p-3!" shadow="hover">
            <div class="flex flex-col md:flex-row items-start md:items-center gap-0 md:gap-2 mb-2">
                <div class="flex items-center gap-2">
                    <span class="icon text-base md:text-xl">{{ allCharacterStatus[status].icon }}</span>
                    <span class="name font-bold text-base md:text-md">{{ allCharacterStatus[status].name }}</span>
                </div>
                <span class="text-sm text-gray-500 ml-0 md:ml-auto">Lv.{{ visLevel }}
                    <template v-if="hasModify">
                        (<span>{{ statusDetail.level }}</span><span :class="modifyClass">{{ modifyText
                            }}</span>)
                    </template>
                </span>
            </div>
            <div class="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 mb-2">
                <span class="exp text-xs text-gray-400">当前: {{ statusDetail?.currentExp ?
                    statusDetail?.currentExp.toFixed(2) : 0 }} </span>
                <span class="text-xs text-gray-400 ml-0 md:ml-auto">
                    升级所需: {{ getLevelExp(statusDetail?.level ?? 1) }} ({{ getExpPercent(statusDetail?.level ??
                    1,
                    statusDetail?.currentExp ?? 0) }}%)
                </span>
            </div>
            <el-progress :percentage="getExpPercent(statusDetail?.level ?? 1, statusDetail?.currentExp ?? 0)"
                :stroke-width="6" :show-text="false" class="w-full mb-0!" />
        </el-card>
    </template> -->

</template>

<script setup lang="ts">
import { allCharacterStatus } from "@/shared/data/allCharacterStatus"
import { levelExpTable } from "@/shared/data/levelExpTable"
import { isNumber } from "element-plus/es/utils/types.mjs";
import { allGlobalStatusEffectState } from "~/shared/data/allBattleState";
import type { AllGlobalStatusEffectStateId } from "~/shared/types/BattleState";
import type { AllBaseCharacterStatusType, CharacterStatusDetail } from "~/shared/types/characterInfo"

const props = defineProps<{
    status:AllBaseCharacterStatusType 
    statusDetail: CharacterStatusDetail
}>()

function getLevelExp(level: number) {
    // 下一级所需经验
    if (level >= levelExpTable.length - 1) return "MAX"
    return levelExpTable[level]
}

function getExpPercent(level: number, currentExp: number) {
    if (level >= levelExpTable.length - 1) return 100

    return Math.min(100, Math.max(0, Math.floor((currentExp / levelExpTable[level]) * 100)))
}

const visLevel = computed(() => {
    let res = props?.statusDetail?.final ?? props?.statusDetail?.level ?? 1

    if (res == ~~res) {
        return res
    }

    return res.toFixed(2);
})

const hasModify = computed(() => {
    return !!props.statusDetail.final && props.statusDetail.final != props.statusDetail.level;
})

const modifyClass = computed(() => {
    if (!hasModify || !props.statusDetail) return ""

    const final = props.statusDetail?.final ?? 0

    if (final > props.statusDetail.level) {
        return " text-green-600 ";
    } else if (final < props.statusDetail.level) {
        return " text-red-600 ";
    }
    return "";
});
const modifyText = computed(() => {
    if (!hasModify || !props.statusDetail) return ""

    const final = props.statusDetail?.final ?? 0

    if (final > props.statusDetail.level) {
        return "+" + formatLevel(final - props.statusDetail.level);
    } else if (final < props.statusDetail.level) {
        return "" + formatLevel(final - props.statusDetail.level);
    }
    return "";
});

const statusOtherModifyList = computed(() => {
    let res: Record<string, number> = {}
    for(const k of Object.keys(props.statusDetail?.fromOther ?? {})) {
        const stateId = k as AllGlobalStatusEffectStateId
        const state = allGlobalStatusEffectState[stateId]
        if (state) {
            res[state.name] = (res[state.name] || 0) + (props.statusDetail?.fromOther?.[stateId] || 0)
        } else {
            res['其他'] = (res['其他'] || 0) + (props.statusDetail?.fromOther?.[stateId] || 0)
        }
    }

    return res;
})

const formatLevel = (level: number) => {
    if (level == ~~level) {
        return level
    }

    return +level.toFixed(2)
}
</script>