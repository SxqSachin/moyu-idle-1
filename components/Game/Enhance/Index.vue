<template>
    <el-card body-class="p-3! md:p-4! test">
        <h2 class="text-2xl font-bold mb-4">物品强化</h2>


        <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            喵呜~欢迎来到小猫咪的锻造工坊！在这里，你可以为心爱的装备注入新的力量，让它们变得更加闪耀和强大。只要准备好材料和一点点勇气，说不定下一次强化就能让你的冒险之路更加顺利喵！
            <br />
            不过要小心，强化也有失败的可能，记得合理使用保护装备，保护你的宝贝不受损失喵 (=｀ω´=)

            <el-button class="ml-4" size="small" type="primary" plain @click="showHelp = true">查看提示</el-button>

            <div class="gap-2 mt-4">
            
            </div>
            <div class="mt-4 flex justify-end">
                <el-button size="small" @click="showEnhanceList = true" type="primary" plain>
                    查看可强化物品
                </el-button>
            </div>
        </div>

        <el-tabs v-model="activeTabs" class="mb-4">
            <el-tab-pane label="强化" name="enhance" :lazy="true">
                <div class="w-full flex flex-col items-center">
                    <el-card class="w-full md:w-2/3 p-2" body-class="p-3! md:p-4!">
                        <GameEnhanceBase :init-select-resource-id="initSelectResourceId"></GameEnhanceBase>
                    </el-card>
                </div>
            </el-tab-pane>
            <el-tab-pane label="自动强化" name="auto" :lazy="true">
                <div class="w-full flex flex-col items-center">
                    <el-card class="w-full md:w-2/3 p-2" body-class="p-3! md:p-4!">
                        <GameEnhanceAuto :init-select-resource-id="initSelectResourceId"></GameEnhanceAuto>
                    </el-card>
                </div>
            </el-tab-pane>
            <el-tab-pane label="自动强化历史" name="history" :lazy="true">
                <GameEnhanceHistory></GameEnhanceHistory>
            </el-tab-pane>
        </el-tabs>

        <!-- 支持强化物品弹窗 -->
        <el-dialog v-model="showEnhanceList" title="可强化物品一览" :width="isMobile ? '100%' : '700px'" :top="isMobile ? '0' : '8vh'">
            <el-text>点击可查看物品每个强化等级的数据</el-text>
            <div class="flex flex-col p-1 mt-2">
                <template v-for="group in equipmentPartGroupedResources" :key="group.part">
                    <div class="w-full font-bold text-lg mb-1">
                        {{ parseEquimentPartToString(group.part) || '其他' }}
                    </div>
                    <div class="grid gap-8 resource-grid mb-8">
                        <template v-for="itemId in group.resources" :key="itemId">
                            <GameCommonLazyLoadResourceItem :resource-id="itemId"
                                @select="openEnhanceLevelDialog(itemId)">
                                <div class="font-bold text-base mb-1">{{ allGameResource[itemId].name }}</div>
                                <span class="text-sm">可强化：+{{ enhanceableBaseItems.find(item => item.id ==
                                    itemId)!.maxLevel
                                    + 1 }}</span>
                            </GameCommonLazyLoadResourceItem>
                        </template>
                    </div>
                </template>
            </div>
        </el-dialog>
    </el-card>

    <!-- 新增：显示所有强化等级的弹窗 -->
    <el-dialog v-model="showEnhanceLevelDialog"
        :title="selectedEnhanceBaseId ? `『${currentSelectedEnhanceResourceName}』所有强化等级` : ''"  :width="isMobile ? '100%' : '450px'" 
        @close="selectedEnhanceBaseId = null">
        <div v-if="selectedEnhanceBaseId" class="flex flex-col gap-4 max-h-158 overflow-y-auto">
            <el-table :data="getEnhanceLevels(selectedEnhanceBaseId)" stripe size="small" height='400px'>
                <el-table-column label="装备" width="160" fixed="left">
                    <template #default="{ row }">
                        <div class="flex items-center gap-3">
                            <GameCommonResourceIconAndName :resource-id="row.id" />
                        </div>
                    </template>
                </el-table-column>

                <el-table-column label="经验" prop="info.rewardEnhanceExp" width="40">
                    <template #default="{ row }">
                        <span v-if="row.info && row.info.rewardEnhanceExp">{{ row.info.rewardEnhanceExp }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="基础成功率" width="80">
                    <template #default="{ row }">
                        <span v-if="row.info && row.info.enhanceBasePercent">
                            {{ (row.info.enhanceBasePercent * 100).toFixed(2) }}%
                        </span>
                    </template>
                </el-table-column>

                <el-table-column label="所需材料">
                    <template #default="{ row }">
                        <div class="inline-flex items-center flex-wrap gap-2 py-5">
                            <template v-for="req in (row.info?.enhanceRequireResource || [])" :key="req.resourceId">
                            <div class="w-fit!">
                                <GameCommonResourceIconAndName :resource-id="req.resourceId" :count="req.count" />
                            </div>
                            </template>
                        </div>
                    </template>
                </el-table-column>
            </el-table>
        </div>
    </el-dialog>


        <el-dialog v-model="showHelp" title="关于战斗" :width="isMobile ? '100%' : '640px'">
            <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <el-text size="small"> 已装备的物品需要先卸下后才能进行强化 </el-text>
                <br>
                <el-text size="small"> 强化失败时，在没有保护道具的情况下，物品强化等级归零；有保护道具时，强化等级-1。无论强化成功与否，保护装备都会被消耗。 </el-text>
                <br>
                <el-text size="small"> 每次强化物品，不论强化成功与否，都会获得强化经验 </el-text>
                <br>
                <el-text size="small"> 每级强化等级，增加{{ENHANCE_PERCENT_MODIFY_PER_LEVEL * 100 }}%强化成功率 </el-text>
                <br>
                <br>
                <el-text size="small"> 自动强化时，可以选择强化目标物品、强化次数</el-text>
                <br>
                <el-text size="small"> 自动强化开始时，如果在过程中成功强化至目标物品，则此次自动强化将结束（不论是否设置了次数） </el-text>
                <br>
                <el-text size="small"> 如果没有设置强化目标，则将一直进行重复强化 </el-text>
                <br>
                <el-text size="small"> 自动强化将在出现以下情况中的一种后停止：</el-text>
                <br>
                <ul class="ml-2">
                    <li><el-text size="small">- 通过强化得到了强化目标物品（如果设置了目标）</el-text></li>
                    <li><el-text size="small">- 到达重复次数</el-text></li>
                    <li><el-text size="small">- 库存中缺少待强化的物品</el-text></li>
                    <li><el-text size="small">- 库存中缺少强化所需的素材</el-text></li>
                    <li><el-text size="small">- 库存中缺少保护物品（如果选择了保护）</el-text></li>
                </ul>

            </div>
            <template #footer>
                <el-button type="primary" @click="showHelp = false">我知道了</el-button>
            </template>
        </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { GameCommonSimpleResourceIconAndName, GameEnhanceBase } from '#components';
import { ENHANCE_PERCENT_MODIFY_PER_LEVEL, TRADING_EXP_PER_GOLD_IN_MARKET } from '~/shared/data/constant';
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import allGameResourceJson from "@/assets/resource/allGameResource.json"
import { ObjectKeys } from "~/shared/utils"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "~/shared/types/gameResource";
import type { AllGameActionID } from "~/shared/types/gameAction";
import { allCharacterEquipmentPart } from "~/shared/types/characterInfo";
import { allGameResource } from "~/shared/data/allGameResources";
import { parseEquimentPartToString } from "~/shared/utils/game/equipment";

const { isMobile } = useDevice();

const showHelp = ref(false)
const showEnhanceLevelDialog = ref(false)
const selectedEnhanceBaseId = ref<AllGameResourceIDWithInternal | null>(null)
const activeTabs = ref("enhance");

const props = defineProps<{
    initSelectResourceId?: AllGameResourceID; // Replace with actual type if available
}>();

onMounted(() => {
    if (props.initSelectResourceId) {
        selectedEnhanceBaseId.value = props.initSelectResourceId
    }
})

const currentSelectedEnhanceResourceName = computed(() => {
    if (!selectedEnhanceBaseId.value) return ""
    // @ts-ignore
    return allGameResourceJson[selectedEnhanceBaseId.value]?.name || ""
})

function openEnhanceLevelDialog(baseId: string) {
    selectedEnhanceBaseId.value = baseId
    showEnhanceLevelDialog.value = true
}

function getEnhanceLevels(baseId: any) {
    const levels: { id: string, level: number, info: any }[] = []
    // 0级
    levels.push({
        id: baseId,
        level: 0,
        // @ts-ignore
        info: enhanceInfoJson[baseId] || allGameResourceJson[baseId] || {},
    })
    // +N级
    for (let i = 1; i <= 150; i++) {
        const id = `${baseId}+${i}`
        // @ts-ignore
        if (enhanceInfoJson[id] || allGameResourceJson[id]) {
            levels.push({
                id,
                level: i,
                // @ts-ignore
                info: enhanceInfoJson[id] || allGameResourceJson[id] || {}
            })
        }
    }
    return levels
}

// 只显示基础物品（未强化状态），并统计最大可强化等级
const enhanceableBaseItems = computed(() => {
    // 1. 找到所有可强化物品的基础ID（去掉+N后缀）
    const baseIdSet = new Set<string>()
    Object.keys(enhanceInfoJson).forEach(id => {
        const baseId = id.replace(/\+\d+$/, "")
        baseIdSet.add(baseId)
    })

    // 2. 对每个基础ID，统计最大可强化等级
    const result: { id: string, icon: string, name: string, maxLevel: number }[] = []
    baseIdSet.forEach(baseId => {
        let maxLevel = 0
        Object.keys(enhanceInfoJson).forEach(id => {
            if (id.startsWith(baseId + "+")) {
                const match = id.match(/\+(\d+)$/)
                if (match) {
                    const level = parseInt(match[1])
                    if (level > maxLevel) maxLevel = level
                }
            }
        })
        // 如果没有+N，说明只能强化到0级
        // @ts-ignore
        if (maxLevel === 0 && enhanceInfoJson[baseId]) {
            maxLevel = 0
        }
        // 只显示基础物品
        // @ts-ignore
        const baseItem = allGameResourceJson[baseId]
        if (baseItem) {
            result.push({
                id: baseId,
                icon: baseItem.icon,
                name: baseItem.name,
                maxLevel
            })
        }
    })
    return result
})

const equipmentPartGroupedResources = computed(() => {
    const groups: Record<string, AllGameActionID[]> = {}
    for (const {id: resourceId} of enhanceableBaseItems.value) {
        const resource = allGameResource[resourceId];
        const part = resource.equipPart || 'other'
        if (!groups[part]) groups[part] = []
        groups[part].push(resourceId)
    }
    // 返回有序数组
    return allCharacterEquipmentPart
        .filter(part => groups[part] && groups[part].length)
        .map(part => ({
            part,
            resources: groups[part]
        }))
})

const showEnhanceList = ref(false)
</script>

<style lang="scss" scoped>
.resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
}
</style>