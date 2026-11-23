<template>
  <transition name="fade">
    <div v-if="visible" class="onboarding-overlay">
      <div class="onboarding-container">
        <header class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/static/images/logo.png" alt="logo" class="w-10 h-10 rounded-full shadow" />
            <div>
              <h1 class="m-0 text-lg md:text-xl">欢迎来到猫猫放置</h1>
              <p class="m-0 text-xs text-gray-500">快速了解世界、开始你的第一步</p>
            </div>
          </div>
          <div class="flex gap-2">
            <el-button @click="onLater">稍后再看</el-button>
            <el-button type="primary" @click="onFinish">立即开始</el-button>
          </div>
        </header>

        <main class="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">

          <!-- 初始装备与饱食度 / 仓库使用 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">游戏信息</h2>
            <p class="text-gray-700 mb-2">帮助你快速了解游戏中的基本系统。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>资源：游戏中大多数的资源，在鼠标悬浮（移动端需要长按）都会显示此资源的相关信息（产出途径、用途、装备效果、使用效果等）。 </li>
              <li> - 你可以直接点击产出途径、用途来快速访问对应的动作 </li>
              <li>动作：游戏中的队列动作，你都可以对其进行明确的队列安排（如采集做多少次、做多久，采集后做什么）</li>
              <li>装备：装备可以提升属性与特效。你可以在仓库对应的分类中查看你所拥有的装备，通过“角色”菜单查看当前穿戴的装备。</li>
              <li>酒馆：当你建造了“酒馆”后，可以在主菜单看到“酒馆”菜单，其中的专家可以为你的生活、战斗提供十分有用的增益。</li>
              <li>词典：你可以在左侧菜单底部找到“词典”，其中包含了游戏内各系统的详细条目信息。</li>
            </ul>
          </section>

          <!-- 初始装备与饱食度 / 仓库使用 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">初始装备与饱食度</h2>
            <p class="text-gray-700 mb-2">新账号会在仓库获得基础资源与入门装备。饱食度用于维持主角的某些行动与状态。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>仓库查看：左侧菜单 → 家园 → 仓库</li>
              <li>饱食度：活动会消耗，喂食可恢复</li>
              <li>技能书：学习战斗/治疗等基础技能</li>
              <li>仓库可直接使用物品：
                <div class="mt-1 text-gray-600 text-sm">
                  • 吃东西（果子、猫薄荷、猫零食等）恢复与增益<br>
                  • 装备物品（如武器、防具、饰品）提升属性与特效<br>
                  • 学习技能书（战斗/治疗/辅助等），解锁相应技能<br>
                  • 使用功能道具（如各类材料包、许可证等）
                </div>
              </li>
              <li>提示：点开仓库物品卡片即可进行“使用/装备/学习/分解”等操作。</li>
            </ul>
          </section>

          <!-- 战斗（装备、技能、专精、祝福、副本） -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">战斗系统</h2>
            <p class="font-bold mb-2 text-sm!">你可以同时进行生活与战斗</p>
            <p class="font-bold mb-2 text-sm!">新猫猫强烈建议建造“猫猫小酒馆”后聘请雇佣兵猫猫+“镇中心”获取“见习猫猫祝福”后进行战斗</p>
            <p class="text-gray-700 mb-2">战斗由装备、技能、专精（技能树）、祝福（随机词条）与副本难度共同构成。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>装备：仓库或制造获取，提升属性与特效</li>
              <li>技能：学习与升级，调整出战技能与顺序。可以手动管理技能释放逻辑以提高作战效率。</li>
              <li>专精：技能树加点增强特定流派</li>
              <li>祝福：随机词条带来差异化与构筑乐趣</li>
              <li>副本：逐级挑战更高难度，获取更好奖励</li>
            </ul>
          </section>

          <!-- 主角动作（采集/种植/制造等） -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">主角的动作</h2>
            <p class="text-gray-700 mb-2">通过左侧“动作”菜单执行采集、种植、制造等活动，获得资源与经验。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>采集/种植：低门槛，最快入门</li>
              <li>钓鱼：与小镇内的其他猫咪共同钓鱼，出售鱼获换取金币 </li>
              <li>制造/锻造：消耗材料，产出装备与物品</li>
              <li>探索/交易：提升收益或解锁更多玩法</li>
            </ul>
          </section>

          <!-- 建造猫舍与猫咪助手 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">建造猫舍，获得猫咪助手</h2>
            <p class="text-gray-700 mb-2">在“建造”中解锁猫舍后，可获得猫咪助手参与工作或探险，提升效率与乐趣。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>猫咪助手相当于为你提供了第二个行动队列，允许你同时进行多个队列动作</li>
              <li>建造入口：家园 → 建造</li>
              <li>猫舍解锁后：家园 → 猫舍</li>
              <li>猫咪状态：饱食度/心情会影响表现</li>

              <li>提示：猫咪助手在行动过程中会时不时给你带来一些惊喜哦~</li>
            </ul>
            
          </section>

          <!-- 强化与炼金 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">强化与炼金</h2>
            <p class="text-gray-700 mb-2">强化提升装备数值与等级；炼金用于资源转化与特殊材料产出。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>强化：选择目标装备，消耗资源提升数值</li>
              <li>分解：回收材料（在“分解”面板）</li>
              <li>炼金：按配方转化资源，产出特殊材料</li>
            </ul>
            
          </section>

          <!-- 镇中心：市场/拍卖行/商业街 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">镇中心：市场/拍卖行/商业街</h2>
            <p class="text-gray-700 mb-2">镇中心是玩家交易与交互的核心。市场用于即时交易，拍卖行处理竞价，商业街为玩家自营店铺。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>市场：快速买卖基础资源（价格阶梯与手续费）</li>
              <li>拍卖行：稀有物品竞价与一口价</li>
              <li>商业街：上架自己的商品，赚取金币</li>
            </ul>
            
          </section>

          <!-- 交流与帮助 -->
          <section class="bg-white border border-gray-200 rounded-xl p-4 shadow">
            <h2 class="text-base font-semibold mb-2">交流与帮助</h2>
            <p class="text-gray-700 mb-2">右下角聊天面板可与玩家交流，或在“游戏指南”中查阅系统说明；遇到问题可在“意见反馈”提交。</p>
            <ul class="list-disc pl-5 space-y-1 text-gray-800">
              <li>聊天：点击右下角按钮展开聊天面板</li>
              <li>指南：左侧菜单 → 游戏指南</li>
              <li>反馈：左侧菜单 → 意见反馈</li>
              <li>QQ群：932589202、687777685</li>
            </ul>
            
          </section>
        </main>
        <footer class="flex items-center justify-between border-t border-gray-200 pt-3">
          <div class="text-gray-500 text-sm">你随时可以在左侧菜单“游戏指南”查看更详尽的内容</div>
        </footer>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
