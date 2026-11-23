<template>
    <div
        ref="containerRef"
        class="relative w-full h-[640px] rounded-md border border-gray-200 overflow-hidden bg-gradient-to-b from-[#e9f7ff] to-[#d6f0ff]"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
    >
        <svg
            ref="svgRef"
            :width="width"
            :height="height"
            :viewBox="viewBox"
            @click="onClick"
            @pointermove.prevent="onPointerHover"
            @pointerleave.prevent="onPointerLeave"
            style="touch-action: none; display:block;"
        >
            <!-- 定义渐变与滤镜，用于水面和地形效果 -->
            <defs>
                <!-- 水面渐变（带更多层次） -->
                <linearGradient id="waterGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#a6d8fb" />
                    <stop offset="40%" stop-color="#58b0ea" />
                    <stop offset="75%" stop-color="#2b7fcf" />
                    <stop offset="100%" stop-color="#133f66" />
                </linearGradient>

                <!-- 水面高光（放置在水面之上，模拟反光） -->
                <radialGradient id="waterSpec" cx="30%" cy="20%" r="60%">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
                    <stop offset="40%" stop-color="#ffffff" stop-opacity="0.45" />
                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
                </radialGradient>

                <!-- 地形渐变（加强边缘阴影） -->
                <linearGradient id="landGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stop-color="#eef7e0" />
                    <stop offset="65%" stop-color="#cfe3a1" />
                    <stop offset="100%" stop-color="#b3cb78" />
                </linearGradient>

                <!-- 轻微模糊滤镜，给水面柔化效果 -->
                <filter id="softBlur">
                    <feGaussianBlur stdDeviation="1.2" />
                </filter>

                <!-- 湖泊阴影（投影，增加层次） -->
                <filter id="lakeDrop" x="-50%" y="-50%" width="200%" height="200%">
                    <feOffset dx="6" dy="10" result="off" />
                    <feGaussianBlur in="off" stdDeviation="10" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" result="shadow" />
                    <feBlend in="SourceGraphic" in2="shadow" mode="normal" />
                </filter>

                <!-- 轻微水面波动效果（仅作为装饰，不用于位移场景内容） -->
                <filter id="waterSheen">
                    <feGaussianBlur stdDeviation="0.6" />
                </filter>
            </defs>

            <!-- 背景地面 -->
            <rect :width="groundWidth" :height="groundHeight" fill="url(#landGrad)" />

            <!-- 湖泊：使用圆角矩形居中显示，带有渐变和波纹层次 -->
            <g :transform="`translate(${lake.x}, ${lake.y})`">
                <!-- 湖体阴影层 -->
                <rect
                    :x="0"
                    :y="0"
                    :width="lake.width"
                    :height="lake.height"
                    :rx="lake.rx"
                    :ry="lake.ry"
                    fill="rgba(0,0,0,0.12)"
                    transform="translate(12,12)"
                    filter="url(#lakeDrop)"
                />

                <!-- 主水面 -->
                <rect
                    :x="0"
                    :y="0"
                    :width="lake.width"
                    :height="lake.height"
                    :rx="lake.rx"
                    :ry="lake.ry"
                    fill="url(#waterGrad)"
                />

                <!-- 水面高光覆盖，模拟反光（放在主水面之上） -->
                <rect :x="0" :y="0" :width="lake.width" :height="lake.height" :rx="lake.rx" :ry="lake.ry"
                    class="water-spec" fill="url(#waterSpec)" opacity="0.12" filter="url(#waterSheen)" pointer-events="none" />

                <!-- 波纹叠加，用多条半透明路径模拟水面纹理；添加缓慢的平移/抖动动画使水面动起来 -->
                <g class="wave-layer" opacity="0.25" stroke="#ffffff" stroke-width="1" fill="none">
                    <path v-for="(p, idx) in wavePaths" :d="p" :key="idx" :transform="`translate(0,${idx*8})`" />
                </g>

                <!-- 渲染bait areas：附近的和我创建的（使用柔和填充与轻描边） -->
                <g>
                    <template v-for="area in baitAreasProp" :key="area.uuid">
                        <circle
                            :cx="baitCx(area)"
                            :cy="baitCy(area)"
                            :r="area.radius"
                            :fill="'rgba(250,204,21,0.12)'"
                            :stroke="'rgba(249,115,22,0.72)'"
                            stroke-width="2"
                            stroke-linejoin="round"
                            @mouseenter="() => (hoveredBait = area)"
                            @mouseleave="() => (hoveredBait = null)"
                            style="pointer-events:auto; cursor:default"
                        />
                    </template>

                    <template v-for="area in myBaitAreasProp" :key="area.uuid">
                        <circle
                            :cx="baitCx(area)"
                            :cy="baitCy(area)"
                            :r="area.radius"
                            :fill="'rgba(59,130,246,0.12)'"
                            :stroke="'rgba(59,130,246,0.92)'"
                            stroke-width="2"
                            stroke-linejoin="round"
                            @mouseenter="() => (hoveredBait = area)"
                            @mouseleave="() => (hoveredBait = null)"
                            style="pointer-events:auto; cursor:default"
                        />
                    </template>

                    <foreignObject v-if="hoveredBait" :x="hoverX(hoveredBait)" :y="hoverY(hoveredBait)" width="220"
                        height="144" style="pointer-events: none;">
                        <div class="flex flex-col gap-2 bg-white rounded shadow p-2 text-sm" style="font-size:12px; pointer-events: auto;">
                            <div class="font-medium truncate">
                                <GameUserAvatarAndName :uuid="hoveredBait.userUuid"></GameUserAvatarAndName>
                            </div>
                            <div class="text-xs text-gray-600">饵料: <GameCommonSimpleResourceIconAndName :resource-id="hoveredBait.baitId"></GameCommonSimpleResourceIconAndName> </div>
                            <div class="text-xs text-gray-500">半径: {{ hoveredBait.radius }}</div>
                            <div class="text-xs text-gray-600" v-if="hoveredBait.expiresAt">持续至: {{ formatTime(hoveredBait.expiresAt) }} </div>
                        </div>
                    </foreignObject>
                </g>

                <!-- 小岛，给游戏感 -->
                <!-- <ellipse
                    :cx="lake.width * 0.68"
                    :cy="lake.height * 0.32"
                    :rx="lake.width * 0.06"
                    :ry="lake.height * 0.035"
                    fill="#6b8f4a"
                /> -->
                <!-- 渲染鱼群（客户端模拟，仅用于视觉与钓鱼判定） -->
                <g>
                    <g v-for="f in fishes" :key="f.id">
                        <circle :cx="f.x - lake.x" :cy="f.y - lake.y" :r="f.type === 'epic' ? 6.5 : f.type === 'rare' ? 5 : 4" :fill="f.type === 'epic' ? '#ffd166' : f.type === 'rare' ? '#9be7ff' : '#ffffff'" :opacity="0.95" />
                    </g>
                </g>

                <!-- 渲染钓点 -->
                <g>
                    <g v-for="p in fishingPoints" :key="p.id">
                        <circle
                            :cx="p.x - lake.x"
                            :cy="p.y - lake.y"
                            r="9"
                            fill="#ff7a7a"
                            stroke="#331"
                            stroke-width="1"
                            style="cursor:pointer"
                            @click.stop.prevent="onFishingPointClick($event, p)"
                        />
                        <circle :cx="p.x - lake.x" :cy="p.y - lake.y" r="14" fill="none" stroke="rgba(255,255,255,0.06)" />
                    </g>
                </g>
                <!-- 渲染附近玩家与自己的活跃会话（使用 foreignObject 嵌入 HTML，以便显示 ElementPlus popover） -->
                <g>
                    <template v-for="pl in nearbyPlayersProp" :key="pl.sessionId">
                        <circle :cx="pl.pointX - lake.x" :cy="pl.pointY - lake.y" r="4" :fill="'#2b8bd6'" stroke="#ffffff" :stroke-width="1.2" pointer-events="none" v-if="pl.name" />
                        <foreignObject :x="nameX(pl)" :y="nameY(pl) + (labelOffsets[pl.sessionId] ?? 0)" :width="nameWidth(pl)" :height="nearbyPopoverHeight + popoverArrowH" v-if="pl.name"> 
                            <div class="flex flex-col items-center">
                                <div class="flex items-center rounded-md px-1 py-1 bg-white dark:bg-gray-600 shadow-md w-full h-full">
                                    <GameFishingNearbyFishingPopover :info="pl">
                                        <template #reference>
                                            <div class="flex flex-row gap-1 items-center justify-start truncate" :style="{ width: nameWidth(pl) + 'px' }">
                                                <GamePlayerProfileAvatar :avatar="pl.avatar" :size="24" />
                                                <div class="truncate text-sm">{{ pl.name }}</div>
                                            </div>
                                        </template>
                                        <template #body></template>
                                    </GameFishingNearbyFishingPopover>
                                </div>
                                <!-- 箭头：居中显示在弹框下方 -->
                                <svg width="16" height="8" viewBox="0 0 16 8" style="color:#ffffff">
                                    <polygon class="arrow-down--other" points="0,0 8,8 16,0" fill="currentColor" />
                                </svg>
                            </div>
                        </foreignObject>

                    <!-- 临时消息气泡（若该玩家有 shout） -->
                    <foreignObject v-if="pl.userUuid && shouts[pl.userUuid]" :x="(pl.pointX - lake.x) - 70" :y="(pl.pointY - lake.y) - 70 - 12" width="140" height="36">
                        <div class="bg-white rounded-md shadow px-2 py-1 text-sm" style="font-size:12px;">
                            <div class="truncate">{{ shouts[pl.userUuid].text }}</div>
                        </div>
                    </foreignObject>

                    </template>

                    <template v-if="myActiveSessionProp">
                        <circle :cx="myActiveSessionProp.pointX - lake.x + 12" :cy="myActiveSessionProp.pointY - lake.y" r="5" :fill="'#34d399'" stroke="#ffffff" :stroke-width="1.4" pointer-events="none" />
                        <foreignObject :x="nameX(myActiveSessionProp)" :y="nameY(myActiveSessionProp)" :width="nameWidth(myActiveSessionProp) + 24" :height="myPopoverHeight + popoverArrowH">
                            <div class="flex flex-col items-center">
                                <div class="flex items-center rounded-md px-1 py-1 bg-sky-500 text-white w-full h-full">
                                    <GameFishingSelfFishingPopover :info="myActiveSessionProp" :isSelf="true" :full="myFullSession">
                                        <template #reference>
                                            <div class="flex flex-row gap-1 items-center justify-start truncate" :style="{ width: (nameWidth(myActiveSessionProp) + 24) + 'px' }">
                                                <GamePlayerProfileAvatar :avatar="myActiveSessionProp.avatar" :size="24" />
                                                <div class="truncate text-sm">{{ myActiveSessionProp.name }}(我)</div>
                                            </div>
                                        </template>
                                        <template #body></template>
                                    </GameFishingSelfFishingPopover>
                                </div>
                                <svg width="16" height="8" viewBox="0 0 16 8" style="color:#0ea5ff">
                                    <polygon points="0,0 8,8 16,0" fill="currentColor" />

                                </svg>
                            </div>
                        </foreignObject>
                    <!-- 自己的临时消息（显示在自己弹窗上方） -->
                    <foreignObject v-if="myActiveSessionProp && myActiveSessionProp.userUuid && shouts[myActiveSessionProp.userUuid]" :x="(myActiveSessionProp.pointX - lake.x) - 80" :y="(myActiveSessionProp.pointY - lake.y) - 70 - 12" width="160" height="40">
                        <div class="bg-sky-200 rounded-md shadow px-3 py-1 text-sm text-sky-900" style="font-size:13px;">
                            <div class="truncate">{{ shouts[myActiveSessionProp.userUuid].text }}</div>
                        </div>
                    </foreignObject>
                    </template>
                </g>
            </g>

            <!-- 方向网格（轻） -->
            <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
                <line v-for="i in Math.ceil(groundWidth/300)" :key="'vx'+i" :x1="i*300" y1="0" :x2="i*300" :y2="groundHeight" />
                <line v-for="j in Math.ceil(groundHeight/300)" :key="'hy'+j" x1="0" :y1="j*300" :x2="groundWidth" :y2="j*300" />
            </g>

            <!-- 点击标记 -->
            <g v-if="marker">
                <circle :cx="marker.x" :cy="marker.y" r="7" fill="#ffdd57" stroke="#333" stroke-width="1.5" />
            </g>
        </svg>

        <!-- 坐标弹窗 -->
        <!-- input moved to MapContainer.vue -->
        <div v-if="popup.show" :style="{ left: popup.left + 'px', top: popup.top + 'px' }" class="absolute bg-black/80 text-white px-2 py-1 rounded text-sm pointer-events-none -translate-y-1">
            坐标: x {{ popup.coord.x.toFixed(1) }}, y {{ popup.coord.y.toFixed(1) }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { onShoutReceived, onSendShoutSuccess, onSendShoutFail } from '~/api/game/socket/fishing'

// --- DOM 引用 ---
const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

// --- 视口尺寸（以像素为单位） ---
// `width`/`height` 是组件容器在屏幕上的像素尺寸
const width = ref(900)
const height = ref(600)

// 组件可配置参数（由父组件传入以支持多 pond 场景）
import type { FishingSessionDTO, NearbyBaitAreaDTO } from '~/shared/types/fishing'

const props = defineProps<{
    groundWidth?: number
    groundHeight?: number
    pondWidth?: number
    pondHeight?: number
    pondId?: string | null
    // 附近玩家与我的活跃会话（由父组件传入以便在地图上渲染）
    nearbyPlayers?: Array<NearbyPlayer>
    myActiveSession?: ActiveSession | null
    myFullSession: FishingSessionDTO | null
    canCreate?: boolean
    // bait areas passed from container
    baitAreas?: NearbyBaitAreaDTO[]
    myBaitAreas?: NearbyBaitAreaDTO[]
}>()

// 使用 props 提供的值；若未提供则使用原始默认值以向后兼容
const groundWidth = props.groundWidth ?? 4000
const groundHeight = props.groundHeight ?? 3000
const pondWidth = props.pondWidth ?? Math.floor(groundWidth * 0.8)
const pondHeight = props.pondHeight ?? Math.floor(groundHeight * 0.8)
const pondIdProp: string | null = props.pondId ?? null
import type { ActiveSession, NearbyPlayer } from '~/shared/types/fishing'
import { formatTime } from '~/shared/utils'

// 使用 computed 以响应父组件传入的 prop 更新（父组件在初始化后才会填充数据）
const nearbyPlayersProp = computed(() => props.nearbyPlayers ?? [])
const myActiveSessionProp = computed(() => props.myActiveSession ?? null)
const canCreateProp = computed(() => (typeof props.canCreate === 'boolean' ? props.canCreate : true))
// bait area accessors
const baitAreasProp = computed(() => props.baitAreas ?? [])
const myBaitAreasProp = computed(() => props.myBaitAreas ?? [])

const hoveredBait = ref<NearbyBaitAreaDTO | null>(null)

// 临时地图消息（按 userUuid 索引）
const shouts = ref<Record<string, { text: string; expiresAt: number }>>({})
const isShouting = ref(false)
let offShoutReceive: (() => void) | null = null
let offSendOk: (() => void) | null = null
let offSendFail: (() => void) | null = null

// label overlap offsets (computed per-frame via reactive computed below)
import { computed } from 'vue'

// 保持原先简单逻辑：不对名称牌做动态错位（允许重叠），以避免缩放时名称乱飘
const labelOffsets = computed(() => {
    return {} as Record<string, number>
})

function baitCx(a: NearbyBaitAreaDTO) {
    return a.pointX - lake.x
}
function baitCy(a: NearbyBaitAreaDTO) {
    return a.pointY - lake.y
}
function hoverX(a: any) {
    // center tooltip horizontally on area; clamp later by SVG boundaries if needed
    const tooltipW = 220
    const cx = (a.pointX - lake.x) - tooltipW / 2
    const minX = 0
    const maxX = Math.max(0, lake.width - tooltipW)
    return Math.min(Math.max(cx, minX), maxX)
}
function hoverY(a: any) {
    const tooltipH = 144
    const margin = 8
    const above = (a.pointY - lake.y) - (a.radius ?? 40) - tooltipH - margin
    const below = (a.pointY - lake.y) + (a.radius ?? 40) + margin
    const minY = 0
    const maxY = Math.max(0, lake.height - tooltipH)
    let y = above
    // if not enough space above, try placing below; finally clamp within lake bounds
    if (y < minY) y = below
    return Math.min(Math.max(y, minY), maxY)
}

// --- Popover sizing & helpers for arrow alignment ---
const nearbyPopoverHeight = 48
const myPopoverHeight = 48
const popoverArrowH = 4 

/**
 * Compute adaptive width for nearby player's popover based on name length.
 * We approximate character width and clamp between min/max to avoid overflow.
 */
function nameWidth(pl: {name: string}) {
    const name = pl.name ?? ''
    const base = 56 // avatar + padding
    const approxCharPx = 9 // approximate width per character
    const computed = base + Math.min(40, name.length) * approxCharPx
    const minW = 36
    const maxW = 480
    return Math.max(minW, Math.min(maxW, computed))
}

function nameX(pl: NearbyPlayer) {
    const w = nameWidth(pl)
    return pl.pointX - lake.x - w / 2
}

function nameY(pl: NearbyPlayer) {
    return pl.pointY - lake.y - (nearbyPopoverHeight + popoverArrowH)
}

// hover handlers: show coordinates while pointer is over the map (unless dragging)
function onPointerHover(e: PointerEvent) {
    if (dragging) return
    const p = screenToSvgPoint(e.clientX, e.clientY)
    // if pointer is inside lake, show popup near cursor
    if (p.x >= lake.x && p.x <= lake.x + lake.width && p.y >= lake.y && p.y <= lake.y + lake.height) {
        popup.coord.x = p.x
        popup.coord.y = p.y
        const rect = containerRef.value?.getBoundingClientRect()
        if (rect) {
            popup.left = e.clientX - rect.left + 12
            popup.top = e.clientY - rect.top + 12
        }
        popup.show = true
    } else {
        popup.show = false
    }
}

function onPointerLeave() {
    if (!popup) return
    popup.show = false
}

// --- 视图变换参数（支持缩放与平移） ---
// 初始使用最小缩放尺寸以便初始化时看到更多内容
const minScale = 0.22
const maxScale = 3
const scale = ref(minScale)
const viewX = ref(0)
const viewY = ref(0)
// `viewBox` 是 SVG 的视口，用当前平移/缩放计算
const viewBox = computed(() => `${viewX.value} ${viewY.value} ${width.value / scale.value} ${height.value / scale.value}`)

// --- 弹窗与标记 ---
const popup = reactive({ show: false, left: 0, top: 0, coord: { x: 0, y: 0 } })
const marker = ref<{ x: number; y: number } | null>(null)

// ---- 钓鱼相关状态 & 网络钩子 ----
// `emit` 用于向上层组件发射钓鱼开始/结果事件
const emit = defineEmits(['fishing-start', 'fishing-result'])

// Fish 类型：客户端视觉与判定用的简易实体
type Fish = { id: string; x: number; y: number; vx: number; vy: number; type: 'common'|'rare'|'epic' }

// `fishingPoints`：钓点数组（id + 逻辑坐标）
const fishingPoints = ref<Array<{ id: string; x: number; y: number }>>([])
// `fishes`：客户端维护的鱼群实体（视觉/判定）
const fishes = ref<Fish[]>([])
// `fishingState`：本地玩家钓鱼流程状态（仅前端展示/节流）
const fishingState = reactive({ busy: false, pointId: '', status: '' as 'idle'|'casting'|'waiting'|'result', resultText: '' })

// 配置项（可由服务端注入或由 props 替换）
// - `fishSpawnIntervalMin`/`Max`：鱼生成周期范围
// - `fishMoveStepMs`：鱼位置更新间隔（ms）
// - `fishDetectRadius`：钓点判定附近鱼的检测半径（逻辑坐标）
const config = {
    fishSpawnIntervalMin: 3000,
    fishSpawnIntervalMax: 7000,
    fishMoveStepMs: 100,
    fishDetectRadius: 60,
}

let fishSpawnTimer: any = null
let fishMoveTimer: any = null

/** 返回 [min, max) 之间的随机数 */
function rand(min: number, max: number) { return Math.random() * (max - min) + min }

/** 生成简单唯一 id（轻量，不用于安全目的） */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9) }

