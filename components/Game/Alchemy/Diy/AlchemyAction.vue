<template>
    <el-card body-class="pt-0!">
        <template #header>
            <div class="flex flex-row items-center gap-2">
                <span>
                    炼金台
                </span>
                <el-tooltip placement="top">
                    <template #content>
                        将最多四种材料放入槽位，并选择每种材料所使用的数量后，点击“搅拌均匀”即可开始炼金<br />
                        炼金时会根据放入材料本身，或材料的炼金属性标签尝试匹配配方并进行合成<br />
                        只需要投入的材料正确即可解锁配方，与以下因素均无关:<br />
                        - 材料放的位置<br />
                        - 炼金是否成功<br />
                        - 配方所要求的角色属性是否被满足<br />
                        <br />
                        只要配方正确，你都可以从这次炼金中收获：<br />
                        - 炼金成功时：获得成功产物<br />
                        - 炼金失败时：获得失败产物<br />
                        - 触发突变时：获得突变产物<br />
                        - 对应配方所提供的经验<br />
                        <br />
                        <br />
                        测试期间投入的材料如果无法匹配任何配方，将不会被消耗
                        测试期间不会提供经验
                    </template>
                    <el-icon class="cursor-pointer text-gray-400">
                        <Icon name="material-symbols:help"></Icon>
                    </el-icon>
                </el-tooltip>
            </div>
        </template>
        <el-tabs v-model="activeTab" class="mb-4">
            <el-tab-pane label="调配" name="main">
                <!-- <el-card body-class="" shadow="hover"> -->
                <div class="grid grid-cols-1 md:grid-cols-1 justify-start gap-3 md:gap-4 place-items-start">
                    <template v-for="i of [0, 1, 2, 3]">
                        <GameAlchemyDiySlot @select="p => handleSelect(i, p)" :resource-id="input[i]?.resourceId"
                            :count="input[i]?.count ?? 0" :all-selected-input="input"></GameAlchemyDiySlot>
                    </template>
                </div>
                <!-- </el-card> -->

                <div class="mt-4 flex flex-col gap-4">
                    <div class="flex flex-row flex-wrap items-center gap-4 justify-center">
                        <!-- <el-button type="success" @click="handleAction" :loading="doing">搅拌均匀!</el-button> -->
                        <div class="flex flex-row items-center gap-2">
                            <span class="text-sm text-gray-500">次数</span>
                            <el-input-number v-model="autoTimes" :min="1" :max="maxAutoTimes" />
                            <el-button type="success" plain :disabled="doingAuto || autoTimes <= 0" :loading="doingAuto"
                                @click="handleCreateAutoAlchemy">搅拌均匀</el-button>
                        </div>
                    </div>

                    <!-- 自动炼金当前状态展示 -->
                    <div v-if="currentAuto"
                        class="rounded border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm flex flex-col gap-2">
                        <div class="flex flex-row justify-between">
                            <div class="flex flex-row items-center gap-2">
                                <span class="font-semibold">自动炼金进度</span>
                                <el-tag size="small"
                                    :type="currentAuto.status === 'FINISHED' ? 'success' : (currentAuto.status === 'ERROR' ? 'danger' : 'info')">
                                    {{ autoStatusLabel }}
                                </el-tag>
                            </div>
                            <el-button v-if="currentAuto.status === 'PENDING' || currentAuto.status === 'PROCESSING'"
                                size="small" plain type="danger"
                                @click="() => ElMessageBox.confirm('确认取消当前自动炼金？已完成的进度会保留。', '取消自动炼金', { type: 'warning' }).then(() => cancelAutoAlchemy(currentAuto!.uuid)).catch(() => {})">取消</el-button>
                            <!-- <el-button v-if="currentAuto.status === 'PENDING' || currentAuto.status === 'PROCESSING'"
                                size="small" text type="danger" @click="handleCancelAuto"
                                :disabled="cancelling">取消</el-button> -->
                        </div>
                        <div class="flex flex-row items-center gap-2">
                            <span>进度:</span>
                            <el-progress
                                :percentage="Math.min(100, Math.floor((currentAuto.doneTimes / currentAuto.targetTimes) * 100))"
                                style="width:160px" />
                            <span>{{ currentAuto.doneTimes }} / {{ currentAuto.targetTimes }}</span>
                        </div>
                        <div class="flex flex-row flex-wrap items-center gap-1"
                            v-if="Object.keys(currentAuto.allRewardItems || {}).length">
                            <span>累计获得:</span>
                            <GameCommonResourceIconAndName v-for="(c,id) in currentAuto.allRewardItems" :key="id"
                                :resource-id="id" :count="c?.count || 0" />
                        </div>
                        <div class="flex flex-row flex-wrap items-center gap-1"
                            v-if="Object.keys(currentAuto.allUsedItems || {}).length">
                            <span>累计消耗:</span>
                            <GameCommonResourceIconAndName v-for="(c,id) in currentAuto.allUsedItems" :key="id"
                                :resource-id="id" :count="c?.count || 0" />
                        </div>
                        <div v-if="currentAuto.lastError" class="text-red-500">错误: {{ currentAuto.lastError }}</div>
                    </div>
                </div>

            </el-tab-pane>
            <el-tab-pane label="历史" name="history">
                <AutoAlchemyHistoryList ref="historyRef" :limit="30" />
            </el-tab-pane>
        </el-tabs>

        <div v-if="successInfo" class="text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-2 mt-4">
            <!-- <div>反应完成! </div> -->

            <div>
                <div v-if="successInfo?.successCount > 0">{{ outcomeMessage }}</div>
                <div v-else>{{ outcomeMessage }}</div>
                <div v-if="successInfo?.mutationCount > 0">{{ mutationMessage }}</div>
            </div>

            <div class="flex flex-row flex-wrap items-center">
                <div>配方主产出物：</div>
                <GameCommonResourceIconAndName :resource-id="successInfo.expectMainOutput">
                </GameCommonResourceIconAndName>
            </div>

            <div class="flex flex-row flex-wrap items-center gap-1">
                <div>配方执行次数：</div>
                <div class="text-blue-400 dark:text-blue-500">{{ successInfo.rewardTimes }} </div>
                <div> 次 </div>
            </div>


            <div class="flex flex-row flex-wrap items-center gap-2">
                <div>获得：</div>
                <template v-for="(count, id) in successInfo?.reward">
                    <GameCommonResourceIconAndName v-if="count" :resource-id="id" :count="count.count">
                    </GameCommonResourceIconAndName>
                </template>
            </div>

            <div class="flex flex-row flex-wrap items-center gap-2">
                <div>消耗：</div>
                <template v-for="(count, id) in successInfo?.used">
                    <GameCommonResourceIconAndName v-if="count" :resource-id="id" :count="count.count">
                    </GameCommonResourceIconAndName>
                </template>
            </div>
        </div>
    </el-card>