const visible = ref(false)

const props = defineProps<{
  forceShow?: boolean
}>()

const emits = defineEmits<{
    (e: 'hide', payload: boolean): void
}>()

watch(props, (n) => {
  if (n.forceShow) {
    visible.value = true
  }

}, {
  deep: true
})

onMounted(async () => {
  if (props.forceShow) {
    visible.value = true
    return
  }

  try {
    const res: any = await $fetch('/api/game/onboarding/status')
    if (res?.ok && res?.needGuide) {
      visible.value = true
    }
  } catch (e) {
    // 静默失败，不打扰正常流程
  }
})

const onFinish = async () => {
  try {
    await $fetch('/api/game/onboarding/mark-seen', { method: 'POST' })
  } catch {}
  visible.value = false

  emits('hide', true)
}

const onLater = () => {
  visible.value = false

  emits('hide', true)
}

function go(index: string) {
  // 触发页面内菜单切换（避免直接操作父作用域变量），由父级消费或通过全局事件总线处理
  try {
    // 使用全局事件总线（若已存在）
    // @ts-ignore
    if (window?.eventBus?.emit) {
      // 通知左侧菜单切换
      // @ts-ignore
      window.eventBus.emit('open-menu', index)
    }
  } catch {}
}
</script>

<style lang="scss" scoped>
.onboarding-overlay { position: fixed; inset: 0; z-index: 1000; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); overflow: auto; }
.onboarding-container { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; max-width: 1200px; margin: 0 auto; padding: 16px; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

p {
  font-size: 16px;
}
li {
  font-size: 14px;
}
</style>