<template>
  <el-card class="w-full">
    <div class="flex items-center space-x-4">
      <div class="text-3xl">🐱</div>
      <div class="flex-1">
        <div class="font-bold mb-2 text-2xl drop-shadow-md">{{ kitty.name }}

          <span class="text-sm mt-4" :class="kitty.isWorking ? 'text-green-500' : 'text-gray-400'">
            ({{ kitty.isWorking ? '正在工作' : '休息中' }})
          </span>

        </div>
        <!-- <div class="text-gray-500 text-xs mb-1">UUID: {{ kitty.uuid }}</div> -->
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-xs text-gray-400 w-14 flex items-center">
            饱食度
            <el-tooltip placement="top">
              <template #content>
                <div class="flex flex-col">
                  <span>饱食度每小时降低 {{ (KITTY_SATIETY_PER_SECOND * 60 * 60).toFixed(0) }} </span>
                  <span>饱食度为0时，猫咪助手将停止工作</span>
                </div>
              </template>
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help"></Icon>
              </el-icon>
            </el-tooltip>
          </span>
          <el-progress :percentage="satietyPercent" :stroke-width="6" status="success" class="w-full flex-1"
            :show-text="false" />
          <span class="text-xs text-gray-500 w-16">{{ +kitty.satiety.toFixed(0) }}/{{ kitty.maxSatiety }}</span>
        </div>
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-xs text-gray-400 w-14 flex items-center">
            心情值
            <el-tooltip placement="top">
              <template #content>
                <div class="flex flex-col">
                  <div>“心情”代表了猫咪助手当前的心理状态</div>

                  <div>“心情”上限可以超过100，上限超过100时，会以每小时2点的速度回落至100。</div>
                  <div>“心情”上限最大不超过200。</div>
                  <div>通过喂食以及特性导致当前“心情”的提升效果，可以超过当前心情上限，超过上限的部分，会以每小时5点的速度回落至上限。</div>

                  <div>“心情”>=180时，会为猫咪助手提供3%的工作效率奖励</div>
                  <div>“心情”>=140时，会为猫咪助手提供3%的工作效率奖励</div>
                  <div>“心情”>=90时，会为猫咪助手提供2%的工作效率奖励</div>

                  <div>“心情”<=10时，会降低猫咪助手50%的工作效率</div>

                  <div>当猫咪助手处于非工作状态时，每小时恢复5点心情值</div>
                  <div>当猫咪助手处于工作状态时，每小时降低1.5点心情值</div>

                  <div>在每天13:00时，如果猫咪助手的当前“心情”超过90，猫咪助会额外提供1点心意点数</div>
                  <div>在每天19:00时，如果猫咪助手的当前“心情”超过130，猫咪助会额外提供1点心意点数</div>
                </div>
              </template>
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help"></Icon>
              </el-icon>
            </el-tooltip>
          </span>
          <el-progress :percentage="moodPercent" :stroke-width="6" status="success" class="w-full flex-1"
            :show-text="false" />
          <span class="text-xs text-gray-500 w-16">{{ +kitty.mood.toFixed(0) }}/{{ kitty.maxMood }}</span>
        </div>

        <div class="mt-4 flex gap-2 flex-wrap">
          <template v-for="row in traitsForThis" :key="row.traitId">
            <KittyTraitName :trait-id="row.traitId" :instance="row" />
          </template>
        </div>

      </div>
    </div>
    <div class="flex justify-end mt-4">
      <el-button class="w-full" type="primary" @click="showFeedDialog = true">
        喂食
      </el-button>
      <el-button class="w-full" @click="showRenameDialog = true">重命名</el-button>
      <el-button v-if="!!traitsForThis?.length" class="w-full" @click="openTraitsModal">特性管理</el-button>
    </div>
  </el-card>

  <GameCatteryTraitsModal :kitty-uuid="props.kitty.uuid" v-model="traitsModalVisible" />

  <!-- 喂食对话框 -->
  <el-dialog v-model="showFeedDialog" title="喂食小猫咪" width="350" align-center>
    <div class="flex items-center mb-4">
      <span class="text-3xl mr-3">🐱</span>
      <span class="font-bold text-lg">{{ kitty.name }}</span>
    </div>
    <div>
      <div class="mb-4">
        <label class="block mb-1 font-medium">选择食物：</label>
        <el-select v-model="selectedFoodId" placeholder="请选择食物" class="w-full" filterable>
          <el-option v-for="food in foodList" :key="food.id" :label="food.name" :value="food.id">
            <GameCommonSimpleResourceIconAndName :resource-id="food.id">({{food.count}})
            </GameCommonSimpleResourceIconAndName>
          </el-option>
        </el-select>
      </div>
      <div v-if="selectedFood" class="mb-4 flex flex-col items-start justify-center gap-2">
        <div class="flex flex-row items-center w-full">
          <span class="whitespace-nowrap">数量：</span>
          <el-input-number class="w-full! flex-1" :controls="false" v-model="feedCount" :min="1" :max="maxFeedCount">
            <template #suffix>
              <span> / {{ selectedFood.count }}</span>
            </template>
          </el-input-number>
        </div>
        <div class="flex flex-row items-center w-full">
          <el-button class="flex-1 w-full" size="small" type="primary" @click="feedCount = +feedCount + 10">+10</el-button>
          <el-button class="flex-1 w-full" size="small" type="primary" @click="feedCount = +feedCount + 50">+50</el-button>
          <el-button class="flex-1 w-full" size="small" type="primary" @click="feedCount = +feedCount + 100">+100</el-button>
        </div>
      </div>
      <div v-if="selectedFood" class="mb-4">
        <div>
          <span>饱食度变化：</span>
          <span class="text-green-600 font-bold">
            {{ kitty.satiety }} → {{ Math.min(kitty.satiety + feedCount * getSatietyRestore(selectedFood.id),
            kitty.maxSatiety) }}
          </span>
          <span class="text-xs text-gray-400 ml-2">(每个+{{ getSatietyRestore(selectedFood.id) }})</span>
        </div>

        <template v-if="hasMoodIncrease(selectedFood.id)">
          <div>
            <span>心情：</span>
            <span class="text-green-600 font-bold">
              {{ kitty.mood}} → {{ Math.min(kitty.mood + feedCount * getMoodRestore(selectedFood.id), KITTY_MAX_MOOD) }}
            </span>
            <span class="text-xs text-gray-400 ml-2">(每个+{{ getMoodRestore(selectedFood.id) }})</span>
          </div>
        </template>

        <!-- 新增：如果食物可提升最大饱食度，显示提示和最大饱食度变化 -->
        <div v-if="hasMaxSatietyIncrease(selectedFood.id) && maxSatietyIncrease > 0" class="mt-2">
          使用该食物可提升猫咪最大饱食度上限！
          <template v-if="maxSatietyIncrease > 0">
            <br />

            最大饱食度：
            <span class="text-green-600 font-bold">
              {{ kitty.maxSatiety }} → {{
              Math.min(kitty.maxSatiety + feedCount * maxSatietyIncrease, KITTY_MAX_SATIETY).toFixed(0)
              }}
            </span>
            <span class="text-xs text-gray-400 ml-2">(每个+{{ maxSatietyIncrease }})</span>
          </template>
        </div>

        <div v-if="hasMaxMoodIncrease(selectedFood.id) && maxMoodIncrease > 0" class="mt-2">
          使用该食物可提升猫咪心情上限！
          <template v-if="maxMoodIncrease > 0">
            <br />

            心情上限：
            <span class="text-green-600 font-bold">
              {{ kitty.maxMood}} → {{
              Math.min(kitty.maxMood + feedCount * maxMoodIncrease, KITTY_MAX_MOOD).toFixed(0)
              }}
            </span>
            <span class="text-xs text-gray-400 ml-2">(每个+{{ maxMoodIncrease}})</span>
            <div class="text-xs text-gray-400 ml-2">心情上限超过100时，会以每小时{{KITTY_MAX_MOOD_DECREASE_PER_HOUR}}点的速度回落至100。
            </div>
          </template>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="showFeedDialog = false">取消</el-button>
      <el-button type="primary" :disabled="!selectedFoodId || feedCount < 1 || feeding" :loading="feeding"
        @click="handleFeed">喂食</el-button>
    </template>
  </el-dialog>


  <el-dialog v-model="showRenameDialog" title="重命名小猫咪" width="350" align-center>
    <el-input v-model="renameInput" maxlength="12" show-word-limit placeholder="请输入新名字" />
    <template #footer>
      <el-button @click="showRenameDialog = false">取消</el-button>
      <el-button type="primary" :disabled="!renameInput.trim() || renaming" :loading="renaming"
        @click="handleRename">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import KittyTraitName from './KittyTraitName.vue'