</template>

<script setup lang="tsx">
import { emitGetUserAlchemyAtlas, emitStartAlchemy, onDoAlchemyFailed, onDoAlchemySuccess, onGetUserAlchemyAtlasFailed, onGetUserAlchemyAtlasSuccess } from '~/api/game/socket/alchemy';
import AutoAlchemyHistoryList from '@/components/Game/Alchemy/Auto/AutoAlchemyHistoryList.vue'
import { waitUtilConnected } from '~/api/game/socket/socket';
import { useInventory } from '~/composables/game/useInventory';
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import type { FuncAction } from '~/shared/types';
import { type AlchemyAtlasEntry, type UserAlchemyAtlas } from '~/shared/types/gameAlchemy';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import type { AllGameResourceID } from '~/shared/types/gameResource';
import { clone, randomElementInCollection } from '~/shared/utils';
import { useAutoAlchemy } from '~/composables/game/useAutoAlchemy'

const input = ref<
{
    resourceId: AllGameResourceID
    count: number
}[]
>([])

const { currentAuto, doingAuto, autoTimes, maxAutoTimes, autoStatusLabel, createAutoAlchemy, refreshCurrent, cancelAutoAlchemy } = useAutoAlchemy()
const activeTab = ref('main')

// 历史记录组件引用
const historyRef = ref<{ refresh: () => void } | null>(null)

// 状态标签由 composable 提供

const inventory = useInventory()

const emits = defineEmits<{
    (e: 'done', payload: { expectMainOutput: AllGameResourceID, recipeIndex: number }): void
}>()

// let off3: FuncAction
// let off4: FuncAction
// 自动炼金事件交由 composable 处理

const successInfo = ref<{
    successCount: number
    mutationCount: number
    used: ItemCountInfo
    reward: ItemCountInfo
    expectMainOutput: AllGameResourceID,
    recipeIndex: number
    rewardTimes: number
}>()