/** 在湖内随机生成若干钓点（id + 逻辑坐标） */
// function generateFishingPoints(count = 6) {
//     const pts: Array<{ id: string; x: number; y: number }> = []
//     for (let i = 0; i < count; i++) {
//         const x = lake.x + rand(40, lake.width - 40)
//         const y = lake.y + rand(40, lake.height - 40)
//         pts.push({ id: uid(), x, y })
//     }
//     fishingPoints.value = pts
// }

/** 生成一条鱼并加入场景（客户端视觉/判定用） */
function spawnFish() {
    const types: Fish['type'][] = ['common', 'common', 'common', 'rare', 'epic']
    const t = types[Math.floor(Math.random() * types.length)]
    const x = lake.x + rand(20, lake.width - 20)
    const y = lake.y + rand(20, lake.height - 20)
    const angle = rand(0, Math.PI * 2)
    const speed = t === 'common' ? rand(0.2, 0.6) : t === 'rare' ? rand(0.15, 0.45) : rand(0.08, 0.3)
    fishes.value.push({ id: uid(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, type: t })
}

/** 计划下一次生成鱼（递归定时） */
function scheduleNextSpawn() {
    const ms = Math.floor(rand(config.fishSpawnIntervalMin, config.fishSpawnIntervalMax))
    fishSpawnTimer = setTimeout(() => {
        spawnFish()
        scheduleNextSpawn()
    }, ms)
}

/** 更新鱼的位置（简单物理/边界反弹） */
function moveFishes() {
    for (const f of fishes.value) {
        f.x += f.vx * (config.fishMoveStepMs / 16)
        f.y += f.vy * (config.fishMoveStepMs / 16)
        // 碰到湖边就反弹
        if (f.x < lake.x + 6 || f.x > lake.x + lake.width - 6) f.vx *= -1
        if (f.y < lake.y + 6 || f.y > lake.y + lake.height - 6) f.vy *= -1
    }
}

/** 启动鱼的位置更新循环 */
function startFishMovementLoop() {
    fishMoveTimer = setInterval(() => moveFishes(), config.fishMoveStepMs)
}

/** 停止所有鱼相关定时/动画，清理资源 */
function stopFishLoops() {
    if (fishSpawnTimer) clearTimeout(fishSpawnTimer)
    if (fishMoveTimer) clearInterval(fishMoveTimer)
}

// ---- 钓鱼交互 ----
/** 返回位于给定钓点检测半径内的鱼列表 */
function getNearbyFish(pointX: number, pointY: number) {
    return fishes.value.filter(f => {
        const dx = f.x - pointX
        const dy = f.y - pointY
        return dx * dx + dy * dy <= config.fishDetectRadius * config.fishDetectRadius
    })
}

/** 钓鱼流程：抛竿 -> 等待 -> 判定 -> 返回结果（仅客户端模拟） */
async function startFishing(point: { id: string; x: number; y: number }) {
    if (fishingState.busy) return
    fishingState.busy = true
    fishingState.pointId = point.id
    fishingState.status = 'casting'
    fishingState.resultText = '抛竿...'
    // 发射包含坐标与 pondId 的事件，方便父组件直接使用坐标发起后端请求
    emit('fishing-start', { pointId: point.id, pointX: point.x, pointY: point.y, pondId: pondIdProp })
    // 全局钩子，方便 socket 监听，保留原先行为并增加坐标信息
    window.dispatchEvent(new CustomEvent('game:fishing', { detail: { action: 'start', pointId: point.id, pointX: point.x, pointY: point.y, pondId: pondIdProp } }))

    await new Promise(r => setTimeout(r, 900))
    fishingState.status = 'waiting'
    fishingState.resultText = '等待咬钩...'

    // 等待一个随机时间，随后判定
    const waitMs = Math.floor(rand(1200, 4200))
    await new Promise(r => setTimeout(r, waitMs))

    // 判定附近是否有鱼
    const nearby = getNearbyFish(point.x, point.y)
    let result: { success: boolean; fish?: Fish | null } = { success: false }
    if (nearby.length > 0 && Math.random() < 0.88) {
        // 权重选鱼： epic > rare > common
        nearby.sort((a, b) => (a.type === 'epic' ? -1 : 0) - (b.type === 'epic' ? -1 : 0))
        const choice = nearby[Math.floor(Math.random() * nearby.length)]
        result = { success: true, fish: choice }
        fishingState.resultText = `钓到: ${choice.type}`
    } else {
        fishingState.resultText = '未钓到鱼'
    }

    fishingState.status = 'result'
    emit('fishing-result', { pointId: point.id, result })
    window.dispatchEvent(new CustomEvent('game:fishing', { detail: { action: 'result', pointId: point.id, result } }))

    // 简短展示结果后复位
    await new Promise(r => setTimeout(r, 1300))
    fishingState.busy = false
    fishingState.pointId = ''
    fishingState.status = 'idle'
    fishingState.resultText = ''
}

// --- 湖泊几何（保持居中于地面） ---
// 使用上面定义的 groundWidth/groundHeight 与 pondWidth/pondHeight 确定
const lake = {
    width: pondWidth,
    height: pondHeight,
    rx: 60, // 圆角
    ry: 60,
    x: Math.floor((groundWidth - pondWidth) / 2),
    y: Math.floor((groundHeight - pondHeight) / 2),
}

// 生成几条波纹路径，基于湖的宽度
const wavePaths = computed(() => {
    const paths: string[] = []
    const w = lake.width
    const h = lake.height
    const step = Math.max(40, Math.floor(w / 10))
    for (let y = 30; y < h - 10; y += 28) {
        // 使用平滑的二次贝塞尔曲线来模拟水平波纹
        let d = `M 16 ${y}`
        for (let x = 16; x < w - 16; x += step) {
            const cx = x + step / 2
            const cy = y + (Math.sin((x / w) * Math.PI * 2 + y / 40) * 6)
            d += ` Q ${cx} ${cy} ${x + step} ${y}`
        }
        paths.push(d)
    }
    return paths
})

/**
 * 在容器尺寸变化时重新计算视口尺寸并将视角居中到地图（默认行为：居中显示地面）
 * 此外调用 `clampView` 确保视口不会超出地面范围
 */
function recenterView() {
    if (!containerRef.value) return
    width.value = containerRef.value.clientWidth || width.value
    height.value = containerRef.value.clientHeight || height.value
    // 将视图居中到地图中间（默认行为：地面居中）
    viewX.value = (groundWidth - width.value / scale.value) / 2
    viewY.value = (groundHeight - height.value / scale.value) / 2
    clampView()
}

/**
 * 限制视窗不超出地面边界：
 * - 当视口逻辑尺寸大于地面时，自动居中显示
 * - 否则把 viewX/viewY 限制在 [0, max] 区间
 */
function clampView() {
    const viewW = width.value / scale.value
    const viewH = height.value / scale.value
    const maxX = groundWidth - viewW
    const maxY = groundHeight - viewH
    if (maxX < 0) {
        // 当视口宽度大于地面宽度时，居中显示
        viewX.value = (groundWidth - viewW) / 2
    } else {
        viewX.value = Math.min(Math.max(viewX.value, 0), maxX)
    }
    if (maxY < 0) {
        viewY.value = (groundHeight - viewH) / 2
    } else {
        viewY.value = Math.min(Math.max(viewY.value, 0), maxY)
    }
}

onMounted(() => {
    // 初始化时使用最小缩放并居中视图
    recenterView()
    window.addEventListener('resize', recenterView)
    // 初始化钓点与鱼群（客户端模拟）
    // generateFishingPoints(6)
    scheduleNextSpawn()
    startFishMovementLoop()

    // 注册临时消息 socket 监听
    offShoutReceive = onShoutReceived((payload) => {
        try {
            const { userUuid, text, expiresAt } = payload as any
            if (!userUuid) return
            shouts.value[userUuid] = { text, expiresAt }
            const ms = Math.max(0, (expiresAt ?? (Date.now() + 10000)) - Date.now())
            setTimeout(() => {
                const cur = shouts.value[userUuid]
                if (cur && cur.expiresAt <= (expiresAt ?? 0)) {
                    delete shouts.value[userUuid]
                }
            }, ms)
        } catch (e) { /* ignore */ }
    })

    offSendOk = onSendShoutSuccess((d: any) => {
        isShouting.value = true
        const ms = Math.max(0, (d?.expiresAt ?? (Date.now() + 10000)) - Date.now())
        setTimeout(() => { isShouting.value = false }, ms)
    })

    offSendFail = onSendShoutFail((d: any) => {
        // keep failure handling minimal here; MapContainer also listens and will notify user
        console.warn('fishing:shout:send:fail', d?.message)
    })
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', recenterView)
    stopFishLoops()
    if (zoomRafId) cancelAnimationFrame(zoomRafId)
    try { offShoutReceive && offShoutReceive() } catch (_) {}
    try { offSendOk && offSendOk() } catch (_) {}
    try { offSendFail && offSendFail() } catch (_) {}
})

// expose API to parent: clear selection/popup
function clearSelection() {
    marker.value = null
    popup.show = false
}

defineExpose({ clearSelection })

/**
 * 将屏幕（clientX/clientY）坐标转换为 SVG 内的逻辑坐标
 * 返回 {x,y} 在画布坐标系（与 ground/pond 同一坐标系）
 */
function screenToSvgPoint(clientX: number, clientY: number) {
    // Use container rect + current viewBox (viewX/viewY and logical size) to compute
    // a deterministic mapping from client coordinates to world coordinates.
    // This avoids relying on SVG's getScreenCTM which can be flaky across browsers
    // when viewBox updates are applied asynchronously.
    const container = containerRef.value
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    // logical view size in world coordinates
    const viewW = width.value / scale.value
    const viewH = height.value / scale.value
    // normalized mouse position within the container [0,1]
    const nx = (clientX - rect.left) / Math.max(1, width.value)
    const ny = (clientY - rect.top) / Math.max(1, height.value)
    const x = viewX.value + nx * viewW
    const y = viewY.value + ny * viewH
    return { x, y }
}

// 点击地图，显示坐标并放置标记（中文注释说明）
/** 点击地图任意位置，显示坐标弹窗并放置标记（仅前端展示） */
function onClick(e: MouseEvent) {
    // 如果不允许新建钓点（例如用户当前已有活跃会话），点击不应展示圆点与坐标
    if (!canCreateProp.value) return
    // 计算弹窗在容器内的位置
    const rect = containerRef.value!.getBoundingClientRect()
    const p = screenToSvgPoint(e.clientX, e.clientY)
    marker.value = { x: p.x, y: p.y }
    popup.coord.x = p.x
    popup.coord.y = p.y
    popup.left = e.clientX - rect.left + 8
    popup.top = e.clientY - rect.top + 8
    popup.show = true

    // 如果点击位置位于湖泊区域内，视为玩家选择该位置垂钓（由父组件/上层处理确认与后端请求）
    if (p.x >= lake.x && p.x <= lake.x + lake.width && p.y >= lake.y && p.y <= lake.y + lake.height) {
        // 如果不允许新建钓点（例如当前已处于活跃钓鱼），则不展示标记与弹窗，也不发事件
        if (!canCreateProp.value) {
            return
        }
        // 发射包含坐标与 pondId 的事件，父组件（例如 MapContainer）会拦截并弹出确认
        emit('fishing-start', { pointX: p.x, pointY: p.y, pondId: pondIdProp })
        window.dispatchEvent(new CustomEvent('game:fishing', { detail: { action: 'start', pointX: p.x, pointY: p.y, pondId: pondIdProp } }))
    }
}

// 点击钓点处理（阻止事件传播以免触发 map click）
function onFishingPointClick(e: MouseEvent, p: { id: string; x: number; y: number }) {
    e.stopPropagation()
    // 如果不允许新建钓点，则不发出事件
    if (!canCreateProp.value) return
    // 点击固定钓点也转为选择该坐标进行垂钓，由父级组件决定后端请求和流程
    emit('fishing-start', { pointId: p.id, pointX: p.x, pointY: p.y, pondId: pondIdProp })
    window.dispatchEvent(new CustomEvent('game:fishing', { detail: { action: 'start', pointId: p.id, pointX: p.x, pointY: p.y, pondId: pondIdProp } }))
}

// 发送临时地图消息（一次性），客户端做基础防重/输入校验，服务器会做严格过滤
// sendShout moved to MapContainer.vue

// --- 平移相关 ---
let dragging = false
let lastClient = { x: 0, y: 0 }
// smooth zoom state
const targetScale = ref(scale.value)
let zoomRafId: number | null = null
let zoomClient = { x: 0, y: 0 }
let zoomAnchor = { x: 0, y: 0 }

// auto-zoom guard: only auto-zoom once on enter when we receive myActiveSession
const autoZoomDone = ref(false)
function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

/**
 * Pointer down 开始拖动（平移视图）
 * 记录上一次指针位置并绑定 move/up 事件
 */
function onPointerDown(e: PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    dragging = true
    lastClient.x = e.clientX
    lastClient.y = e.clientY
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
}

/**
 * Pointer move 时平移视图，注意缩放影响（除以 scale）并限制视图范围
 */
function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const dx = (e.clientX - lastClient.x) / scale.value
    const dy = (e.clientY - lastClient.y) / scale.value
    viewX.value -= dx
    viewY.value -= dy
    lastClient.x = e.clientX
    lastClient.y = e.clientY
    clampView()
}