import useKittyTraits from '~/composables/game/useKittyTraits'
import allKittyTraits from '~/shared/data/kittyTraits'
import { ElMessage } from 'element-plus'
import type { Kitty } from '~/shared/types/kitty'
import { emitFeedKitty, onFeedKittySuccess, onFeedKittyFail, emitGetAllKittyInfo, onRenameKittySuccess, onRenameKittyError, emitRenameKitty } from '~/api/game/socket/kitty'
import { allGameResourceWithInternal } from '~/shared/data/allGameResources'
import { GameResourceCategory, type AllGameResourceID } from '~/shared/types/gameResource'
import { useInventory } from '~/composables/game/useInventory'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'
import { KITTY_MAX_MOOD, KITTY_MAX_MOOD_DECREASE_PER_HOUR, KITTY_MAX_SATIETY, KITTY_SATIETY_PER_SECOND } from '~/shared/data/constant'
import GameCatteryTraitsModal from './TraitsModal.vue'
const props = defineProps<{
  kitty: Kitty
}>()

const traitsModalVisible = ref(false)

function openTraitsModal() {
  traitsModalVisible.value = true
}

const kitTraits = useKittyTraits()
const traitsForThis = computed(() => kitTraits.state.value[props.kitty.uuid] ?? [])
const allTraitsDisplay = allKittyTraits

