<template>
  <el-card class="">
    <template #header>
      <div class="flex items-center space-x-3">
        <el-icon>
          <Icon name="material-symbols:menu-book-outline-rounded" class="text-gray-400 text-2xl" />
        </el-icon>
        <span class="text-2xl font-bold text-gray-800  dark:text-gray-200 tracking-wide">猫猫指南</span>
        <span class="ml-2 text-lg">🐾</span>

        <div>
          <el-button @click="forceShowOnboarding = true" type="primary" plain>查看快速开始</el-button>
        </div>
      </div>
    </template>


    <div class="space-y-10 text-base leading-relaxed text-gray-700 dark:text-gray-200 ">
      <!-- 游戏简介 -->
      <section>
        <h2
          class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-blue-200 pl-2">
          <span>猫猫世界简介</span> <span>😺</span>
        </h2>
        <p>
          欢迎来到 <span class="font-bold text-blue-500">猫猫放置</span>！<br>
          这里是猫猫们的乐园，你可以和猫猫们一起采集、钓鱼、种田、建造、养猫、制造装备，体验治愈又悠闲的田园喵生。<br>
          喵呜～快来开启你的猫猫冒险吧！
        </p>
        <br>

        <div class="my-4 flex flex-col gap-2">
          <span class="block text-sm color-gray-400">游戏仍在持续更新中，欢迎提出您的意见与建议！</span>
          <span class="block text-sm color-gray-400">欢迎加入QQ群：932589202、687777685，一起来摸鱼～</span>
          <!-- <div class="flex flex-row items-start">
          <span class="block text-sm color-gray-400">欢迎关注公众号：</span>
          <img class="w-64 h-auto rounded-xl shadow mb-4" src="@/assets/images/wxgzh.png" alt="Sponsor" />
          </div> -->
        </div>

        <div class="my-4">
          <h2
            class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-green-200 pl-2">
            <span>热心猫猫自发整理的新手指南</span> <span>🌱</span>
          </h2>
          <ul>
            <li> <a class="text-blue-400" target="_blank"
                href="https://ucngj7pcsypq.feishu.cn/wiki/C0WXwxYN9i8mi3kVHMfcKN2knzg">猫猫放置简易新人攻略</a> </li>
            <li> <a class="text-blue-400" target="_blank"
                href="https://test-ctmd6jnzo6t9.feishu.cn/docx/P2Vjd7LE0oY7DrxcAvQcm3MBnHg">电脑插件安装手把手喂饭傻瓜教程——网页版</a>
            </li>
            <li> <a class="text-blue-400" target="_blank"
                href="https://jvb4l1il3yl.feishu.cn/wiki/QPEWwOARqiSsShkBnaTcgAOYnSf?from=from_copylink">市场失灵版本幼年猫猫哈气攻略</a>
            </li>
            <li> <a class="text-blue-400" target="_blank"
                href="https://mcnztg9a040m.feishu.cn/wiki/YUOFwunP2idkW0kvejXcsJFcnsc">哈基米摸鱼指北</a> </li>
            <li> <a class="text-blue-400" target="_blank"
                href="https://scn5y8wfe6rv.feishu.cn/wiki/MU1ZwpRuWiXxX1kiPJnchTIrnlu?from=from_copylink">猫猫放置-铁猫（硬核猫）入门攻略</a>
            </li>
          </ul>
        </div>


        <span class="block text-sm color-gray-400">游戏仍在持续更新中，欢迎提出您的意见与建议！</span>
        <span class="block text-sm color-gray-400 mt-4">欢迎加入QQ群：932589202、687777685，一起来摸鱼～</span>
      </section>

      <!-- 基本玩法 -->
      <section>
        <h2
          class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-green-200 pl-2">
          <span>猫猫日常玩法</span> <span>🌱</span>
        </h2>
        <div class="mb-2">
          <span>
            <span class="block font-bold drop-shadow-sm my-4">在摸鱼挂机中，最重要的就是安排好你和猫咪们的一天！</span>
            你可以提前为猫咪们规划好今天要做的事情，比如采集、钓鱼、种田、挖矿、制作等。安排好后，猫咪会自动按顺序完成这些任务，你不用一直操心，轻松摸鱼也能收获满满。当然，如果你喜欢热闹，也可以一直在线和其他猫猫玩家聊天、交流，分享猫猫趣事！
            <br />
            战斗与生活、强化、炼金（炼金台）可以同时进行哦～
          </span>
        </div>
        <ul class="list-disc pl-6 space-y-1">
          <li><span class="font-medium">采集/钓鱼/种田：</span>消耗饱食度，获得木材、鱼、浆果等猫猫必需品。</li>
          <li><span class="font-medium">市场/商店：</span>和其他猫猫玩家交易物品，把多余的资源卖掉，换回需要的宝贝，因此你并不需要精通每一样工作。</li>
          <li><span class="font-medium">制造/锻造/缝制：</span>在猫猫工坊、铁匠铺、纺织屋制作猫爪工具和装备。</li>
          <li><span class="font-medium">炼金：</span>如果缺金币，或者库存积压太多，你可以选择将一些资源以炼金的方式转换为金币。</li>
          <li><span class="font-medium">装备：</span>制造装备或者从市场中购买，合理的搭配装备可以为你提高工作效率。</li>
          <li><span class="font-medium">烹饪：</span>在厨房烹饪美味猫粮，恢复饱食度或喂养小猫咪。</li>
          <li><span class="font-medium">建造：</span>消耗资源建造猫舍、工坊等，解锁更多猫猫功能。</li>
          <li><span class="font-medium">任务：</span>完成每日/成长任务，获得猫爪印章和其他奖励。</li>
          <li><span class="font-medium">战斗：</span>每次战斗都会让你收获战斗经验及金币，更有其他稀有掉落！。</li>
        </ul>
      </section>

      <!-- 主要系统说明 -->
      <section>
        <h2
          class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-yellow-200 pl-2">
          <span>猫猫世界主要系统</span> <span>🏡</span>
        </h2>
        <ul class="list-disc pl-6 space-y-1">
          <li><span class="font-medium">采集/钓鱼/种田：</span>猫猫们最喜欢的日常，收集各种资源，填满小肚皮。</li>
          <li><span class="font-medium">制造/锻造/缝制：</span>打造猫猫专属装备，变身最靓的猫猫！</li>
          <li><span class="font-medium">烹饪：</span>做出香喷喷的猫饭，喂饱自己和小伙伴。</li>
          <li><span class="font-medium">建造：</span>建造猫舍、工坊，解锁更多猫猫玩法。</li>
          <li><span class="font-medium">任务：</span>完成猫猫村长布置的任务，获得丰厚奖励。</li>
          <li><span class="font-medium">市场/商店：</span>和其他猫猫交换宝贝，灵活配置资源。</li>
          <li><span class="font-medium">聊天：</span>在主界面右下角有一个蓝色圆形按钮，你可以在这里与猫猫村的其他村民交流。</li>
        </ul>
      </section>

      <!-- 新手建议 -->
      <section>
        <h2
          class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-pink-200 pl-2">
          <span>猫村长的小贴士</span> <span>📢</span>
        </h2>
        <ol class="list-decimal pl-6 space-y-1">
          <li>刚到猫猫村，应该先去找点吃的！(你的仓库里应该有一些浆果，吃完过后也可以到“采集”->“野外”进行采摘)，保证饱食度，才能有力气摸鱼和玩耍！</li>
          <li>记得多做猫饭，饿了就吃，别让小肚皮咕咕叫。</li>
          <li>多完成任务，猫村长会送你猫爪印章和神秘小鱼干！</li>
          <li>资源用光了？去市场和其他猫猫交换，大家都是好猫猫！</li>
          <li>慢慢解锁新建筑，猫猫村会越来越热闹喵！</li>
          <li>欢迎加入QQ群：932589202、687777685，一起来摸鱼～</li>
        </ol>
      </section>

      <!-- 常见问题 -->
      <section>
        <h2
          class="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200  flex items-center gap-2 border-l-4 border-purple-200 pl-2">
          <span>猫猫常见问题</span> <span>❓</span>
        </h2>
        <el-collapse>
          <el-collapse-item title="饱食度是什么？" name="-2">
            <div>饱食度是游戏中的一种特殊资源，游戏中大多数动作都会消耗饱食度，毕竟猫咪需要吃饱饭才能干活。</div>
          </el-collapse-item>
          <el-collapse-item title="如何补充饱食度" name="-1">
            <div>你可以在仓库中使用“食物”，来补充饱食度。目前饱食度没有上限，也就是说你可以一次吃个饱，来应付你给猫咪安排的工作。</div>
          </el-collapse-item>
          <el-collapse-item title="如何获取食物" name="0">
            <div>在“采集”功能下的很多动作都可以收获食物，其中“种植”动作不需要消耗饱食度就可以不断进行。</div>
          </el-collapse-item>
          <el-collapse-item title="如何获得猫咪伙伴？" name="1">
            <div>收集资源，建造猫舍，然后就可以招募可爱的小猫咪啦！快来组建你的猫猫家族吧！</div>
          </el-collapse-item>
          <el-collapse-item title="资源不够用怎么办？" name="2">
            <div>多去采集、钓鱼、种田，或者在市场把多余的猫薄荷、鱼干卖掉，换回需要的宝贝喵！</div>
          </el-collapse-item>
          <el-collapse-item title="如何使用市场进行交易？" name="5">
            <div>
              在市场页面可以浏览其他猫猫上架的宝贝，选中喜欢的用金币或资源购买。你也可以把自己的宝贝上架，等其他猫猫来买哦！
            </div>
          </el-collapse-item>
          <el-collapse-item title="怎么提升猫猫属性？" name="3">
            <div>多参加锻造、采集等活动，猫猫会慢慢变强，升级后还能解锁新技能喵！</div>
          </el-collapse-item>
          <el-collapse-item title="如何保存进度？" name="4">
            <div>猫猫数据会自动云端保存，游客猫猫记得尽快绑定账号，防止丢失喵！</div>
          </el-collapse-item>
        </el-collapse>
      </section>
    </div>
  </el-card>

  <OnboardingPage :forceShow="forceShowOnboarding" @hide="forceShowOnboarding = false" />
</template>

<script setup lang="ts">
import OnboardingPage from './OnboardingPage.vue';

const forceShowOnboarding = ref(false);

</script>