const handleSelect = (i: number, {id, count}: { id: AllGameResourceID | null, count: number }) => {
    if (!id) {
        delete input.value[i]
        return;
    }

    input.value[i] = { resourceId: id, count: count }
}

// 组装当前输入为 ItemCountInfo
const buildInputInfo = (): ItemCountInfo => {
    let res: ItemCountInfo = {}
    for(const item of input.value) {
        if (!item) continue;
        if (!item.resourceId || !item.count) continue;
        res[item.resourceId] = {count: item.count}
    }
    return res
}

const handleCreateAutoAlchemy = () => {
    const res = buildInputInfo()
    if (!Object.keys(res).length) {
        ElNotification({ title: '请选择至少一种素材', type: 'warning' })
        return
    }
    if (!autoTimes.value || autoTimes.value <= 0) {
        ElNotification({ title: '请输入有效的次数', type: 'warning' })
        return
    }
    createAutoAlchemy(res, autoTimes.value)
}

// 父级不再直接管理历史数据，相关逻辑下沉到子组件

// 取消（占位，后端尚未实现取消事件，仅前端 UI 钩子）
// const handleCancelAuto = () => {
//     ElNotification({ title: '取消暂未实现', message: '后端未提供取消接口', type: 'info' })
// }

onMounted(async () => {
    await waitUtilConnected()

    // off3 = onDoAlchemySuccess(data => {
    //     successInfo.value = {
    //         used: data.usedItems,
    //         reward: data.rewardItems,
    //         successCount: data.successCount,
    //         mutationCount: data.mutationCount,
    //         expectMainOutput: data.expectMainOutput,
    //         recipeIndex: data.recipeIndex,
    //         rewardTimes: data.rewardTimes
    //     }

    //     // 根据结果随机挑选一句更有温度的文案
    //     outcomeMessage.value = successInfo.value.successCount > 0 ? randomElementInCollection(successPhrases)! : randomElementInCollection(failPhrases)!
    //     mutationMessage.value = successInfo.value.mutationCount > 0 ?randomElementInCollection(mutationPhrases)! : ""

    //     emits('done', {
    //         expectMainOutput: data.expectMainOutput,
    //         recipeIndex: data.recipeIndex
    //     })

    //     doing.value = false;
    // })

    // off4 = onDoAlchemyFailed(data => {
    //     ElNotification({
    //         title: '炼金失败',
    //         message: data.message,
    //         type: 'error'
    //     })

    //     doing.value = false;
    // })

    // 初始获取当前自动炼金状态
    refreshCurrent()
    // 子组件内部会自动 refresh；这里如果需要可延迟调用 historyRef.value?.refresh()

    eventBus.on('use-alchemy-recipe', applyRecipe)
})

