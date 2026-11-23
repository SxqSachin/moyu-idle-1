<template>
  <div>
    <!-- 池塘选择 -->
    <div class="mb-3 flex items-center gap-3">
      <el-button size="small" type="success" @click="showTutorialDialog = true">查看垂钓提示</el-button>

      <el-select v-model="selectedPondId" placeholder="选择钓场" size="small" style="width:220px"
        :disabled="hasActiveSession">
        <el-option v-for="(p, key) in pondList" :key="key" :label="p.name" :value="key" />
      </el-select>
      <div class="text-sm text-gray-500">当前钓场: {{ pondList[selectedPondId]?.name || '无' }}</div>
      <div v-if="hasActiveSession" class="text-sm text-green-600">你当前正在垂钓，无法新建钓点</div>
      <el-button v-if="hasActiveSession" size="small" type="warning" @click="endFishing" class="ml-3">结束垂钓</el-button>
    </div>

    <!-- 临时喊话输入，位于地图下方 -->
    <div class="my-3 flex items-center gap-2" v-if="hasActiveSession">
      <input v-model="shoutInput" @keyup.enter.prevent="sendShout" :disabled="isShoutingLocal || !hasActiveSession"
        placeholder="向附近玩家喊话...（10秒内不可重复）"
        class="p-1 rounded border border-gray-200 dark:border-gray-600 w-96 text-sm" />
      <el-button size="small" type="primary" @click="sendShout"
        :disabled="isShoutingLocal || !hasActiveSession">发送</el-button>
    </div>

    <!-- 使用已有的地图组件（Game/Fishing/Map.vue） -->
    <GameFishingMap ref="mapRef" @fishing-start="onFishingStart" :groundWidth="pondList[selectedPondId]?.groundWidth"
      :groundHeight="pondList[selectedPondId]?.groundHeight" :pondWidth="pondList[selectedPondId]?.pondWidth"
      :pondHeight="pondList[selectedPondId]?.pondHeight" :pondId="selectedPondId" :nearbyPlayers="nearbyPlayers"
      :myActiveSession="myActiveSession" 
      :myFullSession="myFullSession" 
      :baitAreas="baitAreasNearby" :myBaitAreas="myBaitAreas"
      :canCreate="!hasActiveSession" />

    <!-- 开始垂钓表单对话框 -->
    <el-dialog v-model="confirmVisible" title="开始垂钓" :close-on-click-modal="false" width="360px">
      <StartFishingForm :defaultPondId="selectedPondId" @submit="onStartFormSubmit" @cancel="confirmVisible = false" />
    </el-dialog>

    <el-dialog v-model="showTutorialDialog" title="垂钓提示" :close-on-click-modal="false" width="460px">
      <div class="flex flex-col gap-1 text-sm">
        <div>你可以在地图中的任意位置进行钓鱼</div>
        <div>你可以拖动、缩放地图</div>
        <div>在水面（蓝色的地方）上点击，即可选定钓点</div>
        <div>钓鱼会中断你的工作（战斗不受影响）</div>
        <br />

        <div>垂钓：</div>
        <div>当选定钓点后，你将会自动获得鱼获</div>
        <div>每当你获得一份鱼获，都将消耗一份你携带的饵料</div>
        <div> - 对于普通鱼类，收获会自动进入你的收获箱</div>
        <div> - 对于特殊鱼类，你可以在“鱼获”选项卡中看到。也可以在“仓库”->“池塘”中找到。</div>
        <div>你可以在“商店”->“水产商店”中购买或出售鱼类（特殊鱼类的回收价会随着鱼类的品质而提升）</div>

        <br />

        <div>打窝：</div>
        <div>当你开始钓鱼时，你可以看到你附近可用的打窝情况</div>
        <div>你总是可以看到自己打的窝</div>

        <br />

        <div>效率：</div>
        <div>以下指标，多个打窝效果只取相对最大值：</div>
        <div> - 区域内咬口率提升 </div>
        <div> - 区域内最大上钩时间减少 </div>
        <div> - 区域内特定鱼类额外咬口率 </div>
        <div>以下指标，多个打窝效果取合计值：</div>
        <div> - 区域内特定鱼类额外权重</div>

        <div class="mt-1"></div>
        <div>饵料与打窝的效果加总叠加</div>

        <br />
        <div>其他：</div>
        <div>当你开始钓鱼时，你可以看到你附近其他正在钓鱼的玩家（或猫咪助手）</div>
        <div>你可以看到你自己当前的鱼获情况（最近500条）</div>
        <div>你可以看到你附近其他玩家的鱼获情况（最近500条）</div>
        <div>你在这里发出的消息将可以直接被附近正在钓鱼的玩家看到</div>

        <div>垂钓功能后期会完全代替现有的“钓鱼”</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import GameFishingMap from '~/components/Game/Fishing/Map.vue'
import StartFishingForm from '~/components/Game/Fishing/StartFishingForm.vue'
import useFishing from '~/composables/game/useFishing'
import { allFishPond, type AllFishPondID } from '~/shared/data/allFishPond'
import { ObjectKeysTyped } from '~/shared/utils'
import { emitSendShout, onSendShoutSuccess, onSendShoutFail } from '~/api/game/socket/fishing'
import { ElNotification } from 'element-plus'