/** Pointer up：结束拖动并解绑事件 */
function onPointerUp() {
    dragging = false
    window.removeEventListener('pointermove', onPointerMove)
}

// 缩放：以鼠标位置为焦点缩放，并尽量保持湖泊居中感
/**
 * 滚轮缩放：以鼠标为中心进行缩放（保持焦点位置）
 * 缩放后调用 clampView 确保不会漂出地面
 */
function onWheel(e: WheelEvent) {
    // slower, smoother zoom: compute a modest factor and animate toward it
    e.preventDefault()
    const delta = -e.deltaY
    // use smaller step for smoother feeling
    const step = 0.06
    const factor = delta > 0 ? 1 + step : 1 - step

    // compute new target scale and clamp
    const newTarget = Math.max(minScale, Math.min(maxScale, targetScale.value * factor))
    targetScale.value = newTarget

    // record zoom anchor (world coords) and client pos so we can keep it fixed during animation
    zoomClient.x = e.clientX
    zoomClient.y = e.clientY
    zoomAnchor = screenToSvgPoint(e.clientX, e.clientY)

    // start animation loop if not running
    if (!zoomRafId) startZoomAnimation()
}

function startZoomAnimation() {
    const stepT = 0.14 // lerp factor per frame (tuned for smoothness)

    function frame() {
        // lerp scale towards target
        const prev = scale.value
        const next = lerp(prev, targetScale.value, stepT)
        scale.value = next

        // keep zoom anchor under the same client position by adjusting viewX/viewY
        const after = screenToSvgPoint(zoomClient.x, zoomClient.y)
        viewX.value += zoomAnchor.x - after.x
        viewY.value += zoomAnchor.y - after.y
        clampView()

        // stop when close enough
        if (Math.abs(scale.value - targetScale.value) < 0.001) {
            scale.value = targetScale.value
            zoomRafId = null
            return
        }

        zoomRafId = requestAnimationFrame(frame)
    }

    zoomRafId = requestAnimationFrame(frame)
}