const applyRecipe = (payload: { recipe: AlchemyAtlasEntry }) => {
    // 将配方 inputs 映射为具体素材，优先使用背包中具体 id（非标签）完全匹配的项，
    // 标签形如 "(tag)" 或 "(tag1,tag2)" 使用 AND 逻辑，可从多个物品累积满足数量。
    // 结果写回到 input.value（最多保持 4 个槽，超出的合并为多个槽）。
    //
    // 行为要点：
    // - 对于具体 id：使用该 id 在背包中可用数量（若不足则使用可用数量）。
    // - 对于标签要求：查找背包中同时包含所有标签的物品，按 id 顺序依次取出直至满足数量或耗尽。
    // - 如果没有任何匹配，保留原 input 并弹出提示。
    // - 最终把匹配到的素材填入 input.value（覆盖之前选择）。
    try {
        const recipe = payload?.recipe;
        if (!recipe) return;

        const reqInputs: ItemCountInfo = (recipe.inputs as ItemCountInfo) || {};
        const reqKeys = Object.keys(reqInputs);
        if (!reqKeys.length) {
            ElNotification({
                title: '配方为空',
                message: '此配方不需要任何材料',
                type: 'info'
            });
            return;
        }

        // 读取 inventory（兼容不同 useInventory 实现）
        const invAny: any = (inventory as any);
        const inv: Record<string, { count: number }> =
            invAny.value ?? invAny.inventory ?? invAny.get?.() ?? invAny;

        // 解析 "(a,b)" -> ['a','b']
        const parseTagList = (raw: string) =>
            raw.split(',').map(s => s.trim()).filter(Boolean);

        // 查找背包中满足所有 tag 的 id 列表（按 id 排序以保证确定性）
        const findIdsMatchingTags = (tags: string[]) => {
            return Object.keys(inv)
                .filter(id => {
                    const res = (allGameResourceWithInternal as any)[id];
                    const atags: string[] = res?.alchemyTag ?? [];
                    return tags.every(t => atags && atags.includes(t)) && (inv[id]?.count ?? 0) > 0;
                })
                .sort();
        };

        const selected: { resourceId: string; count: number }[] = [];

        // 尝试优先使用具体 id（非标签）完全满足的配方项：
        // 如果某个 reqKey 是具体 id，直接取该 id。
        for (const rk of reqKeys) {
            const required = reqInputs[rk]?.count ?? 0;
            if (required <= 0) continue;

            if (rk.startsWith('(') && rk.endsWith(')')) {
                // 标签项，稍后按标签分配
                continue;
            } else {
                // 具体 id
                const avail = inv[rk]?.count ?? 0;
                const take = Math.min(avail, required);
                if (take > 0) {
                    selected.push({ resourceId: rk, count: take });
                } else {
                    // 未找到足量具体 id，也允许后续标签补充（不弹错）
                }
            }
        }

        // 再处理标签需求（可能需要从多个物品累积）
        for (const rk of reqKeys) {
            const required = reqInputs[rk]?.count ?? 0;
            if (required <= 0) continue;
            if (!(rk.startsWith('(') && rk.endsWith(')'))) continue;

            const tags = parseTagList(rk.slice(1, -1));
            let need = required;

            const matchingIds = findIdsMatchingTags(tags).filter(id => id != recipe.mainOutputResourceId || id == 'gold');
            for (const id of matchingIds) {
                if (need <= 0) break;
                const avail = inv[id]?.count ?? 0;
                if (!avail) continue;
                // 在 selected 中查找已选该 id 的项（可能之前作为具体 id 被选过）
                const exist = selected.find(s => s.resourceId === id);
                const alreadyTaken = exist ? exist.count : 0;
                const canTake = Math.max(0, avail - alreadyTaken);
                if (canTake <= 0) continue;
                const take = Math.min(canTake, need);
                if (exist) exist.count += take;
                else selected.push({ resourceId: id, count: take });
                need -= take;
            }
            // 即便未完全满足，也把已分配的部分保留（玩家可以手动调整或系统提示）
        }

        // 若 selected 为空，提示用户没有可用材料
        if (!selected.length) {
            ElNotification({
                title: '没有匹配的材料',
                message: '你的背包里没有符合此配方要求的材料喵～',
                type: 'warning'
            });
            return;
        }

        // 将 selected 映射到 input.value（覆盖），保持最大 4 槽（超出的合并为额外槽）
        const maxSlots = 4;
        const newInputs: typeof input.value = [];
        for (let i = 0; i < Math.min(selected.length, maxSlots); i++) {
            newInputs[i] = {
                resourceId: selected[i].resourceId as AllGameResourceID,
                count: selected[i].count
            };
        }
        // 如果有超过槽数的材料，把剩余合并为后一个槽（累加数量到最后槽）
        if (selected.length > maxSlots) {
            const extra = selected.slice(maxSlots);
            const lastIdx = maxSlots - 1;
            const last = newInputs[lastIdx] ?? { resourceId: extra[0].resourceId as AllGameResourceID, count: 0 };
            for (const ex of extra) {
                if (last.resourceId !== ex.resourceId) {
                    // 不同 id 的情况下无法放入同一槽，简单选择把数量累加到最后槽（以第一个 id 为准）
                    // 前端可在用户点击时展开细节让玩家手动调整
                    last.count += ex.count;
                } else {
                    last.count += ex.count;
                }
            }
            newInputs[lastIdx] = last;
        }

        // 填充到 input.value（清除原有）
        input.value.length = 0;
        for (let i = 0; i < maxSlots; i++) {
            if (newInputs[i]) input.value[i] = newInputs[i];
            else delete input.value[i];
        }

        input.value = [];//clone(input.value)
        nextTick(() => {
            input.value = newInputs
        })
    } catch (err) {
        console.error('applyRecipe error', err);
        ElNotification({
            title: '应用配方失败',
            // message: '发生异常，请查看控制台',
            type: 'error'
        });
    }
}

const outcomeMessage = ref<string>("")
const mutationMessage = ref<string>("")

onUnmounted(() => {
    // off3?.()
    // off4?.()
    // 自动炼金事件由 composable 负责解绑

    eventBus.off('use-alchemy-recipe', applyRecipe)
})

</script>