const feeding = ref(false)
const showFeedDialog = ref(false)
const selectedFoodId = ref<AllGameResourceID>()
const feedCount = ref(1)
const inventory = useInventory()

const showRenameDialog = ref(false)
const renameInput = ref('')
const renaming = ref(false)

watch(showRenameDialog, (val) => {
  if (val) {
    renameInput.value = props.kitty.name
  }
})

let onRenameSuccess: FuncAction
let onRenameFail: FuncAction

// 只展示玩家拥有的食物
const foodList = computed(() =>
  Object.values(allGameResourceWithInternal)
    .filter(r => r.category?.includes(GameResourceCategory.Food))
    .filter(r => (inventory.value[r.id]?.count ?? 0) > 0)
    .map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      count: inventory.value[r.id]?.count || 0
    }))
)

const selectedFood = computed(() =>
  foodList.value.find(f => f.id === selectedFoodId.value) || null
)

watch(selectedFoodId, (val) => {
  if (val && selectedFood.value) {
    feedCount.value = 1
  }
})

const satietyPercent = computed(() => {
  if (!props.kitty.maxSatiety) return 0
  return Math.round((props.kitty.satiety / props.kitty.maxSatiety) * 100)
})

const moodPercent = computed(() => {
  if (!props.kitty.maxMood) return 0
  return Math.round((props.kitty.mood / props.kitty.maxMood) * 100)
})

// 获取食物的饱食度恢复量
function getSatietyRestore(foodId: AllGameResourceID): number {
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 1
  let restore = 0
  for (const action of food.onUse) {
    if (action.resourceEffect) {
      for (const eff of action.resourceEffect) {
        if (eff.resource === "__satiety" && typeof eff.increase === "number") {
          restore += eff.increase 
        }
      }
    }
  }
  return restore
}

function getMoodRestore(foodId: AllGameResourceID): number {
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 0
  let restore = 0
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "mood" && typeof eff.increase === "number") {
          restore += eff.increase 
        }
      }
    }
  }
  return restore
}

