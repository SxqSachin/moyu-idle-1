<template>
    <div class="p-4 w-full max-w-lg">
        <el-form :model="form" label-position="top" class="space-y-4">
            <div>
                <div class="text-sm font-medium mb-1">渔具</div>
                <el-select v-model="form.toolConfig.rod" placeholder="选择鱼竿" size="small" class="w-full">
                    <el-option v-for="opt in gearOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
            </div>

            <div>
                <div class="flex flex-row items-center gap-1 text-sm font-medium mb-1">
                    <div class="text-sm font-medium">鱼饵</div>
                    <el-popover width="300">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>

                        <div class="">
                            <div>钓鱼必须使用鱼饵</div>
                            <div>启程后，将会消耗你仓库对应的资源</div>
                            <div>不同的鱼饵，会吸引不同的鱼类</div>
                            <div>鱼饵耗尽后，也可以继续钓鱼</div>
                        </div>
                    </el-popover>
                </div>
                <div class="flex gap-2">
                    <el-select v-model="baitConf.baitId" placeholder="选择鱼饵" size="small" class="flex-1">
                        <template v-for="b in baitOptions" :key="b.value">
                            <el-option :label="`${b.label}`" :value="b.value">
                                <GameCommonSimpleResourceIconAndName :resource-id="b.value"> ({{inventory[b.value]?.count || 0}})
                                </GameCommonSimpleResourceIconAndName>
                            </el-option>
                        </template>
                    </el-select>

                    <el-input-number v-model="baitConf.qty" :min="1" size="small" class="w-24" />
                </div>
            </div>

            <div>
                <div class="flex items-center">
                    <div class="text-sm font-medium mb-1">打窝</div>
                    <el-checkbox v-model="form.baiting"></el-checkbox>

                    <el-popover width="300">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>

                        <div class="">
                            <div>打窝可以吸引更多鱼类前来，提高钓鱼效率</div>
                            <div>打窝需要消耗鱼饵资源</div>
                            <div>不同的打窝鱼饵，持续时间与作用范围不同</div>
                            <div>打窝后，在区域内的所有玩家，都将受益于该打窝效果</div>
                            <div>你始终都可以在地图上看到自己打的窝，但你只有靠近其他玩家打的窝后才可以看到其他玩家打的窝</div>
                        </div>
                    </el-popover>
                </div>

                <div v-if="form.baiting" class="mt-2 space-y-2">
                    <div class="flex gap-2">
                        <el-select v-model="form.baitArea.baitId" placeholder="选择投放资源" size="small" class="flex-1">
                            <template v-for="b in baitOptions" :key="b.value">
                            <el-option :label="`${b.label}`" :value="b.value">
                                <GameCommonSimpleResourceIconAndName :resource-id="b.value"> ({{inventory[b.value]?.count || 0}})
                                </GameCommonSimpleResourceIconAndName>
                            </el-option>
                        </template>
                        </el-select>

                        <el-input-number v-model="form.baitArea.qty" :min="1" size="small" class="w-24" />
                    </div>

                    <div v-if="baitAreaRadius || baitAreaDurationMin" class="text-xs text-gray-500">
                        <div v-if="baitAreaRadius">作用范围：{{ baitAreaRadius }} 米</div>
                        <div v-if="baitAreaDurationMin">打窝有效时间：{{ baitAreaDurationMin }} 分钟</div>
                    </div>

                    <!-- <div> -->
                        <!-- <div class="text-xs text-gray-500">持续时间（秒）</div> -->
                        <!-- <el-input-number v-model="form.baitArea.durationSec" :min="30" size="small" class="w-36" /> -->
                    <!-- </div> -->
                </div>
            </div>

            <!-- <div>
                <div class="text-sm font-medium mb-1">结束条件 (满足任一条件则触发)</div>
                <div class="space-y-2">
                    <div v-for="(c, idx) in form.endConditions" :key="idx" class="flex gap-2 items-center">
                        <el-select v-model="c.type" size="small" class="w-36">
                            <el-option label="按时长(秒)" value="DURATION" />
                            <el-option label="按捕获数量" value="COUNT" />
                        </el-select>
                        <el-input-number v-model="c.value" size="small" :min="1" class="w-32" />
                        <el-button type="danger" size="small" @click="removeCondition(idx)">删除</el-button>
                    </div>
                    <el-button type="primary" size="small" @click="addCondition">添加条件</el-button>
                </div>
            </div>

            <div>
                <div class="text-sm font-medium mb-1">结束后动作</div>
                <el-radio-group v-model="form.endAction">
                    <el-radio label="STOP">结束钓鱼</el-radio>
                    <el-radio label="CONTINUE">结算后继续</el-radio>
                </el-radio-group>
            </div> -->

            <div>
                <div class="text-sm font-medium mb-1 flex flex-row items-center gap-1">
                    <span>
                        谁来钓鱼
                    </span>
                    <el-popover width="300">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>

                        <div class="">
                            <div>自己钓鱼时，自己的行动队列将会被暂停（战斗不受影响）</div>
                            <div>小猫咪钓鱼时，所选择的小猫咪的行动队列将会被暂停</div>
                        </div>
                    </el-popover>

                </div>
                <el-radio-group v-model="form.actorType">
                    <el-radio label="PLAYER">自己</el-radio>
                    <el-radio label="KITTY">小猫咪</el-radio>
                </el-radio-group>
                <div v-if="form.actorType === 'KITTY'" class="mt-2">
                    <el-select v-model="form.actorId" placeholder="选择小猫咪" size="small" class="w-full">
                        <el-option v-for="k in kittyList" :key="k.uuid" :label="k.name" :value="k.uuid" />
                    </el-select>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-3">
                <el-button size="small" @click="$emit('cancel')">取消</el-button>
                <el-button type="primary" size="small" :loading="submitting" @click="onSubmit">开始垂钓</el-button>
            </div>
        </el-form>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKittyInfo } from '~/composables/game/useKittyInfo'