/**
 * Programmatic auto-zoom: keep given world point under the center of the container while
 * lerping `scale` toward `targetScale` using the existing animation loop.
 * - `pointX/pointY` are world coordinates
 * - `desiredScale` is optional and will be clamped
 */
function autoZoomToPointWorld(pointX: number, pointY: number, desiredScale?: number) {
    if (!containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    // set zoomClient to container center (client coords)
    zoomClient.x = rect.left + rect.width / 2
    zoomClient.y = rect.top + rect.height / 2
    // anchor is the world point we want to keep under the client point
    zoomAnchor = { x: pointX, y: pointY }
    const newTarget = Math.max(minScale, Math.min(maxScale, desiredScale ?? Math.min(1.6, maxScale)))
    targetScale.value = newTarget
    if (!zoomRafId) startZoomAnimation()
}

// watch for myActiveSessionProp and auto-zoom once when it appears with a valid point
watch(myActiveSessionProp, (val) => {
    if (!val) return
    // only once per mount/enter
    if (autoZoomDone.value) return
    if (typeof val.pointX === 'number' && typeof val.pointY === 'number') {
        // choose a comfortable zoom level (clamped by min/max)
        const desired = Math.min(1.1, maxScale)
        autoZoomToPointWorld(val.pointX, val.pointY, desired)
        autoZoomDone.value = true
    }
}, { immediate: true })
</script>
<style lang="scss" scoped>
.arrow-down--other {
  @at-root .dark & {
    fill: oklch(44.6% 0.03 256.802) !important;
  }
}

/* 轻微水波平移动画，周期非常长以保持细腻 */
.wave-layer {
    transform-origin: center;
    animation: wave-move 20s linear infinite;
}

@keyframes wave-move {
    0% { transform: translateX(0px) translateY(0px); }
    50% { transform: translateX(18px) translateY(1px); }
    100% { transform: translateX(0px) translateY(0px); }
}

/* 水面高光缓慢呼吸效果 */
.water-spec {
    animation: water-sheen 6s ease-in-out infinite alternate;
}

@keyframes water-sheen {
    0% { opacity: 0.08; }
    50% { opacity: 0.14; }
    100% { opacity: 0.08; }
}

</style>