let onSuccess: FuncAction;
let onFailed: FuncAction;
onMounted(async () => {
  await waitUtilConnected()
  // fetch traits for this kitty when the card mounts so multiple kitties each load their own traits
  try {
    kitTraits.fetch(props.kitty.uuid)
  } catch (e) {
    // ignore
  }
  onSuccess = onFeedKittySuccess((kitty) => {
    if (kitty.uuid === props.kitty.uuid) {
      feeding.value = false
      ElMessage.success('喂食成功！')

      showFeedDialog.value = false
      selectedFoodId.value = undefined
      feedCount.value = 1

      emitGetAllKittyInfo()
    }
  })

  onFailed = onFeedKittyFail((err) => {
    feeding.value = false
    ElMessage.error(err.message || '喂食失败')
  })

  onRenameSuccess = onRenameKittySuccess((kitty) => {
    if (kitty.uuid === props.kitty.uuid) {
      renaming.value = false
      showRenameDialog.value = false
      ElMessage.success('重命名成功！')
      emitGetAllKittyInfo()
    }
  })
  onRenameFail = onRenameKittyError((err) => {
    renaming.value = false
    ElMessage.error(err.message || '重命名失败')
  })
})

onUnmounted(() => {
  onSuccess?.()
  onFailed?.()

  onRenameSuccess?.()
  onRenameFail?.()
})

function handleFeed() {
  if (!selectedFoodId.value || feedCount.value < 1) return
  feeding.value = true
  emitFeedKitty(props.kitty.uuid, selectedFoodId.value, feedCount.value)
}

function handleRename() {
  if (!renameInput.value.trim()) return
  renaming.value = true
  emitRenameKitty(props.kitty.uuid, renameInput.value.trim())
}

const maxFeedCount = computed(() => {
  return 9999;
  // if (!selectedFood.value) return 1
  // const restore = getSatietyRestore(selectedFood.value.id)
  // if (!restore) return 1
  // const need = props.kitty.maxSatiety - props.kitty.satiety
  // const maxBySatiety = Math.ceil(need / restore)
  // let maxByCount = selectedFood.value.count

  // // 限制最大饱食度上限
  // if (hasMaxSatietyIncrease(selectedFood.value.id)) {
  //   const maxSatietyCanAdd = KITTY_MAX_SATIETY - props.kitty.maxSatiety
  //   if (maxSatietyIncrease.value > 0) {
  //     maxByCount = Math.min(
  //       maxByCount,
  //       Math.floor(maxSatietyCanAdd / maxSatietyIncrease.value)
  //     )
  //   }
  // }
  // return Math.max(1, Math.min(maxByCount, maxBySatiety))
})

function hasMaxSatietyIncrease(foodId: AllGameResourceID): boolean {
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return false
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "maxSatiety" && typeof eff.increase === "number" && eff.increase > 0) {
          return true
        }
      }
    }
  }
  return false
}

function hasMoodIncrease(foodId: AllGameResourceID): boolean {
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return false
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "mood" && typeof eff.increase === "number" && eff.increase > 0) {
          return true
        }
      }
    }
  }
  return false
}

function hasMaxMoodIncrease(foodId: AllGameResourceID): boolean {
  const food = allGameResourceWithInternal[foodId]

  if (!food || !food.onUse) return false
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "maxMood" && typeof eff.increase === "number" && eff.increase > 0) {
          return true
        }
      }
    }
  }
  return false
}

const maxSatietyIncrease = computed(() => {
  const foodId = unref(selectedFoodId)
  if (!foodId) {
    return 0
  }
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 0
  let total = 0
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "maxSatiety" && typeof eff.increase === "number" && eff.increase > 0) {
          total += eff.increase
        }
        if (eff.status === "maxSatiety" && typeof eff.decrease === "number" && eff.decrease > 0) {
          total -= eff.decrease
        }
      }
    }
  }
  return total
})

const maxMoodIncrease = computed(() => {
  const foodId = unref(selectedFoodId)
  if (!foodId) {
    return 0
  }
  const food = allGameResourceWithInternal[foodId]
  if (!food || !food.onUse) return 0
  let total = 0
  for (const action of food.onUse) {
    if (action.kittyStatusEffect) {
      for (const eff of action.kittyStatusEffect) {
        if (eff.status === "maxMood" && typeof eff.increase === "number" && eff.increase > 0) {
          total += eff.increase
        }
        if (eff.status === "maxMood" && typeof eff.decrease === "number" && eff.decrease > 0) {
          total -= eff.decrease
        }
      }
    }
  }
  return total
})

</script>