import { useInventory } from '~/composables/game/useInventory'
import { allGameResourceWithInternal } from '~/shared/data/allGameResources'
import { GameResourceCategory, type AllGameResourceID } from '~/shared/types/gameResource'
import { allFishingBaits, type AllFishingBaitId } from '~/shared/data/allFishBaitInfo'

const props = defineProps<{ defaultPondId?: string }>()
const emits = defineEmits<{
    (e: 'submit', payload: any): void
    (e: 'cancel'): void
}>()

const kittyList = useKittyInfo()
const inventory = useInventory()

const gearOptions = [
    { value: 'rod_basic', label: '基础鱼竿' },
    { value: 'rod_pro', label: '专业鱼竿' },
]

// baitOptions derived from all resources of category FishBait
const baitOptions = computed(() => {
    return Object.values(allGameResourceWithInternal)
        .filter(r => r.category?.includes(GameResourceCategory.FishBait))
        .map(r => ({ value: r.id as AllGameResourceID, label: r.name, icon: r.icon }))
        .sort((a, b) => a.label.localeCompare(b.label))
})

const baitConf = ref<{
    baitId: AllFishingBaitId
    qty: number
}>({
    baitId: allFishingBaits.normalFishBait.resourceId,
    qty: 1,
})

const form = ref({
    toolConfig: { rod: gearOptions[0].value, bait: undefined as AllGameResourceID | undefined, baitQty: 1 },
    baitConfig: {} as { [key in AllFishingBaitId]?: number },
    endConditions: [{ type: 'DURATION', value: 300 }],
    endAction: 'STOP',
    actorType: 'PLAYER',
    actorId: undefined as string | undefined,
    baiting: false,
    baitArea: {
        baitId: allFishingBaits.normalFishBait.resourceId,
        qty: 1,
    },
})

const selectedBaitInfo = computed(() => {
    const baitId = form.value.baitArea.baitId
    if (!baitId) return null
    return allFishingBaits[baitId as AllFishingBaitId] || null
})

const baitAreaRadius = computed(() => selectedBaitInfo.value ? selectedBaitInfo.value.baitAreaRadius : undefined)
const baitAreaDurationMin = computed(() => {
    const qty = form.value.baitArea.qty
    if (!selectedBaitInfo.value) return undefined
    return Math.round((selectedBaitInfo.value.baitAreaDurationSec || 0) / 60) * qty
})

// when available bait options change, pick sensible defaults if not set
// watch(baitOptions, (opts) => {
//     if (!form.value.toolConfig.bait && opts.length) {
//         form.value.toolConfig.bait = opts[0].value
//     }
//     if (!form.value.baitArea.baitId && opts.length) {
//         form.value.baitArea.baitId = opts[0].value
//     }
// }, { immediate: true })

const submitting = ref(false)

// function addCondition() {
//     form.value.endConditions.push({ type: 'DURATION', value: 60 })
// }

// function removeCondition(i: number) {
//     form.value.endConditions.splice(i, 1)
// }

async function onSubmit() {
    submitting.value = true
    form.value.baitConfig = {
        [baitConf.value.baitId]: baitConf.value.qty,
    }
    try {
        // emit raw form; parent will merge with coordinates/pondId and call startFishing
        emits('submit', JSON.parse(JSON.stringify(form.value)))
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
/* keep layout controlled by tailwind classes in template */
</style>