// 记录最后点击的坐标，并可包含 pondId
const pendingPoint = ref<{ x: number; y: number; pondId?: string | null } | null>(null)
const confirmVisible = ref(false)

const showTutorialDialog = ref(false);

// use fishing composable to centralize socket logic
const { nearbyPlayers, hasActiveSession, myActiveSession, myFullSession, startFishing, getMyActiveSession, endFishing, baitAreasNearby, myBaitAreas, getBaitAreas, getMyBaitAreas } = useFishing()
const mapRef = ref<any>(null)
const shoutInput = ref('')
const isShoutingLocal = ref(false)
let offSendOk: (() => void) | null = null
let offSendFail: (() => void) | null = null

onMounted(() => {
  getMyActiveSession()
  // initial bait area fetch will be driven by myActiveSession when available;
  // fetch player's own bait areas on init via dedicated API
  try {
    getMyBaitAreas()
  } catch (e) {
    // ignore
  }

  // 注册发送结果回调以便本地禁用输入并提示错误
  offSendOk = onSendShoutSuccess((d: any) => {
    isShoutingLocal.value = true
    const ms = Math.max(0, (d?.expiresAt ?? (Date.now() + 10000)) - Date.now())
    setTimeout(() => { isShoutingLocal.value = false }, ms)
  })

  offSendFail = onSendShoutFail((d: any) => {
    ElNotification({ title: '发送失败', message: d?.message ?? '发送失败', type: 'warning' })
  })
})

onBeforeUnmount(() => {
  try { offSendOk && offSendOk() } catch (_) { }
  try { offSendFail && offSendFail() } catch (_) { }
})

// prefer using user's active session coords for first baitAreas fetch
watch(myActiveSession, (val) => {
  if (val) {
    if (typeof val.pointX === 'number' && typeof val.pointY === 'number') {
      getBaitAreas({ pointX: val.pointX, pointY: val.pointY })
    }
  }
}, { immediate: true })
// pond 列表与当前选中 pond
const pondList = allFishPond
const pondKeys = ObjectKeysTyped(pondList)
const selectedPondId = ref<AllFishPondID>(pondKeys[0] ?? '')

function onFishingStart(payload: { pointId?: string; pointX?: number; pointY?: number; pondId?: AllFishPondID }) {
  // 从地图组件接收坐标并弹出确认
  if (hasActiveSession.value) {
    // 已有活跃会话，前端也禁止新建
    console.warn('当前处于钓鱼状态，不能新建钓点')
    return
  }
  if (typeof payload.pointX !== 'number' || typeof payload.pointY !== 'number') return
  pendingPoint.value = { x: payload.pointX, y: payload.pointY, pondId: payload.pondId ?? null }
  // 如果事件中携带了 pondId，则同步选中 pond
  if (payload.pondId) selectedPondId.value = payload.pondId
  confirmVisible.value = true
  // console.log('onFishingStart payload', payload, 'confirmVisible=', confirmVisible.value)
  // refresh bait areas around the chosen point so map can show local bait areas immediately
  // if (typeof payload.pointX === 'number' && typeof payload.pointY === 'number') {
  //   getBaitAreas({ pointX: payload.pointX, pointY: payload.pointY })
  // }
}

function sendShout() {
  if (!hasActiveSession.value) {
    ElNotification({ message: '你需要先开始垂钓才能喊话', type: 'info' })
    return
  }

  if (isShoutingLocal.value) {
    ElNotification({ message: '你的上条消息仍在显示，请稍后再试', type: 'info' })
    return
  }

  const txt = String(shoutInput.value ?? '').trim()
  if (!txt) return
  if (txt.length > 200) {
    ElNotification({ message: '消息不能超过200字符', type: 'warning' })
    return
  }

  try {
    emitSendShout({ text: txt })
    shoutInput.value = ''
  } catch (err: any) {
    ElNotification({ message: err?.message ?? '发送失败', type: 'warning' })
  }
}

async function confirmStart() {
  // kept for compatibility, but replaced by the richer form submit flow
}

async function onStartFormSubmit(formPayload: any) {
  if (!pendingPoint.value) return
  // close dialog immediately
  confirmVisible.value = false

  // 发起开始垂钓请求，合并坐标与表单数据
  const pondIdToUse = pendingPoint.value.pondId ?? (selectedPondId.value || null)
  const payload = {
    ...formPayload,
    pointX: pendingPoint.value.x,
    pointY: pendingPoint.value.y,
    pondId: pondIdToUse,
  }

  try {
    await startFishing(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('startFishing error', message)
  } finally {
    // always clear temporary selection markers in the map
    try { mapRef.value?.clearSelection?.() } catch (e) { /* ignore */ }
    pendingPoint.value = null
  }
}

// 注册 socket 事件回调 handled in composable

</script>

<style scoped>
/* 使用 Tailwind 类进行布局，样式尽量精简 */
</style>
