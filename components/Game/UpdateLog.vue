<template>
  <el-card shadow="hover">
    <h2 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 ">更新日志</h2>
    <el-collapse v-model="activeYear" class="px-4 py-2 bg-white! dark:bg-stone-900! rounded border-b-0!">
      <template v-for="(year) of yearOrder">
        <el-collapse-item :title="year + '年'" :name="year">
          <el-timeline>
            <el-timeline-item v-for="(log, index) in updateLogs[year]" :key="index" :timestamp="log.date" :type="log.type"
              placement="top">
              <el-card class="mb-4 hover:shadow-lg transition-shadow duration-300">
                <h3 class="text-lg font-semibold mb-2">{{ log.version }}</h3>
                <div class="text-gray-600 dark:text-gray-400 ">
                  <ul class="list-inside space-y-2">
                    <li v-for="(item, idx) in log.content" :key="idx" class="" :class="{
                      'list-disc': !item.startsWith(' - ') && item != '---' && !item.startsWith('   ')
                    }">
                      <span class="space-x-2" :class="{
                        'ml-2': item.startsWith(' - '),
                        'ml-10': item.startsWith('   ')
                      }">
                        <template v-for="itemPart in parseUpdateLogContent(item)">
                          <template v-if="itemPart.type == 'string'">
                            <template v-if="itemPart.content == '---'">
                              <br />
                            </template>
                            <template v-else>
                              <span v-html="itemPart.content"></span>
                            </template>
                          </template>
                          <template v-if="itemPart.type == 'resource'">
                            <GameCommonResourceIconAndName :resource-id="itemPart.content">
                            </GameCommonResourceIconAndName>
                          </template>
                          <template v-if="itemPart.type == 'state'">
                            <GameCommonStateName :state-id="(itemPart.content as any)"></GameCommonStateName>
                          </template>
                          <template v-if="itemPart.type == 'skill'">
                            <GameCommonBattleSkillName :skill-id="itemPart.content"></GameCommonBattleSkillName>
                          </template>
                          <template v-if="itemPart.type == 'action'">
                            <div
                              class="inline-block px-2 py-1 rounded text-sm bg-blue-100 dark:bg-gray-400  text-blue-800 dark:text-gray-800">
                              <GameCommonSimpleActionNameAndIcon :action-id="itemPart.content">
                              </GameCommonSimpleActionNameAndIcon>
                            </div>
                          </template>
                        </template>
                      </span>
                    </li>
                  </ul>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-collapse-item>
      </template>
    </el-collapse>

  </el-card>
</template>

<script lang="tsx" setup>
import { CUSTOM_AVATAR_MIN_SPONSOR_POINTS, MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL, MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL, MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL, MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL } from "~/shared/data/constant";
import { formatNumber } from "~/shared/utils";

const activeYear = ref("2026");

/*

更新前checklist

新功能对铁猫是否需要区别对待
是否有技能测试时的调整，是否修改回去
是否有常量调整，是否修改回去


如果有技能修改，这次的修改是否可能会有死循环（比如造成伤害后、触发造成伤害）

如果有状态修改，请检查状态的属性（比如isBuff、isDebuff、特别是stackable）

关键逻辑是否都使用了事务

检查技能，是否会触发循环（律动触发星辰魔法书，castSkill循环触发）

*/
const updateLogs = {
  2026: [
    {
      date: '2026-02-13',
      type: 'primary',
      content: [
        '修复：赞助积分包兑换时，可以重复累计最大赞助积分问题',
        '其他：因2026-02-12凌晨游戏内库存异常导致玩家游戏进度丢失问题，将会补偿以下物品给2026-02-08后登录过的玩家，具体如下：',
        ' - resource:doubleActionEfficiency*6',
        ' - resource:doubleBattleEfficiency*5',
        ' - resource:luckyBoost*3',
        ' - resource:bookOfBattleSkillTreePoint*10',
        ' - resource:bookOfWorkSkillTreePoint*10',
      ]
    },
    {
      date: '2026-02-12',
      type: 'primary',
      content: [
        '调整：“赞助积分包”现在可以在市场中交易',
        '其他：后面几天会对市场、拍卖行、店铺异常交易进行异常交易资金扣除/封号处理，请各位猫猫注意规范交易行为，欢迎大家积极举报异常交易行为，举报有奖！',
        // '新增：“炼金”->“点“金蛋”术”',
        // '调整：赞助渠道新增“爱发电”',
      ]
    },
    {
      date: '2026-02-11',
      type: 'primary',
      content: [
        '新增：“赞助商店”新增两款头像框',
        '新增：“首页”现在将会展示所有近期活跃的“大麻烦”',
      ]
    },
    {
      date: '2026-02-08',
      type: 'primary',
      content: [
        '修复：个人卡片背景丢失问题',
        '修复：“强化”->“查看可强化物品”的界面排版问题',
        '修复：“市场”操作弹窗（撤销上架、求购）内资源信息不显示问题',
        '修复：resource:safeJourneyToken描述错误问题',
        '优化：游戏内大多数的消息通知，在移动端将以简单消息的形式展示。',
        '调整：“市场”->“求购”列表中，出现相同价格时，将会按照求购订单创建时间进行排序，更早创建的订单将会更靠前显示',
        '调整：“市场”->“上架”，当对同一个物品在30分钟内重复进行2次上架操作后，将会触发60分钟的调价冷却，期间你无法对此物品再次进行上架操作。',
        '调整：“市场”->“求购”，当对同一个物品在30分钟内重复进行2次求购操作后，将会触发60分钟的调价冷却，期间你无法对此物品再次进行求购操作。',
        '调整：调整了“市场”->“历史出售订单价格”的数据采样逻辑，现在能正确展示所有价格段的交易情况，便于大家进行市场监督',
        // '调整：“市场”单次购买的最大数量调整至10,000,000',
        '调整：现在战斗房间内，各成员的战利品及经验获取效率，将根据自身与战斗房间战斗等级进行调整。获取效率随着等级差的提升而降低。',
        ' - 战斗等级超过90级后无此限制',
        ' - 硬核猫无此限制',
        // ' - “大麻烦”战斗房间无此限制',
      ]
    },
    {
      date: '2026-02-07',
      type: 'primary',
      content: [
        '其他：因数据回滚导致玩家游戏进度丢失问题，将会补偿以下物品给2026-02-04后登录过的玩家，具体如下：',
        ' - resource:doubleActionEfficiency*6',
        ' - resource:doubleBattleEfficiency*5',
        ' - resource:luckyBoost*3',
        '以下物品会发放给所有玩家以及后续注册的新玩家：',
        ' - resource:doubleActionEfficiency*3',
        ' - resource:doubleBattleEfficiency*3',
        ' - resource:luckyBoost*3',
        ' - resource:safeJourneyToken',
        ' - resource:bookOfBattleSkillTreePoint*5',
        ' - resource:bookOfWorkSkillTreePoint*5',
        '以上道具中的消耗品无使用期限，猫猫们可按需进行使用',
        '补偿物品会分批依次发送，可稍后在收获箱中查看',
        '其他：因数据回滚导致部分玩家心意点数回滚问题，可携带库存消耗情况填写反馈',
        '',
        '最近有些见习猫猫在猫猫村的旅途中创造了一些‘特别的玩法’，猫猫村认为这种行为实际上反应了一个系统问题：',
        ' - 精通游戏的玩家在拥有更多信息的前提下相对更占优势；而新玩家因缺乏引导，在信息与选择不足时被迫接受',
        '这帮助我们发现问题并让我们更有改进动力，也体现了猫猫玩家狂野的“创造力”',
        '后续我们将会持续加强对新玩家的体验优化，补充新玩家初次游戏时的引导，调整游戏内各种各个功能的产出，并优化游戏内各个功能的提示说明。',
        '同时我们也希望新玩家可以慢慢体验游戏，不必过快追求游戏进度。',
        '猫猫村希望各位玩家都可以一起维护猫猫村和谐友善的氛围，欢迎大家积极反馈游戏内的各种问题与建议，也欢迎大家举报不良风气行为，举报有奖！',
      ]
    },
    {
      date: '2026-02-07',
      type: 'primary',
      content: [
        '其他：因昨天线上环境出现商店购买及市场交易异常情况，数据被回滚至2026-02-06 21:15，请各位猫猫谅解。具体补偿方案确认后会第一时间公布。',
      ]
    },
    {
      date: '2026-02-04',
      type: 'primary',
      content: [
        '新增：技能、物品的自动使用逻辑中添加了“物品冷却判断”',
        '优化：化了主队列的执行效率',
        '优化：优化了战斗逻辑',
        '优化：更新一些图标资源',
        '优化：提高了更新后首次打开页面的加载速度',
        '优化：“头像框”现在可以在物品详情信息中进行预览',
        '优化：“称号“现在可以在物品详情信息中查看属性',
        '修复：聊天框对齐问题',
        '修复：任务队列中当前进度后小数位数过多问题',
        '修复：超过离线时间的玩家重新登录后，队列不会恢复执行问题',
        '修复：战斗中复活后，一些“阵亡后保留”的状态没有正确保留的问题',
        '修复：猫咪助手饱食度不会消耗的问题',
        ' - 将会补偿2026-01-27后登录过的玩家，每位玩家将会获得 resource:cutePoint*80 作为补偿',

        '调整：降低了“建造”->“猫猫小酒馆”的资源消耗',
        '调整：战斗等级25级以下时，“酒馆”中的“见习雇佣兵猫猫”在聘用时仅消耗resource:mushroomStew',
        '调整：战斗等级45级以下时，“酒馆”中的“见习雇佣兵猫猫”在聘用时仅消耗resource:mushroomStew*2 resource:gold*100',
        '调整：战斗等级45级以下时，“酒馆”中的“见习雇佣兵猫猫”最多聘用60小时',

        '调整：满足以下任一条件的玩家，每天都可以在“镇中心”的“征战圣火纪念碑”获取“见习猫猫祝福”',
        ' - 注册时间不超过14天',

        '其他：欢迎各位猫猫反馈举报猫猫村不良风气，举报有奖！被大量举报的猫猫视将会严肃处理或送上菜市口。希望大家一起维护和谐的氛围～',
      ]
    },
    {
      date: '2026-02-03',
      type: 'primary',
      content: [
        '修复：一些文字描述问题',
        '关于2026-02-03种植、炼金异常的补偿说明：',
        ' - 每位2026-01-27后登陆过的玩家，将会发放 resource:bookOfWorkSkillTreePoint*15 resource:superLuckyBerryPie*5',
        '关于2026-02-03战斗属性异常的补偿说明：',
        ' - 每位2026-01-27后登陆过的玩家，将会发放 resource:bookOfBattleSkillTreePoint*5 resource:moonPearl*50',

        '以及一个头像框 resource:t_avatarBorder_20260203potato',
      ]
    },
    {
      date: '2026-02-01',
      type: 'primary',
      content: [
        '优化：猫咪助手喂食界面输入框优化',
        '优化：一些逻辑优化',
        '修复：在备战回合内存在未行动单位时，进入新的战斗时备战回合被清空问题',
        '修复：一些文字描述问题',
      ]
    },
    {
      date: '2026-01-30',
      type: 'primary',
      content: [
        '调整：现在战斗信息（普通、文字）中显示的伤害数值调整为伤害实际数值（原显示的数值最大不会超过目标的当前生命值）',
        ' - 不影响伤害结算逻辑，仅显示逻辑调整',
        '修复：召唤单位可以获得备战回合问题',
        '修复：专精“致命一击”没有按预期倍率造成伤害的问题',
        '修复：“公会信息”的编辑弹窗内的“取消”按钮无效问题',
        '修复：一些文字描述问题',
        '其他：建设中的wiki: http://wiki.moyu-idle.com/，欢迎大家分享讨论、分享攻略与心得！',
      ]
    },
    {
      date: '2026-01-29',
      type: 'primary',
      content: [
        '优化：可用专精点显示优化',
        '优化：动作布局间隔调整',
        '调整：在进入新战斗时，上一回合没有行动过的单位，将进行一次额外的数据更新：',
        ' - 携带的状态的持续时间 -1',
        ' - 技能的冷却时间 -1（如果未被封印)',
        ' - 战斗物品袋中食物的冷却时间 -1',
        '调整：现在“战斗物品袋”中的食物，可以选择在战斗开始时、自身回合开始时使用。',
        ' - 可在对应物品的“使用逻辑”中设置',
        ' - 默认为自身回合开始时使用',
        '修复：state:silence 后无法使用普通攻击的问题',
        '修复：点击左上角logo后无法跳转到首页问题',
      ]
    },
    {
      date: '2026-01-26',
      type: 'primary',
      content: [
        '修复：移动端聊天框问题',
      ]
    },
    {
      date: '2026-01-26',
      type: 'primary',
      content: [
        '新增：为硬核猫的战斗房间新增了“金币/战利品比例”配置项',
        ' - 拖动滑块可以调整战斗中获得的金币数量与战利品掉落概率的比例',
        ' - 战利品掉落概率为最终乘算',

        '优化：调整了移动端菜单显示方式，现在移动端点击左上角的菜单按钮后，会弹出全屏的侧边栏菜单。',
        '优化：优化了“强化”界面的物品选择界面',
        '优化：优化了“强化”->“可强化物品”界面在移动端的展示',
        '优化：优化了市场、仓库、商业街的打开速度',

        '优化：“拍卖行”新增了“即将成交”栏目',
        ' - 其中会显示2小时内将成交的拍卖',

        '优化：优化了“炼金台”中，当玩家未达到配方所需属性要求时，对应属性要求的显示效果。',

        '调整：“大麻烦”结算时，根据伤害排名获得额外掉落概率提升：',
        ' - 伤害前25的队伍，获得额外100%掉落概率提升(*200%)',
        ' - 伤害前125的队伍，获得额外50%掉落概率提升(*150%)',
        ' - 每个分段不叠加',

        '修复：resource:knowledgeCrown 佩戴不同强化等级时，可选择的技能数量异常问题。',
        '修复：强化界面中，强化所需材料不足时，对应素材的颜色显示问题。',
        '修复：头像框在一些页面显示层级异常问题。',

        '下次更新后：',
        '在进入新战斗时，上一场战斗中没有经过回合的单位身上的状态持续时间将会-1',
      ]
    },
    {
      date: '2026-01-26',
      type: 'primary',
      content: [
        '修复：强化界面中，所需材料数量显示异常问题。',
      ]
    },
    {
      date: '2026-01-25',
      type: 'primary',
      content: [
        '新增：现在战斗房间可以设置“自动挑战大麻烦”。',
        ' - 房主可以在任意时间设置“自动挑战“大麻烦””。',
        ' - 当设置自动挑战的“大麻烦”战斗可以被加入时(到达开始时间、未到达结束时间、尚未被击败)，将在当前副本的一场战斗胜利后，自动开始“大麻烦”战斗。',
        ' - “大麻烦”战斗结束后，将自动回归到先前地图的战斗中。',
        '新增：头像框。',
        ' - 可以在“个人信息”->“个性化”中选择。',
        ' - 可以在“商店”->“赞助积分商店”中购买。',
        '优化：现在可以通过点击“大麻烦”卡片中“查看详情”，来显示此场“大麻烦”战斗的敌人详细信息。',
        '优化：优化了商店界面商品布局。',
        '优化：附带技能的装备（如resource:blinkshadowGirdle resource:knowledgeCrown+5）重新装备时，对应的技能配置将会自动恢复到脱下装备前的配置。',
        '优化：“公会”->“成员”中现在显示公会当前人数',
        '修复：强化时需要消耗与自身相同的物品进行强化时，消耗数量计算错误问题。',
        '修复：百分比防御穿透超过100%时，不会造成额外伤害问题。',
        '修复：固定防御穿透超出目标当前防御时，百分比防御穿透不会生效问题。',
        ' - 现在将先计算百分比防御穿透，再计算固定防御穿透。',
        ' - 如果目标防御为0，则百分比防御穿透将不会进行计算，仅计算固定防御穿透。',
        ' - 如果某次伤害“无视防御”，则视为目标防御为0。',
      ]
    },
    {
      date: '2026-01-19',
      type: 'primary',
      content: [
        '新增：“词典”中添加了“物品”分类',
        '修复：resource:fallenStarAmulet+5 智力加成异常问题',
        '修复：resource:patchworkHideCloak 属性叠加问题',
        '修复：使用物品时，如果此物品会为你添加相同的物品的库存，则返还的物品可能会丢失问题',
        '修复：部分文本错误',
        '调整：“征战圣火纪念碑”的供奉奖励中添加了“契约”类物品。相应调整了“一级战利品”的产出概率',
        '其他：称号设置，从“基本信息”->“称号”，移动到“个性化”->“称号”',
      ]
    },
    {
      date: '2026-01-18',
      type: 'primary',
      content: [
        '新增：“生活专精”->“特殊制造”',
        '新增：扩展了“战斗专精”->“攻击专精”树',
      ]
    },
    {
      date: '2026-01-16',
      type: 'primary',
      content: [
        '新增：resource:patchworkHideCloak',
        '新增：resource:alchemicExtractor resource:alchemicEtherPump',
        '新增：“生活专精”->“炼金”',
        '优化：加强了垂钓期间任务队列不会执行的提示效果',
        '优化：优化了每次更新后，部分用户出现的玩家队列或猫咪助手队列停止，需要重新添加任务后队列才会继续执行的问题',
      ]
    },
    {
      date: '2026-01-15',
      type: 'primary',
      content: [
        '修复：动作中资源的消耗/库存始终显示为0的问题',
      ]
    },
    {
      date: '2026-01-13',
      type: 'primary',
      content: [
        '优化：优化了房间状态同步逻辑',
        '优化：现在“已耗尽”状态的契约将从房间内的契约列表中删除',
        '调整：state:venom',
        '修复：市场相关通知内容空白问题',
        '其他：赞助商店新增6款聊天气泡样式，购买后在仓库中使用即可解锁对应样式',
        '其他：赞助商店新增”聊天气泡颜色自定义服务“，购买后在仓库中使用，即可在个性化界面自定义聊天气泡颜色',
      ]
    },
    {
      date: '2026-01-13',
      type: 'primary',
      content: [
        '调整：现在只要房间内任意玩家对“大麻烦”造成过伤害，即使后续离开了“大麻烦”战斗，这个房间的玩家就可以参与战利品结算。',
        ' - 参与战斗所获的奖励，将在结束结算完成后（通常5分钟内），发放到玩家的收获箱中。',
        '调整：现在当某个“大麻烦”被击败后，未参与战斗的玩家，可以在战斗结算完成后，在此“大麻烦”下一轮战斗开始前，在这个“大麻烦”对应的卡片内领取一次奖励，此时存在一些特殊规则：',
        ' 1. 对于100%掉落的物品，获取的数量降低35%',
        ' - 例，某“大麻烦”100%掉落100000-200000金币，则通过此方式，只能获得65000-130000金币',
        ' - 向下取整，对于100%只掉落1个的物品，则总是至少获得1个',
        ' 2. 对于非100%掉落的物品，则获取概率降低80%。',
        ' - 例：某战利品的掉落率为5%，则通过此方法获取奖励时，此战利品的获取概率为5% * 0.2 = 1%',
        '调整：state:burn skill:corrosiveBreath',
        // '调整：resource:decorate9UnlockItem_sponsorShop现在可在“赞助商店”中购买',
        '修复：“大麻烦”排行榜排序问题',
        '修复：战斗房间分享有时会出现“内容不合法”报错问题',
        '优化：降低了移动端长按后弹出详细信息的响应时间，避免触发移动端复制功能',
      ]
    },
    {
      date: '2026-01-09',
      type: 'primary',
      content: [
        '新增：“大麻烦”',
        ' - “大麻烦”是一类全服Boss挑战。',
        ' - 它们大多非常强大，需要大家齐心协力才能击退。',
        ' - 它们的血量将在不同战斗中共享并保存战斗进度。因此不必担心因战斗失败导致进度丢失。',
        ' - 当它们被击败时，处在**战斗中**的队伍将会获得战斗奖励。',
        ' - 你可以提前设置击败Boss后的动作，选择在房间中等待或者自动开始副本探索。',
        '优化：商业街现在支持按照商品种类过滤店铺',
        '优化：优化了战斗房间各状态的倒计时显示',
        '优化：优化了移动端下物品详细信息的显示逻辑，从原先的点击显示详细信息，改为长按后弹出详细信息',
        '调整：延长了公会建筑“猫猫大澡堂”获取“热水澡”效果的持续时间',
        '调整：调整了resource:traitorsOathPact的配方，其中的[星尘]改为[暗影]',
        '调整：现在各类异变契约可以通过炼金合，使用6份基础契约作为基础材料合成获得。需要42神秘等级。',
        '调整：降低了市场交易间隔限制',
        '修复：重复添加不可叠加的契约时，契约会丢失问题。请遇到此问题的玩家携带截图填写反馈单进行补偿',
        '其他：现在可以通过window.tAllGameResource与window.tAllEnhanceInfo来获取游戏内资源与强化信息。',
      ]
    },
    {
      date: '2026-01-09',
      type: 'primary',
      content: [
        '调整：调整了各类战斗契约的持续时间。之前使用过的可以携带截图填写反馈。',
      ]
    },
    {
      date: '2026-01-00',
      type: 'primary',
      content: [
        '新增：战斗契约',
        ' - 可以在战斗房间中加入战斗契约，契约通常会给战斗带来全局性的效果',
        ' - 各类契约可以通过“炼金”获得',
        '优化：优化了市场数据的加载速度',
        '优化：降低战斗房间在不同服务间调度时，出现异常重启情况的概率',
        '修复：猫咪特性无法获得经验问题',
        '修复：“市场”->“上架记录”界面中，因分页导致上架上限、求购上限、列表筛选异常问题',
        '修复：“自我提升”动作中，在同时聘请了“老师猫猫”与“健身教练猫猫”时，部分动作中额外经验奖励的来源显示错误问题',
        '修复：特殊情况下，部分蛋挞状态与“猫猫大澡堂”的“热水澡”的状态不会显示的问题',
        '修复：resource:clawFallenRadiance resource:clawVowedRadiance 对非物理伤害也生效的问题',

        // '调整：迷雾中遇到的玩家幻象，在战斗开始前会移除其携带的来自契约的状态',
      ]
    },
    {
      date: '2026-01-04',
      type: 'primary',
      content: [
        '修复：聊天界面发送消息时异常问题',
        '调整：其他地图的迷雾模式中怪物的强度与经验基准将被同步为“猫影深渊·回响地牢”',
      ]
    },
    {
      date: '2026-01-03',
      type: 'primary',
      content: [
        '新增：猫影深渊·回响地牢[迷雾模式]',
        '新增：“酒馆”->“健身教练猫猫”',
        '优化：“市场”->“上架记录”页面添加分页',
        '优化：物品相关信息中添加了“从物品中获得”分类',
        '优化：现在玩家可以重置自己在房间内战利品统计信息',
        '修复：resource:shadowTalonFang 状态叠加异常问题',
        '修复：通过公会建筑“猫猫大澡堂”获取“热水澡”效果后，效果不会立即生效问题',
        '修复：配装方案中装备槽位最多只能显示三排装备无法滚动问题',
        '修复：技能如果未造成伤害，不会体现在动画与文字日志中的问题',
        '修复：部分文本错误处理',
        '调整：现在公会会长15天不在线后，如果公会内没有活跃的组长猫猫，则公会会长角色将转移给最近在线的成员猫猫',
        '调整：state:furryStaticElectricity resource:fluffMageGloves+3',
        '调整：resource:cuteHat 颜色调整',
        // '---',
        '下次更新后：',
        '调整：其他地图的迷雾模式中怪物的强度与经验基准将被同步为“猫影深渊·回响地牢”',
      ]
    },
    {
      date: '2026-01-02',
      type: 'primary',
      content: [
        '调整：resource:eternalNightStaff的制作消耗，已经制作的可以携带截图填写反馈单进行补偿',
      ]
    },
    {
      date: '2026-01-02',
      type: 'primary',
      content: [
        '新增：resource:leftoverPendant resource:shadowTalonFang resource:eternalNightStaff',
        '新增：鱼获批量出售',
        '新增：商业街店铺置顶服务',
        '新增：现在称号在未启用时，也会提供部分加成效果（需重新选择一次称号后生效）',

        '优化：优化了强化概率的显示方式',
        '修复：state:proof 无效问题',

        '调整：resource:darkingHeart 可达到的最大伤害减免为90%',
        '调整：“垂钓”菜单移动至“家园”->“垂钓”',
        // '---',
        '下次更新后：',
        '调整：迷雾中怪物的强度与经验基准将被同步为“猫影深渊·回响地牢”',
        // '调整：通过 resource:intertwinedCatEyeGenesisEssenceStaff 释放 skill:knowledgeCrownSkill时，现在会统计每个子技能冷却时间',
        // '调整：resource:intertwinedCatEyeGenesisEssenceStaff的魔法消耗，改为每释放的技能每包含1回合冷却，额外消耗0.3%最大魔法值',
      ]
    },
  ],
  2025: [
    {
      date: '2025-12-26',
      type: 'primary',
      content: [
        '新增：resource:murkyShadowLens',
        '新增：公会建筑-猫猫大澡堂',
        '新增：现在祈福获得的称号可以提供属性或其他加成效果',
        '优化：resource:intertwinedCatEyeGenesisEssenceStaff 在配置技能时，会显示所配置技能的顺序',
        '优化：现在手动结束垂钓后，剩余饵料将会返还至收获箱',
        '修复：市场中点击“最近有交易的商品”时，不会跳转到对应商品的市场详情问题',
        '修复：resource:dreadVisor+5 描述缺失问题',
        '修复：resource:riposteAmulet 不生效问题',
        '修复：部分用户登录时的500问题',
        '调整：resource:darkingCuteSword 每个回合最多触发1次的问题',
        '调整：resource:fluffDexPants 每个回合现在最多触发4次',
        '调整：skill:revive 复活后的单位最多回复至30%魔法值',
        // '调整：暂时去除各装备特殊效果的执行延迟',
        '修复：部分文本错误',
        '其他：补充“词典”->“垂钓”->“饵料”',
      ]
    },
    {
      date: '2025-12-23',
      type: 'primary',
      content: [
        '新增：resource:fallenStarAmulet resource:darkingHeart resource:dreadVisor',
        '新增：战斗房间选项：公开战利品信息',
        ' - 当房主开启此选项后，在战斗房间中查看此房间到目前为止各成员的战利品掉落情况。战利品信息最多可在房间停止战斗后保留6小时',
        ' - 当前展示的信息为从2025-12-23 14:00后开始统计的数据',
        '新增：本地当前战斗日志导出',
        '优化：调整了各战斗服务器之间的负载',
        '修复：战斗中计算耐力经验时存在的问题',
        '调整：resource:darkingCuteSword 的效果每个回合最多触发5次',
        // '调整：暂时禁用 resource:starforgedAlloylCoat',
        '其他：“个人信息”中添加了“关闭登录时邮箱验证”，勾选后将不会在登录时强制进行邮箱验证。请在确保登录环境及账号安全的情况下使用此功能。',
      ]
    },
    {
      date: '2025-12-22',
      type: 'primary',
      content: [
        '新增：resource:patchworkHideShoes',
        '优化：拍卖行中物品数量信息显示优化',
        '调整：现在垂钓将根据鱼获提供经验',
        '调整：resource:genesisEssenceOwlQuillpen+6 及后续强化等级',
        '调整：skill:knowledgeCrownSkill不再拥有自身的魔法消耗',
        '调整：释放 skill:knowledgeCrownSkill时，现在会消耗对应子技能的魔法值，如果魔法值不足则不会释放对应的子技能',
        '调整：resource:eternalGuardianAmulet 的伤害加成效果仅在迷雾中生效问题',
        '调整：resource:eternalGuardianAmulet，现在如果玩家没有普通战斗回合，免疫致命伤害效果将不再触发',
        '调整：现在每个玩家在初始状态下，最多只能拥有6个属于自己的召唤物。',
        '修复：skill:clownSummon召唤数量异常问题',
        '修复：resource:fluffMageGloves 错误提供敏捷属性问题',
        '修复：resource:starforgedAlloylCoat 的星辉奔涌效果不生效问题',
        '修复：“猫舍”->“随记”中切换不同猫咪助手的标签并进行分页切换操作时，总是会加载第一只猫咪助手的随记问题',

        '修复：断开连接提示中的“刷新”无法点击问题',
        // '其他：现在玩家可以选择将自己在排行榜中隐藏',
      ]
    },
    {
      date: '2025-12-22',
      type: 'primary',
      content: [
        '新增：鱼获回收',
        '新增：“词典”->“垂钓”',

        '---',
        '下次更新后：',
        '调整：skill:knowledgeCrownSkill不再拥有自身的魔法消耗',
        '调整：释放 skill:knowledgeCrownSkill时，现在会消耗对应子技能的魔法值，如果魔法值不足则不会释放对应的子技能',
        // '其他：现在玩家可以选择将自己在排行榜中隐藏',
      ]
    },
    {
      date: '2025-12-21',
      type: 'primary',
      content: [
        '新增：“镇中心”->“垂钓”',
        '新增：“商店”->“水产商店”',

        '---',
        '下次更新后：',
        '调整：skill:knowledgeCrownSkill不再拥有自身的魔法消耗',
        '调整：释放 skill:knowledgeCrownSkill时，现在会消耗对应子技能的魔法值，如果魔法值不足则不会释放对应的子技能',
        // '其他：现在玩家可以选择将自己在排行榜中隐藏',
      ]
    },
    {
      date: '2025-12-12',
      type: 'primary',
      content: [
        '新增：resource:arcaneResonanceBracers resource:patchworkHideGarb resource:cuteSword',
        '新增：resource:genesisEssenceOwlQuillpen resource:genesisEssenceFangNecklace',
        '修复：skill:clownSummon召唤数量异常问题',
        '调整：resource:fluffDexPants',
        '调整：resource:moonlightStaff resource:mewShadowStaff 不显示强化等级问题',
        '优化：补种异常问题',
        '优化：部分情况下自动强化会中断问题',
        '优化：战斗文字日志顺序异常问题',

        '---',
        '下次更新后：',
        '调整：skill:knowledgeCrownSkill不再拥有自身的魔法消耗',
        '调整：释放 skill:knowledgeCrownSkill时，现在会消耗对应子技能的魔法值，如果魔法值不足则不会释放对应的子技能',
        // '其他：现在玩家可以选择将自己在排行榜中隐藏',
      ]
    },
    {
      date: '2025-12-12',
      type: 'primary',
      content: [
        '修复：部分用户登录后会闪退问题',
      ]
    },
    {
      date: '2025-12-07',
      type: 'primary',
      content: [
        '修复：公会仓库无法提取经过强化的物品',
        '修复：触发复活效果后，部分状态未能正确触发移除效果的问题',
      ]
    },
    {
      date: '2025-12-06',
      type: 'primary',
      content: [
        '新增：resource:intertwinedCatEyeGenesisEssenceStaff resource:lumenCodex resource:umbralCodex resource:blinkshadowGirdle',
        '新增：skill:beastpackRoar',
        '优化：公会仓库提取',
        '修复：硬核猫锚账号无法兑换赞助点数包的问题',
        '调整：“魔法书”、“附灵”、“造物精华”类的相关动作，从“炼金”移动至“特殊制造”',
      ]
    },
    {
      date: '2025-11-30',
      type: 'primary',
      content: [
        '修复：自定义上传头像无法使用的问题',
        '修复：绑定邮箱界面，无法对现有邮箱进行修改问题',
      ]
    },
    {
      date: '2025-11-30',
      type: 'primary',
      content: [
        '新增：猫咪助手的“特性”',
        ' - 猫咪助手会在工作、记录随记、与其他猫咪助手的交互过程中，获得“特性”',
        ' - 猫咪助手工作、记录随机时，有几率领悟一个随机特性',
        ' - 猫咪助手在与非自己玩伴的猫咪助手交互时，有几率领悟一个随机特性',
        ' - 猫咪助手在与自己的玩伴交互时，有几率从对方身上学习一个随机特性',
        ' - “特性”会为猫咪助手或者猫咪助手的主人提供一些效果，这些效果有正面的也有负面的',
        ' - 重复获得相同“特性”时，此特性会获得额外经验，并在达到经验要求时，升级此“特性”的效果。正面与负面特性均可被升级。',
        ' - 负面特性可以通过消耗资源来清除',

        '新增：猫咪助手的“心情”',
        ' - “心情”代表了猫咪助手当前的心理状态',

        ' - “心情”上限可以超过100，上限超过100时，会以每小时2点的速度回落至100。',
        ' - “心情”上限最大不超过200。',
        ' - 通过喂食以及特性导致当前“心情”的提升效果，可以超过当前心情上限，超过上限的部分，会以每小时5点的速度回落至上限。',

        ' - “心情”>=180时，会为猫咪助手提供3%的工作效率奖励',
        ' - “心情”>=140时，会为猫咪助手提供3%的工作效率奖励',
        ' - “心情”>=90时，会为猫咪助手提供2%的工作效率奖励',

        ' - “心情”<=10时，会降低猫咪助手50%的工作效率',

        ' - 当猫咪助手处于非工作状态时，每小时恢复5点心情值',
        ' - 当猫咪助手处于工作状态时，每小时降低1.5点心情值',

        ' - 在每天13:00时，如果猫咪助手的当前“心情”超过90，猫咪助会额外提供1点心意点数',
        ' - 在每天19:00时，如果猫咪助手的当前“心情”超过130，猫咪助会额外提供1点心意点数',

        ' - 猫咪助手的饮食、随记、特性、猫舍家具会对心情产生正面或负面的影响',

        '以下物品在喂食猫咪助手时，会产生心情变化:',
        ' - resource:catMint resource:catSnack resource:luxuryCatFood resource:sashimiPlatter resource:cannedTuna resource:cannedShrimp resource:cannedRainbowFish resource:cannedMysticalKoi resource:cannedCrystalCarpTuna resource:cannedCrystalCarpShrimp resource:cannedCrystalCarpRainbowFish resource:cannedCrystalCarpMysticalKoi',
        '以下物品在喂食猫咪助手时，会产生最大心情变化:',
        ' - resource:luxuryCatFood resource:sashimiPlatter',

        '新增：resource:silkCurtain',
        '新增：resource:cuteIronBox',
        '新增：resource:dragonScaleGenesisEssencArmor',
        //  resource:intertwinedCatEyeGenesisEssenceStaff
        '新增：一类精华点金术',

        '调整：resource:goldenEgg',

        // '新增：赞助商店新增了“自由上传头像”服务',
        '优化：店铺可以编辑已上架商品的相关信息',
        '优化：现在可以在“好友”->“推荐”中查看自己的邀请人',
        '优化：收获箱 现在可以快速领取所有未领取的物品',
        '优化：现在物品详细信息界面会显示此物品的商店售价与市场最低售价',
        '其他：忘记密码功能',
        '其他：添加了邮箱绑定验证功能，可在界面右上角->"绑定邮箱"中进行绑定。',
        '其他：现在部分功能需要进行邮箱验证后才能够使用，如：',
        ` - 市场：上架/购买 单价 > ${formatNumber(MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL)}金币的订单`,
        ` - 市场：上架/购买 数量 > ${formatNumber(MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL)}的订单`,
        ` - 市场：求购/出售 单价 > ${formatNumber(MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL)}金币的订单`,
        ` - 市场：求购/出售 数量 > ${formatNumber(MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL)}的订单`,
        ` - 市场：使用非金币支付的求购订单`,
        ' - 拍卖行（上架、竞拍）',
        ' - 商业街（上架、购买）',

        `其他：添加了自定义上传头像的功能，历史总赞助点数（赞助行为、邀请玩家）达到 ${CUSTOM_AVATAR_MIN_SPONSOR_POINTS} 点的玩家可使用此功能`,
      ]
    },
    {
      date: '2025-11-10',
      type: 'primary',
      content: [
        // '新增：猫咪助手的“特性”',
        // ' - 猫咪助手会在工作、记录随记、与其他猫咪助手的交互过程中，获得“特性”',
        // ' - 猫咪助手工作、记录随机时，有几率领悟一个随机特性',
        // ' - 猫咪助手在与非自己玩伴的猫咪助手交互时，有几率领悟一个随机特性',
        // ' - 猫咪助手在与自己的玩伴交互时，有几率从对方身上学习一个随机特性',
        // ' - “特性”会为猫咪助手或者猫咪助手的主人提供一些效果，这些效果有正面的也有负面的',
        // ' - 重复获得相同“特性”时，此特性会获得额外经验，并在达到经验要求时，升级此“特性”的效果。正面与负面特性均可被升级。',
        // ' - 负面特性可以通过消耗资源来清除',
        // '新增：猫咪助手的“心情”',
        // ' - “心情”代表了猫咪助手当前的心理状态',
        // ' - “心情”超过100时，会为猫咪助手提供额外的工作效率奖励',
        // ' - “心情”小于60时，会降低猫咪助手的工作效率',
        // ' - 当猫咪助手处于非工作状态时，每小时恢复3点心情值',
        // ' - 当猫咪助手处于工作状态时，每小时降低2点心情值',
        // ' - 猫咪助手的随记、特性、猫舍家具会对心情产生正面或负面的影响',
        '调整：“征战圣火纪念碑”的供奉奖励中增加了四级战利品',
        '调整：队列动作的最小值从不会少于基础值的33%，调整为不会少于基础值的10%',
        '修复：玩家店铺货架上限扩展后，可上架商品数量依旧为3的问题',
      ]
    },
    {
      date: '2025-11-09',
      type: 'primary',
      content: [
        '修复：求购上限扩展后，求购上限依旧为5的问题',
      ]
    },
    {
      date: '2025-10-31',
      type: 'primary',
      content: [
        '新增：resource:battleKnowledgeCocktail',
        '新增：resource:nightmare_prison_expedition_map resource:nightmare_prison_expedition_denseFog_map',
        '新增：酒馆专家——卷王助教喵，能够帮助你提升所有队列动作的经验获取',
        '调整：resource:starforgedAlloylCoat的“星辉奔涌”造成的伤害现在可以触发各类被动效果',
        '调整：提高了“猫影深渊·回响地牢”每波敌人的数量',
        '调整：调整了一些基础锻造及缝纫所需物资',
        ' - action:sewCashmere action:sewSilkFabric action:sewFluffFabric',
        '调整：现在可以通过消耗资源来提升“祝福”的持有上限',
        '调整：现在可以通过消耗战斗等级来提升“祝福”的启用上限',
        '调整：现在可以通过消耗资源来对“祝福”进行稀有度升级',
        '调整：现在可以通过消耗资源来提升市场的上架订单与求购订单上限（在市场->上架记录中进行扩展）',
        '调整：现在可以通过消耗资源来提升玩家店铺的货架数量上限',
        '调整：现在队列动作的最小值为3秒，且不会少于基础值的33%',
        '调整：调整了“猫咪自学点金术”、“基础点金术”系列动作的耗时与物品消耗，提升了金币奖励数量',
        '调整：提升了硬核猫的可创建数量',
        '优化：为state:cdhbFormShift添加了state:cdhbFormShift_P 和 state:cdhbFormShift_M 两个新状态，用于状态判断',
        '优化：提高了任务中的resource:gold奖励数量，仅针对更新后的新任务或更新后重随的任务生效',
        '优化：优化了“祝福”界面在夜间模式下的显示效果',
        '优化：仓库现在可以收藏物品',
        '修复：玩家店铺在一段时间后无法显示问题',
      ]
    },
    {
      date: '2025-10-31',
      type: 'primary',
      content: [
        '新增：action:refineMoonPearl',
      ]
    },
    {
      date: '2025-10-30',
      type: 'primary',
      content: [
        '调整：畜牧专家现在能够对action:pearlCultivation生效',
      ]
    },
    {
      date: '2025-10-30',
      type: 'primary',
      content: [
        '调整：迷雾现在不会出现“猫影深渊·回响地牢”中的敌人',
      ]
    },
    {
      date: '2025-10-30',
      type: 'primary',
      content: [
        '新增：resource:eternalGuardianAmulet',
        '新增：resource:shinyIronSword',
        '新增：action:pearlCultivation',
        '新增：新增了一些专精',
        '新增：祝福',
        '新增：猫影深渊·回响地牢',
        '调整：现在公会内的“组长猫猫”也可以执行踢出成员操作',
        '调整：现在公会会长15天不在线后，公会会长角色将转移给最近在线的组长猫猫',
        '修复：resource:domination_seal 回合外伤害伤害减免效果不正确问题',
      ]
    },
    {
      date: '2025-10-17',
      type: 'primary',
      content: [
        // '新增：resource:shinyIronSword',
        '新增：公会建筑-猫猫大屋',
        '新增：城镇建筑-猫猫小镇纪念碑现在可以进行祈福',
        '调整：resource:domination_seal+5 现在只能统御1个技能',
        '调整：resource:domination_seal+5 现在不对友军生效',
        '修复：resource:manufactureAndForgingTart和resource:manufactureAndForgingTartLv2对锻造类动作无效问题',
      ]
    },
    {
      date: '2025-10-13',
      type: 'primary',
      content: [
        '修复：resource:overloadCrown强化失败后，返回的物品异常问题',
      ]
    },
    {
      date: '2025-10-13',
      type: 'primary',
      content: [
        '新增：resource:clawFallenRadiance resource:clawVowedRadiance',
        '新增：resource:phantomWalkerBoots',
        '新增：resource:domination_seal resource:overloadCrown',
        '新增：现在可以用赞助积分兑换 resource:goldPack',

        '新增：城镇建筑-征战纪念碑',

        '优化：优化了每次更新后加载游戏内容的速度',

        '调整：resource:cuteHat 现在可以被强化',
        '调整：现在每个玩家拥有8个基础上架订单栏位',
        '调整：心意点数商店添加了一些物品的回收',
        '调整：在战斗状态中，将无法对战斗装备进行调整',
        '调整：resource:otherworldCrystalPendant 的“噬界”效果，在自身回合开始前，最多触发20次',

        '修复：resource:genesisEssenceShadowSteelSword 可能导致的最大生命值无限叠加问题',
        '修复：一些文本错误',
      ]
    },
    {
      date: '2025-10-07',
      type: 'primary',
      content: [
        '新增：消息屏蔽功能',
        '修复：部分专精节点等级超过9级后效果消失问题',
        '修复：专精:大法师 描述错误问题',
        '修复：专精:魔力增幅 加成异常问题',
        '修复：弓类武器触发自动攻击异常问题',
        '修复：自动收获后，作物在收获箱内不会合并问题',
        '修复：resource:spiritfeatherBow 现在通常情况下不再会被对友军的魔法消耗所触发',

        '优化：现在可以查看玩家近期的昵称修改记录',
        '优化：优化了自动补种逻辑',
        '优化：优化了战斗结算逻辑',
        '优化：删除好友操作添加了二次确认',
        // '其他：resource:bookOfBattleSkillTreePoint的制作补偿已发放完毕，有部分因信息不完整未发放的玩家请携带完整信息提交反馈',
      ]
    },
    {
      date: '2025-10-02',
      type: 'primary',
      content: [
        '调整：调整了收获箱的物品堆叠逻辑',
        '调整：调整了resource:bookOfBattleSkillTreePoint的制作需求',
        '其他：会给每位玩家发放resource:bookOfBattleSkillTreePoint x20',
      ]
    },
    {
      date: '2025-10-02',
      type: 'primary',
      content: [
        '修复：聊天内非公共消息显示延迟问题',
        '修复：无法直接在 ”上架记录”进行下架、撤单问题',
        '调整：调整了一些专精效果',
        '调整：调整了resource:bookOfBattleSkillTreePoint的制作需求',
        '其他：目前需要找回密码的请在提交反馈信息时留下邮箱',
      ]
    },
    {
      date: '2025-09-25',
      type: 'primary',
      content: [
        '新增：专精',
        '优化：市场交易相关动作的库存变动记录，添加了交易物品的数量与单价信息',
        '优化：市场上架记录添加排序',
        '修复：种植等级刚好满足要求时，依旧无法进行作物种植问题',
        '其他：resource:fertYieldIncrease的配方中，额外添加了resource:shell',
        '其他：国庆期间离线时间上限调整为8天',
      ]
    },
    {
      date: '2025-09-24',
      type: 'primary',
      content: [
        '修复：小镇建筑升级时，建筑物加成不生效问题',
      ]
    },
    {
      date: '2025-09-24',
      type: 'primary',
      content: [
        '新增：小镇建筑现在可以升级至2级',
        '新增：resource:owlQuillpen resource:twilightFeatherCloak resource:spiritfeatherBow resource:traitorsChains resource:runeCompass',
        '优化：现在可以对未成熟的作物进行清理',
        '优化：现在种植将提供种植经验',
        '调整：部分菜单进行了归类处理，“种植”功能现在移动至“家园”菜单下',
      ]
    },
    {
      date: '2025-09-20',
      type: 'primary',
      content: [
        '修复：resource:animalManure 无法被搜索到的问题',
        '修复：种植动作的持续时间问题',
        '修复：部分全局状态会异常消失问题。如果有玩家因此问题导致效果消失，可以填写反馈获得等量物品补偿。',
        '调整：分解物品时，返还制造消耗的60%原材料，向下取整。如果某个原材料的消耗量为1，则原材料将不会被返还。'
      ]
    },
    {
      date: '2025-09-20',
      type: 'primary',
      content: [
        '修复：蛋挞无法制作问题',
      ]
    },
    {
      date: '2025-09-17',
      type: 'primary',
      content: [
        '新增：种植相关',
        '新增：种植肥料。可以通过畜牧以及炼金获得',
        '新增：“烹饪”->“甜点”',
        '优化：炼金功能无法停止问题',
        '优化：已完成的任务现在可以快速领取全部奖励',
        '优化：现在战斗的文字日志可以保留更多历史条目',
        '修复：多种带有全局状态的食物无法同时使用问题',
      ]
    },
    {
      date: '2025-09-16',
      type: 'primary',
      content: [
        '新增：resource:luckyMint resource:luckySashimiPlatter resource:superLuckyBerryPie resource:superLuckyMushroomStew',
        '新增：炼金台现在可以选择炼金执行次数，在后台自动进行炼金',
        '优化：“角色”菜单中，为玩家属性添加了属性等级明细',
        '优化：“角色”菜单中，添加了“全局效果”显示',
      ]
    },
    {
      date: '2025-09-14',
      type: 'primary',
      content: [
        '新增：skill:chefSkill',
        '调整：skill:demonicRage',
        '优化：为词典的“状态”与“单位”添加了更多分类',
        '修复：resource:fluffDexScarf 无法正确获得state:fluffConcentration 层数问题',
        '修复：resource:monoPolarElixir resource:swiftMonoPolarElixir resource:magicalMonoPolarElixir 会导致属性异常降低问题',
        '修复：获取公会许愿池效果时，许愿池获得的幸运可能会被累加的问题',
        // '修复：state:demonicRage 描述问题',
        '修复：一些文本错误',
      ]
    },
    {
      date: '2025-09-13',
      type: 'primary',
      content: [
        '修复：resource:wardenIronWhip 对队友造成伤害会致死的问题',
      ]
    },
    {
      date: '2025-09-12',
      type: 'primary',
      content: [
        '调整：“噩梦监狱”中可获得的resource:nightmarePrisonChest被替换为resource:nightmarePrisonChestNew',
        '调整：调整了resource:nightmarePrisonChestNew的掉落率',
      ]
    },

    {
      date: '2025-09-12',
      type: 'primary',
      content: [
        '新增：resource:nightmarePrisonChest resource:wardenIronWhip resource:genesisEssenceShadowSteelSword',
        '新增：心意点数商店现在接受部分物品的回收',
        '新增：',
        // '调整：resource:cuteScarf 现在无法从心意商店购买，并暂时以原价进行回收',
        '调整：降低 resource:nutrientEssence resource:knowledgeEssence 的素材需求',
        '调整：降低 action:refineGenesisEssence 的消耗，需要玩家手动调整一次装备后生效',
        '调整：降低与 action:refineGenesisEssence 相关动作中对此资源的消耗',
        '调整：降低了“噩梦监狱”中怪物的金币掉落量',
        '调整：调整了 resource:smokeBall 的文本描述',
        '其他：已经通过炼金获得 resource:nutrientEssence resource:knowledgeEssence 的玩家，可以填写反馈来获得等量额外的resource:nutrientEssence resource:knowledgeEssence（备注id及消耗的材料情况截图）',
        '其他：因resource:nightmarePrisonChest库存数量太多，因此目前其中物品的概率会稍低，后续会根据库存数量进行调整',
      ]
    },
    {
      date: '2025-09-11',
      type: 'primary',
      content: [
        '新增：resource:smokeBall',
        '新增：resource:timeflowCatEyeGenesisEssenceStaff resource:genesisEssenceLuckRainbowRibbon',
        '优化：炼金台中，“选择素材”界面现在会显示库存中已有的素材数量',
        '修复：自动释放逻辑设置->状态判断内，精力充沛的三种状态state:catnipGardenEnergyBoost state:catnipGardenEnergyBoostHpRegen state:catnipGardenEnergyBoostMpRegen，只能选择state:catnipGardenEnergyBoostMpRegen的问题',
        '修复：resource:cuteShoes 强化后图标丢失问题',
        '修复：自身没有行动回合时，resource:shadowSteelHammer 不生效问题',
        '调整：resource:shadowSteelHammer',
        '调整：调整了以下装备的强化素材 resource:cuteOutfit resource:cuteShoes resource:cuteBracelet resource:cuteDoll resource:cuteDress resource:guideBadge resource:pathfinderBadge',
      ]
    },
    {
      date: '2025-09-09',
      type: 'primary',
      content: [
        '调整：为以下装备添加了装备战斗等级限制 resource:lv1BattleExpCollector resource:lv1EnemySpoilCollector resource:lv2EnemySpoilCollector resource:lv3EnemySpoilCollector resource:lv4EnemySpoilCollector',
      ]
    },
    {
      date: '2025-09-09',
      type: 'primary',
      content: [
        '新增：resource:lv1EnemySpoilCollector resource:lv2EnemySpoilCollector resource:lv3EnemySpoilCollector resource:lv4EnemySpoilCollector',
        '新增：resource:ryeBread resource:cannedCrystalCarpTuna resource:cannedCrystalCarpShrimp resource:cannedCrystalCarpRainbowFish resource:cannedCrystalCarpMysticalKoi',
        '新增：resource:shadowSteelHammer',
        '新增：添加了2个新的饰品槽位',
        // '优化：优化了战斗执行效率',
        // '优化：优化了大猫咪和猫咪助手队列执行效率',
        '优化：建筑的募集信息现在按照建筑等级分类展示',
        '优化：优化了一些功能的提示文字',
        '调整：resource:shadowSteelScythe',
        '调整：resource:grapeMilkManaShake resource:grapeWindBellMilkShake',
        '调整：调整了公会建筑筹备升级时，建筑功能按钮的显示位置',
        '调整：炼金台中，“选择素材”界面调整',
        '调整：查看所有可强化物品界面调整',
        '调整：现在当所有玩家阵营中的单位都阵亡时，才会结算为玩家失败。',
        '修复：装备resource:otherworldCrystalPendant后，即使战斗胜利，也会结算为玩家失败的问题。',
        '修复：装备resource:empressCloak后，即使战斗胜利，也会结算为玩家失败的问题。',
        '修复：公会建筑-许愿池，在许愿池筹备升级期间无法进行许愿问题',
        '修复：resource:starDustMagicBook的“彗星打击”效果，在普通攻击后不会触发的问题',
        '修复：猫咪助手行动进度条显示不准确问题',
        '修复：一些文本问题修复',
      ]
    },
    {
      date: '2025-09-07',
      type: 'primary',
      content: [
        '新增：心意点数商店',
        '新增：赞助商店新增3款个人信息背景',
      ]
    },
    {
      date: '2025-09-06',
      type: 'primary',
      content: [
        '新增：resource:grapeMilkManaShake resource:grapeWindBellMilkShake',
        '新增：公会建筑现在可以进行升级',
        '新增：公会建筑 - 迷雾指引图腾',
        '新增：现在“角色”页面可以查看通过各种途径获取的全局状态',
        '修复：渲染造成造成伤害动画时，有时会出现单位受到伤害后生命为负数且显示为阵亡，但实际并未阵亡的问题',
        '修复：resource:forbidden_library_expedition_map 无掉落问题',
        '修复：state:banished 现在不会对没有回合的单位生效',
        '修复：“在其他单位行动后”效果，有时会触发两次的问题',
        '修复：部分技能文本描述问题',
        '修复：酒馆专家猫猫，在暂停后依旧会带来额外产出问题',
        '修复：酒馆专家猫猫，在特殊情况下会导致暂停状态消失但客户端数据未同步问题',
        '调整：resource:starforgedAlloylCoat',
        '调整：从公会建筑获取全局状态时，添加了二次确认',
      ]
    },
    {
      date: '2025-09-06',
      type: 'primary',
      content: [
        '新增：现在可以查看玩家最近活跃时间',
        '新增：添加了 resource:forbidden_library_expedition_map resource:forbidden_library_expedition_denseFog_map',
        '修复：修复了 resource:starforgedAlloyGloves 与 resource:starDustMagicBook+5 导致的无限触发问题',
        '修复：修复了 resource:shadowSteelSword 能够在回合外触发治疗效果的问题',
        '修复：resource:murkyCrystalDagger 会被无限触发的问题',
        '修复：resource:murkyCrystalDagger 需求的是制造等级而非锻造等级的问题',
        '修复：优化了酒馆专家的缓存更新逻辑',
        '修复：药剂效果在阵亡后没有保留的问题',
        '修复：state:shield 文本描述问题',

        '修复：resource:fishscaleMineralPants+9 resource:fishscaleMineralPants+10 耐力属性加成错误问题',
        '调整：resource:cashmereSingleCloak resource:cashmereSingleDexCloak resource:cashmereSingleCloakPlus',

        '调整：resource:echoBellCharm 创建的幻象单位继承装备者的最大生命值',

        '调整：resource:breezeElixir 去除了“风息”炼金标签',

        '',
        '下周六起，若连续<span class="font-bold text-md mx-2">3天</span>未登录，大猫咪与猫咪助手就会开始摸鱼，操作队列将自动暂停。再次上线时恢复队列执行，并提示总暂停的时间。',
      ]
    },
    {
      date: '2025-09-05',
      type: 'primary',
      content: [
        '新增：resource:libraryKingBadge resource:knowledgeCrown',
        '调整：resource:bookOfStrength resource:bookOfDexterity resource:bookOfIntelligence 提供的经验提升',
        '调整：复习活动需要的战斗经历从2提升至10 action:compileStrengthBook action:compileDexterityBook action:compileIntelligenceBook',
        '修复：resource:guideBadge resource:pathfinderBadge 通过生活动作提供的经验，对战斗属性（攻击、防御、力量、敏捷、智力、耐力）不生效问题',
        '修复：resource:echoBellCharm 产生的回响会异常消失问题',
      ]
    },
    {
      date: '2025-09-03',
      type: 'primary',
      content: [
        '新增：resource:murkyCrystalStaff resource:murkyCrystalDagger',
        '新增：杀手喵战斗皮肤',
        '调整：resource:starforgedAlloylCoat',
        '修复：以下物品没有制作途径问题：resource:amberGazeOddSignStaff resource:cashmereSingleDexCloak resource:cashmereSingleCloakPlus ',
      ]
    },
    {
      date: '2025-09-03',
      type: 'primary',
      content: [
        '新增：resource:cashmereSingleCloak resource:cashmereSingleDexCloak resource:cashmereSingleCloakPlus',
        '新增：resource:amberGazeOddSignStaff',
        '新增：resource:starforgedAlloyHat resource:starforgedAlloylCoat resource:starforgedAlloyGloves',
        '新增：通过炼金获取 resource:sewingEssence resource:craftingEssence',
        '调整：现在副本的迷雾模式中，每一轮非幻象战斗将至少拥有8个敌人',
      ]
    },
    {
      date: '2025-09-01',
      type: 'primary',
      content: [
        '调整：反击护符对来自玩家单位的伤害，触发概率降低至20%',
        '调整：迷雾战斗胜利结算经验时，提供的额外经验从50%降低至25%经验',
        '调整：迷雾幽灵的普通攻击被替换为skill:denseFogSpriteAttack',
        '调整：迷雾中遭遇的玩家幻象将初始拥有state:denseFogPhantom',
        '调整：迷雾中非幻象敌人掉落resource:denseFogMurkyCrystal resource:denseFogDust的概率提升',
        '调整：迷雾中幻象敌人掉落resource:denseFogMurkyCrystal resource:denseFogDust的概率降低',
      ]
    },
    {
      date: '2025-08-29',
      type: 'primary',
      content: [
        '优化：现在可以在房间配置中选择“自动重新进入迷雾”',
        '调整：迷雾中的敌方幻象小队给予的经验从1000%降低至600%'
      ]
    },
    {
      date: '2025-08-29',
      type: 'primary',
      content: [
        '优化：迷雾中现在将“优先”遇到与自己小组总战斗等级相近的幻象队伍',
        '优化：迷雾中现在将只会遇到与自己小组人数差<=1的幻象队伍'
      ]
    },
    {
      date: '2025-08-29',
      type: 'primary',
      content: [
        '新增：副本房间添加“迷雾”选项',
        '优化：在强化界面中，查看可强化物品时，强化详情表格无法滚动问题',
        '优化：在词典及战斗区域中查看敌人的信息时，将显示敌人进入战斗时的状态',
        '调整：现在无法取消已有玩家出价的拍卖',
        '调整：在拍卖结束前10分钟内有新的出价时，会延长拍卖的结束时间',
        '修复：重随任务会出现报错问题',
        '修复：部分炼金药剂无产出问题',
        '修复：现在使用配方的“使用此配方”功能快速填充炼金台时，将不再会使用当前配方的主要产物作为素材',
        '其他：为现有的战斗皮肤添加了动态头像，已拥有对应皮肤的玩家可在个人信息中进行更换',

        '以下调整已更新：',
        ' 1. “防御”、“有效防御”、“伤害减免”的逻辑调整:',
        ' - 调整前:',
        '   有效防御 = 防御 * (1 - 百分比防御穿透)',
        '   最终受到的伤害 = 伤害 - 有效防御',
        '   ',
        ' - 调整后:',
        '   有效防御 = (防御 - 固定防御穿透) * (1 - 百分比防御穿透)',
        '   伤害减免比例 = (0.0065 * 有效防御) / (1 + 0.0065 * 有效防御)',
        '   有效防御 < 0 时，伤害增幅 = 1 - |(0.0065 * 有效防御) / (1 - 0.0065 * 有效防御}|',
        '   最终受到的伤害 = 伤害 * (1 -  伤害减免比例)',
        '   物理伤害与魔法伤害均基于此关系进行伤害计算',

        '   ',

        ' 2. 无视防御类效果调整',
        '   resource:fluffDexGloves, 100%无视防御调整至20%防御穿透，额外伤害目标数降低至[0、1、1、2、2、3]',
        '   state:furryStaticElectricity, 100%无视防御调整至10%防御穿透',

        '   ',
        ' 3. 普通攻击协同效果调整',
        '   resource:bambooCrossbow, 100%触发降低至50%触发',
        '   resource:cuteGun, 100%触发降低至65%触发',

        '   ',

        ' 4. “先机吊坠”与“伏击吊坠”',
        '   “先机吊坠”将调整为“使你的行动顺序向前移动2轮”',
        '   “伏击吊坠”将调整为“使你的行动顺序向后移动3轮”',
      ]
    },
    {
      date: '2025-08-28',
      type: 'primary',
      content: [
        '新增：词典中添加了“炼金标签”词典',
        '新增：将玩家整理的硬核喵攻略添加到了游戏指南中',
        '修复：召唤物在受到resource:paradeCape的影响后，攻击力、防御力会被清空问题',
        '修复：酒馆专家在聘用且自动过期后，酒馆专家显示状态问题',
        '修复：resource:monoPolarElixir加成错误问题',
        '优化：当存在未处理的好友请求时，“好友”菜单上将会添加红点提示',
        '优化：在强化界面中，查看可强化物品时，现在会显示每个等级的基础成功率',
        '优化：现在可以在好友列表中点击玩家头像来查看玩家信息',
      ]
    },
    {
      date: '2025-08-25',
      type: 'primary',
      content: [
        '调整：resource:monoPolarElixir 持续时间提升至80回合，冷却时间提升至80回合，效果降低至40%加成。',
      ]
    },
    {
      date: '2025-08-25',
      type: 'primary',
      content: [
        '新增：skill:forgeSkillCraftTurret 在对炮台释放时，能够移除其1个负面状态',
        '新增：将玩家整理的攻略添加到了游戏指南中',
        '优化：小猫咪执行任的“指派”按钮始终可以点击',
        '修复：state:forgeSkillCraftMeowColossusState 提供的属性异常问题',
        '调整：skill:forgeSkillCraftMeowColossus 的魔法消耗从5提升至12，初始攻击降低至30，初始防御降低至10'
      ]
    },
    {
      date: '2025-08-24',
      type: 'primary',
      content: [
        '新增：resource:hasteElixir',
        '新增：resource:monoPolarElixir',
        '新增：resource:cuteIronBracelet',
        '新增：resource:cuteHammer',
        '修复：“单位存在检查”与“状态层数检查”不生效问题',

        // '调整：在市场中批量购买物品时，进行操作的玩家将在一段时间内无法对此物品进行上架',
      ]
    },
    {
      date: '2025-08-23',
      type: 'primary',
      content: [
        '新增：技能与物品袋配置中，添加“单位存在检查”与“状态层数检查”',
        '修复：skill:forgeSkillCraftTurret与skill:forgeSkillCraftMeowColossus 技能文本错误，实际与“锻造”等级相关',
        '修复：“喵喵巨像”的充能减少时，当前生命值不会问题同时减少问题',
        '修复：“自动炮台“仍然拥有其自身回合问题',
        // '调整：在市场中批量购买物品时，进行操作的玩家将在一段时间内无法对此物品进行上架',
      ]
    },
    {
      date: '2025-08-21',
      type: 'primary',
      content: [
        '新增：硬核喵聊天频道',
        '新增：skill:forgeSkillCraftTurret',
        '新增：skill:forgeSkillCraftMeowColossus',
        '新增：resource:echoBellCharm',
        '新增：resource:bookOfUnwriting',
        '调整：resource:otherworldCrystalPendant 在首轮战斗时就会加入备战',
        '调整：resource:starDustMagicBook+2',
        '调整：resource:cuteGun',
        '调整：市场订单金额上限提升至10,000,000,000',

        '   ',

        '预计在下周末前，逐步对战斗中以下内容进行调整',
        ' 1. “防御”、“有效防御”、“伤害减免”的逻辑调整:',
        ' - 调整前:',
        '   有效防御 = 防御 * (1 - 百分比防御穿透)',
        '   最终受到的伤害 = 伤害 - 有效防御',
        '   ',
        ' - 调整后:',
        '   有效防御 = (防御 - 固定防御穿透) * (1 - 百分比防御穿透)',
        '   伤害减免比例 = (0.0065 * 有效防御) / (1 + 0.0065 * 有效防御)',
        '   有效防御 < 0 时，伤害增幅 = 1 - |(0.0065 * 有效防御) / (1 - 0.0065 * 有效防御}|',
        '   最终受到的伤害 = 伤害 * 伤害减免比例',
        '   物理伤害与魔法伤害均基于此关系进行伤害计算',

        '   ',

        ' 2. 无视防御类效果调整',
        '   resource:fluffDexGloves, 100%无视防御调整至20%防御穿透，额外伤害目标数降低至[0、1、1、2、2、3]',
        '   state:furryStaticElectricity, 100%无视防御调整至10%防御穿透',

        '   ',
        ' 3. 普通攻击协同效果调整',
        '   resource:bambooCrossbow, 100%触发降低至50%触发',
        '   resource:cuteGun, 100%触发降低至65%触发',

        '   ',

        ' 4. “先机吊坠”与“伏击吊坠”',
        '   “先机吊坠”将调整为“使你的行动顺序向前移动2轮”',
        '   “伏击吊坠”将调整为“使你的行动顺序向后移动3轮”',

        // ' 4. 其他调整',
        // '   resource:bambooCrossbow, 触发几率由100%触发降低至80%',
      ]
    },
    {
      date: '2025-08-20',
      type: 'primary',
      content: [
        '修复：市场无法求购物品问题',
        '修复：无法创建第三个子账号问题',
      ]
    },
    {
      date: '2025-08-20',
      type: 'primary',
      content: [
        '新增：现在每个主账号都可以创建最多 3个 子账号，子账号为固定为铁猫模式：',
        '你可以在游戏内右上角“个人信息”->"切换账号"中进行子账号创建与切换操作',
        '子账号的密码与主账号相同，你可以在登陆时使用“子账号名称+主账号密码”直接登录某个子账号',
        '铁猫模式的限制：',
        ' - 无法使用市场进行交易',
        ' - 无法与非铁猫账号进行组队',
        ' - 只能加入铁猫工会（创始人是铁猫的工会）',
        ' - 铁猫账号进行战斗时，不进行同设备掉落检查',
        ' - 铁猫与非铁猫共享小镇建筑',

        '优化：现在房主可以将房主身份移交给房间内的其他成员',
        ' - 房主可以通过“修改房间”->“选择房主”，来移交房主身份',

        '优化：周榜->金币榜，更新后将统计金币消耗情况，不再只统计金币增加情况',

        // '---',

        // '调整：预计在两周内，逐步对战斗中以下内容进行调整',
        // ' 1. 法术攻击:',
        // '   与“攻击力”并列的“法术攻击”',
        // '   一些技能的“智力”补正将调整为“智力”/“法术攻击”补正',
        // '   一些装备的“智力”加成将调整为“智力”/“法术攻击”加成',
        // '   当你的“法术攻击”超过”攻击“时，如果没有[攻击方式调整]效果，则你的普通攻击将基于”法术攻击“造成魔法伤害',

        // ' 2. 战斗伤害与对应奖励经验的关系调整:',
        // '   每1点物理伤害 = 0.006的“力量”经验、0.005的“敏捷”经验、0.01的“攻击”经验',
        // '   每1点魔法伤害 = 0.008的“智力“经验、0.02的“法术攻击“经验',
        // '   默认情况下，友军造成的伤害仅为你提供5%的经验',
        // '   释放技能将不再提供“智力”经验',

        // ' 3. 战斗等级增益：',
        // '   进入战斗副本时, 每1级“战斗”等级, 提升0.1“攻击”、0.1“防御”、0.04“法术攻击”',
        // '   进入战斗副本时，根据角色的基础属性值，额外提供以下补正',
        // '   当你的“力量”等级最高时, 每1级基础“力量”额外提供0.4“攻击”',
        // '   当你的“敏捷“等级最高时, 每1级基础“敏捷”额外提供0.45“攻击”',
        // '   当你的“智力“等级最高时, 每1级基础“智力”额外提供1“法术攻击”',

        // ' 4. “防御”与“有效防御”的关系调整:',
        // '   有效防御 = (防御 - 固定防御穿透) * (1 - 百分比防御穿透)',
        // '   伤害减免比例 = (0.02 * 有效防御) / (1 + 0.02 * 有效防御)',
        // '   有效防御 < 0时, 减免比例变为等额的伤害增幅',
        // '   物理伤害与魔法伤害均基于此关系进行伤害计算',
        // '   部分包含“无视防御”与“无视部分防御“的装备、状态将于近期同步进行调整，多数“无视防御”效果将被替换为“百分比防御穿透”',

        // ' 5. “先机吊坠”与“伏击吊坠”',
        // '   “先机吊坠”将调整为“使你的行动回合提前2回合”',
        // '   “伏击吊坠”将调整为“使你的行动回合延后2回合”'
      ]
    },
    {
      date: '2025-08-18',
      type: 'primary',
      content: [
        '优化：现在房主可以对成员进行拖动排序',
        '优化：首页的“猫舍家具耐久度预警”提醒阈值调整至3%',
        '优化：“好友”->“推荐”中，可以查看通过自己的推荐链接注册的用户信息',
        '修复：拥有 state:batCurse 的单位始终拥有1点生命值且不会阵亡的问题',
      ]
    },

    {
      date: '2025-08-18',
      type: 'primary',
      content: [
        '新增：resource:otherworldCrystalPendant',
        '新增：resource:sealBell',

        '新增：“好友”->“推荐”',
        '调整：扩展了“慌乱”状态的敌我关系判定逻辑',
        '调整：resource:fluffDexGloves',

        '调整：现在删除猫咪玩伴将不会扣除小猫咪的心情，更新后所有小猫咪的心情值将被重置为100',
        '调整：以下装备、状态的伤害增加效果，由原来的“在现有伤害上增加”，调整为“在基础伤害上增加”',
        '例：你即将造成100点伤害，此时从穿戴的装备、状态获得8%,10%,15%三种增伤效果，原计算方式为100*1.08*1.1*1.15=136.62，调整后计算方式为100+(100*0.08+100*0.1+100*0.15)=133',
        ' - resource:otherworldCrystalPendant',
        ' - resource:fluffDexScarf',
        ' - resource:fluffMageBurqa',
        ' - resource:shadowSteelDagger',
        ' - resource:shadowSteelGloves',
        ' - resource:abyssalCloak',

        ' - state:milkManaShake',
        ' - state:furryStaticElectricityOverload',
        ' - state:loadOfamusementParkIncreaseDamage',
        '此次未列出的，存在伤害增幅的装备、状态，按原计算方式生效',

        '其他：去除了交易信息接口中的部分信息',
        '其他：去除了攻击力上限',
      ]
    },
    {
      date: '2025-08-17',
      type: 'primary',
      content: [
        '修复：resource:shadowSteelScythe 无法交易问题',
      ]
    },
    {
      date: '2025-08-17',
      type: 'primary',
      content: [
        '新增：resource:shadowSteelScythe',
        '新增：resource:empressCloak',
        '调整：resource:riposteAmulet 现在不会因受到自己的伤害而触发',
        '调整：原“巨魔木棒 重型”现在变为 resource:trollClubPlus ',
      ]
    },
    {
      date: '2025-08-16',
      type: 'primary',
      content: [
        '新增：resource:fluffDexGloves resource:fluffDexScarf resource:fluffDexCloth resource:fluffDexPants',
        '新增：resource:riposteAmulet',
        '修复：任务队列在完成任务后会自动结束后续动作的问题',
        // '其他：调整了战斗服务，现在每场战斗都是独立调度',
        '其他：在“战斗”->“我的房间”页面中添加了“结束战斗”按钮',
        '其他：关于装备词条上“[攻击方式调整]”说明：',
        ' - 部分装备的词条上拥有“[攻击方式调整]”，说明该装备的此词条效果会修改你普通攻击的默认行为。',
        ' - 同一件装备上的多个包含“[攻击方式调整]”的词条会同时生效。',
        ' - 穿戴的不同装备中，如果有不止一件装备词条上包含“[攻击方式调整]”，则只有更靠前的装备会生效，其余装备上的“[攻击方式调整]”词条效果不会生效。',
        ' - 因上一条规则导致某件装备上的“[攻击方式调整]”词条效果不生效时，不会影响此装备上其余词条的效果。',
      ]
    },
    {
      date: '2025-08-13',
      type: 'primary',
      content: [
        '修复：丝质隔热手套+5的装备部位不正确问题',
        '修复：公会聊天界面，在打开时不会不会自动滚动到最新消息位置问题',
        '优化：优化了任务队列执行效率',
      ]
    },
    {
      date: '2025-08-13',
      type: 'primary',
      content: [
        '新增：resource:bambooCrossbow',
        '新增：resource:silkChefApron resource:silkHeatResistantGloves',
        // '新增：resource:woolHeatInsulatingCloth resource:silkHeatInsulatingCloth',
        '修复：移动端查看角色战斗卡片时，其中的技能顺序与预设排序不一致问题',
        '修复：对战斗物品袋进行调整、补充时，提示信息会多次弹出问题',
        '修复：通过物品详情卡片多次穿透时，无法在下一层的物品详情中跳转至市场问题',
        '修复：酒馆中专家状态不正确问题',
        '优化：仓库、市场的搜索功能，现在支持拼音和首字母搜索',
        '调整：resource:cuteGun 触发时不会选择友军为目标',
        '其他：为战斗皮肤添加了相应的头像',
      ]
    },
    {
      date: '2025-08-13',
      type: 'primary',
      content: [
        '修复：绒毛法师披肩无效问题',
        '修复：移动端的角色战斗卡片中不显示技能及状态信息问题',
        '优化：优化了任务队列执行逻辑以及队列执行相关问题',
        '其他：自动强化现在起仅保留最近100次的强化过程。更新后，每次自动强化的总消耗物品与总获得物品将重新开始计算',
      ]
    },
    {
      date: '2025-08-12',
      type: 'primary',
      content: [
        '修复：战斗物品袋的排序无效问题（需要重开战斗后生效）',
        '修复：部分情况下，由其他效果触发的普通攻击不会生效问题',
        '修复：部分情况下，普通攻击在满足配置的释放逻辑的情况下，仍然不进行攻击问题',
        '修复：种瓜得瓜不会选中“潜行“状态下的友方单位问题',
        '修复：已经加入其他公会的成员，在当前公会中的请求无法被通过与拒绝问题',
        '其他：简化了战斗面板',
      ]
    },
    {
      date: '2025-08-10',
      type: 'primary',
      content: [
        '优化：战斗物品袋现在可以拖拽排序',
      ]
    },
    {
      date: '2025-08-09',
      type: 'primary',
      content: [
        '优化：现在通过技能、装备、状态使用的“普通攻击”，能够触发“普通攻击”的攻击效果',
        '修复：酒馆中的专家猫咪在暂停后，显示的状态不正确问题',
        '调整：复习动作的耗时降低至140秒',
      ]
    },
    {
      date: '2025-08-08',
      type: 'primary',
      content: [
        '新增：战斗逻辑配置中，添加“超压层数”判定',
        '优化：种瓜得瓜效果添加名称区分',
        '优化：公会仓库现在无法存入不可交易的物品',
        '优化：市场订单中，物品单价显示优化',
        '优化：酒馆中招募的专家，现在可以在招募后进行暂停。暂停后招募的专家将不会给予加成效果。',
        '优化：公会建筑-活力猫猫雕塑，现在除了选择获得“精力充沛“外，还可以选择单独获取效果提升30%“生命回复”或“法力回复”效果。每4小时只能选择其中一种效果进行获取。',
        '优化：现在可以为“普通攻击”配置技能顺序与战斗自动释放逻辑。如果所有技能都不满足释放条件，则会强制使用普通攻击(即使此时不满足“普通攻击”的自动释放逻辑)。',
        '调整：绒毛装备-法师系列',
        ' resource:fluffMageHat resource:fluffMageBurqa resource:fluffMageCloak',
        ' state:furryStaticElectricity state:furryStaticElectricityOverload',
        '调整：skill:sowMelonsReapMelons 给予的 state:sowMelonsReapMelonsRegen，从全额恢复 降低至 恢复50%已损失的生命与魔法',
        '修复：角色界面中的幸运属性加成显示错误问题',
        '修复：魔晶法杖无法获得护盾问题',
        '其他：本次更新后，将会依次返还公会成员向仓库中捐赠的不可交易物品',
        '其他：本次更新后，将为因数据回滚导致等级降低的玩家发放补偿，包括：',
        ' - 超级智力之书 * 3',
        ' - 超级学识之书 * 3',
      ]
    },
    {
      date: '2025-08-07',
      type: 'primary',
      content: [
        '新增：战斗逻辑配置中，添加“静电层数”判定',
        '修复：纪念碑给予的经验与猫猫老师给予的经验异常叠加问题',
        '修复：技能经验显示问题',
        '调整：绒毛装备-法师系列',
        '调整：战斗区域“噩梦监狱”中每个敌人的金币掉落降低40%',
        '其他：为补偿今日经验获取问题及副本掉落降低的调整，本次更新后将依次给予所有于2025-08-01后登录过的玩家补偿，包括：',
        ' - 超级智力之书 * 5',
        ' - 超级学识之书 * 5',
        ' - 星辉精华 * 50',
        ' - 重建纪念徽章 * 1',
        '因本次数据回滚导致等级降低的玩家，将于数据统计完毕后额外发放补偿，包括：',
        ' - 超级智力之书 * 3',
        ' - 超级学识之书 * 3',
      ]
    },
    {
      date: '2025-08-06',
      type: 'primary',
      content: [
        '新增：绒毛装备-法师系列',
        '新增：斧头强化榜',
        '调整：现在斧头可以被强化到+104',
        '修复：暗影精铁护手，提供的伤害加成与描述不符问题',
        '修复：战斗难度现在将给予额外的经验获取，对技能释放给予的技能经验不生效问题',
        '修复：会长职位可以被会长自己删除的问题',
        '修复：备战回合中存在阵亡单位导致的问题',
        '修复：猫舍家具耐久度不衰减问题',
        '其他：现在可以通过监听"moyu-socket-event"中的以下子事件来获取每场战斗结束后的相关统计信息:',
        ' - battle:battleInfoDetail:success  包含本次战斗中，所有单位的一些基础数据统计',
        ' - battle:giveExpReward:success  包含玩家阵营中的每个非召唤物的玩家单位，从本次战斗中获得的经验信息',
        ' - battle:giveResourceReward:success  包含玩家阵营中的每个非召唤物的玩家单位，从本次战斗中获得的战利品信息',
      ]
    },
    {
      date: '2025-08-05',
      type: 'primary',
      content: [
        '优化：战斗效率优化',
        '优化：建筑募集历史显示优化',
        '修复：已经加入其他公会的成员，在当前公会中的请求无法被通过与拒绝问题',
        '调整：现在会长可以给自己设置头衔',
        '调整：现在组长猫猫可以为成员猫猫设置头衔',
        '调整：战斗中原本即时结算的经验（释放技能、造成伤害、受到伤害），延迟到战斗结束（战斗胜利、战斗失败）后与战斗掉落物一起结算',
        '调整：猫猫家政服务中心，1级时提供的猫舍家具自动修理服务，耐久度检查阈值从20%调整至4%',
        '调整：战斗难度现在将给予额外的经验获取（因战斗提供的经验都将获得加成），额外的经验仅在战斗胜利的情况下才会提供，战斗失败时仅结算基础经验',
        // '其他：调整了舍友检逻辑',
      ]
    },
    {
      date: '2025-08-04',
      type: 'primary',
      content: [
        '新增：钓鱼专家',
        '新增：小镇',
        '修复：强化赋能技能提供的增益效果，会错误的识别最高属性的问题',
        '修复：强化冲击技能在判断伤害类型时，会错误的识别最高属性的问题',
        '其他：市场订单单价上限提高至2,000,000,000',
        '其他：物品类排行榜数据更新',
      ]
    },
    {
      date: '2025-08-03',
      type: 'primary',
      content: [
        '新增：公会建筑-活力猫咪雕像',
        '优化：公会建筑添加建筑效果显示',
        '优化：市场中，可被强化的商品展示方式调整',
        '优化：自动强化历史打开卡顿问题',
        '修复：战斗中阵亡的单位依旧可以触发“战斗开始时”效果的问题',
        '修复：仓库中“未拥有”分类下的物品，无法通过“市场”按钮快速跳转到市场',
        '修复：特殊情况下用户会被加入到多个公会问题',
        '修复：猫舍家具在耐久度为0时，不会在首页进行提示问题',
        '修复：复制技能显示缺少技能提示弹窗时，没有显示具体缺少的技能问题',
        '修复：部分描述问题修复',
      ]
    },
    {
      date: '2025-08-02',
      type: 'primary',
      content: [
        '优化：现在查看其他玩家的装备信息时，将可以查看生活装备',
        '其他：每个猫猫公会的最大成员数量基础值为200，已经超过此数量的公会可等待后续建筑升级',
        '其他：调整了菜市口对宿舍成员的检测逻辑，如有特殊情况请反馈至猫头大大',
      ]
    },
    {
      date: '2025-08-02',
      type: 'primary',
      content: [
        '优化：在库存中搜索尚未拥有的物品时，将会单独显示“未拥有”分类',
        '修复：在商店中购买物品后，库存没有刷新问题',
        '修复：库存变动记录中，如果某个分类下没有明细，则会始终处于加载状态问题',
        '调整：现在战斗内释放技能将会消耗魔法值',
        '调整：斧头、冰镐的效率提升现在可以对砍竹子生效',
        '调整：自动强化时，在强化过程中需要使用保护装备但库存数量不足时，则自动强化将自动停止',
        '调整：自动强化时，如果没有设置强化目标，则在强化至无法继续强化的等级后，将从本次自动强化所选的初始物品开始新的自动强化',
        // '调整：以下战斗内状态，调整为基于玩家进入战斗时的属性进行加成:',
        // ' - 游行披风给予的加成 ',
        // ' - 兽牙项链'
      ]
    },
    {
      date: '2025-08-01',
      type: 'primary',
      content: [
        '新增：现在可以在个人信息编辑页面，设置“聊天中隐藏公会头衔”',
        '调整：现在组长猫猫可以处理入会申请',
        '调整：现在组长猫猫可以设置成员头衔',
      ]
    },
    {
      date: '2025-07-31',
      type: 'primary',
      content: [
        '新增：公会头衔',
        ' - 会长可以创建公会头衔',
        ' - 每个头衔都包含两个部分：头衔名称、头衔职位',
        ' - 头衔名称影响玩家信息中的头衔名称显示',
        ' - 头衔职位影响玩家在公会中的权限',
        '新增：公会建筑',
        ' - 公会建筑可以由“会长猫猫”或“组长猫猫”发起筹备建造',
        ' - 公会建筑开始筹备后，每个公会成员都可以参与募集，提供材料',
        ' - 材料募集完成后，将自动开始进行建造',
        ' - 公会建筑会提供一些特殊效果，会随建筑等级提升',
        ' - 公会建筑每周都会消耗一定的资源作为维护费',
        '其他：周六上线战斗时的魔法消耗',
      ]
    },
    {
      date: '2025-07-30',
      type: 'primary',
      content: [
        '修复：在库存变动记录中切换分类时，加载内容异常',
      ]
    },
    {
      date: '2025-07-29',
      type: 'primary',
      content: [
        '新增：自动强化',
      ]
    },
    {
      date: '2025-07-28',
      type: 'primary',
      content: [
        '新增：暗影精铁匕首',
        '新增：库存搜索',
        '新增：竹质弓',
        '新增：为猫猫枪添加战斗中效果',
        '修复：一些文本问题',
        '其他：群体技能的伤害消息推送优化',
        '其他：绝影连杀在是多段单体伤害技能'
      ]
    },
    {
      date: '2025-07-27',
      type: 'primary',
      content: [
        '新增：市场数据',
        ' - 数据地址： [GET] https://www.moyu-idle.com/api/game/market/price',
        ' - 包含市场上存在订单物品的以下信息：最低出售价、最低出售价物品数量、总出售数量、出售订单数量；最高求购价格、最高求购价数量、总求购数量、求购订单数量'
      ]
    },
    {
      date: '2025-07-27',
      type: 'primary',
      content: [
        '优化：战斗渲染效率优化',
      ]
    },
    {
      date: '2025-07-27',
      type: 'primary',
      content: [
        '新增：战斗文字记录',
      ]
    },
    {
      date: '2025-07-27',
      type: 'primary',
      content: [
        '修复：网页卡顿问题',
        '修复：切换网页导致挤压的战斗信息同时渲染问题',
      ]
    },
    {
      date: '2025-07-26',
      type: 'primary',
      content: [
        '新增：两个新法杖',
        '优化：仓库物品添加了跳转至“强化”按钮',
        '修复：在仓库中通过物品快速跳转至市场时，市场界面显示问题',
        '修复：奶昔类物品给予的状态会在死亡后消失问题',
        '修复：魔晶法杖的护盾能够叠加的问题',
        '修复：重随任务无金币消耗问题',
        '修复：金枪鱼罐头、风味虾仁罐头描述错误问题',
        '修复：对同一件商品，上架不同价格的订单时，提示文字错误问题',
        '修复：多种来源的伤害增幅效果不会叠加问题',
        '修复：备战单位状态持续时间问题',
        '修复：战斗物品袋中的物品，部分情况中会无视冷却继续使用的问题',
      ]
    },
    {
      date: '2025-07-25',
      type: 'primary',
      content: [
        '新增：猫咪探险队'
      ]
    },
    {
      date: '2025-07-24',
      type: 'primary',
      content: [
        '修复：缝纫专家对绒毛类基础动作无加成问题',
        '其他：小猫咪排行榜',
        '其他：现在你可以删除小猫咪的一段玩伴关系',
      ]
    },
    {
      date: '2025-07-23',
      type: 'primary',
      content: [
        '新增：一个初版的技能配装方案，可在“角色”->“战斗配置”中，将当前技能保存为方案。在“角色”->“配装方案”->“技能”中可以快速应用已保存的方案',
        '优化：“词典”->“技能”界面，添加了分类',
        '优化：已停用的猫舍家具不再会在首页显示修理提醒',
        '优化：优化了队列执行效率',
        '调整：强化赋能现在不会选择召唤物为目标',
        '修复：浆果奶昔额外魔法伤害显示错误问题',
        '修复：物品强化至最高等级后，界面显示异常问题',
        '修复：复制技能时，特殊情况下会出现无法复制的问题',
        '修复：“词典”界面中的词条，在夜间模式下会是白色问题',
      ]
    },
    {
      date: '2025-07-22',
      type: 'primary',
      content: [
        '调整：强化冲击每强化等级提供的额外伤害从4%降低至2.5%',
        '调整：强化冲击现在造成的伤害类型，将根据数值最高的主属性决定：智力最高则造魔法伤害，否则造成物理伤害',
      ]
    },
    {
      date: '2025-07-22',
      type: 'primary',
      content: [
        '新增：自动释放逻辑中添加了“经过回合数”判断',
        '新增：新增了3种饮品',
        '新增：增加了一些种植动作',
        '新增：增加了强化相关的技能',
        '优化：现在复制技能时，将会在提示中显示全部尚未学习的技能',
        '修复：远古鱼骨项链强化等级没有在图标上显示问题',
        '修复：酿造搅拌器对其他酿造动作不生效问题',
        '调整：暗影精铁臂甲，每损失10%生命，提供的物理伤害加成由原本的8%调整至8%~12%(随强化等级提升)',
        '调整：鱼鳞合金装备',
        ' - 添加属性：现在鱼鳞合金装备会提供额外生命值',
        ' - 添加属性：现在鱼鳞合金装备会降低穿戴者的敏捷',
        ' - 鱼鳞合金盔甲-添加效果：在战斗开始时，嘲讽若干敌人(随强化等级提升)，持续2回合',
      ]
    },
    {
      date: '2025-07-21',
      type: 'primary',
      content: [
        '新增：现在可以将战斗房间分享至聊天',
        '新增：猫咪助手现在会记录自己的生活',
        '修复：腐蚀吐息无视防御效果无效问题',
        '修复：猫头鹰羽毛无掉落问题',
        '调整：现在房间列表不再显示未公开的房间',
      ]
    },
    {
      date: '2025-07-20',
      type: 'primary',
      content: [
        '新增：采矿背篓',
        '新增：探险背包',
        '新增：暗影精铁护甲',
        '优化：在物品用途弹窗中，添加“在市场中展示”按钮',
        '修复：召唤单位在持续时间结束后，将从战斗中移除',
        '修复：镜像影分身与本体共用一份属性问题',
        '修复：爆炸射击溅射伤害被结算至主目标问题',
        '修复：系统商店购买时，数量显示不清问题',
        '调整：穿针引线技能，现在造成的伤害无视防御',
        '其他：为禁魔图书馆补充了掉落物，相关制作配方将在后续补充',
      ]
    },
    {
      date: '2025-07-19',
      type: 'primary',
      content: [
        '调整：现在生活属性在进入战斗时将同样被固定',
        '其他：猫爪印章商店重新开放',
      ]
    },
    {
      date: '2025-07-19',
      type: 'primary',
      content: [
        '调整：禁忌魔法，移除增加其他技能冷却时间的效果',
        '修复：首页战斗界面渲染卡顿问题',
      ]
    },
    {
      date: '2025-07-19',
      type: 'primary',
      content: [
        '新增：装备栏新增“背部”槽位',
        '新增：斗篷装备',
        '新增：深渊披风和游行披风现在是可装备物品',
        '新增：铁质渔具',
        '调整：现有斗篷、披风类装备的可装备部位将被修改为“背部”',
        '优化：优化了战斗逻辑，减少卡顿情况',
        '修复：罐头类食品持续时间问题',
      ]
    },
    {
      date: '2025-07-17',
      type: 'primary',
      content: [
        '优化：现在配装方案在配置时，可以选择已装备的物品',
        '修复：“游乐园之王”附带的“狂欢”效果，持续回合为0的问题',
        '修复：复活技能，现在复活时，不会清除不可移除的状态',
        '修复：战斗界面内存溢出及卡顿问题',
        '修复：进入角色界面时会显示属性负数问题',
        '修复：进入角色页面卡顿问题',
        '修复：进入配装方案页面卡顿问题',
      ]
    },
    {
      date: '2025-07-16',
      type: 'primary',
      content: [
        '新增：装备预设配装',
        '新增：首页添加猫舍家具耐久度警告',
        '新增：星辉王冠与“游乐园之王”的强化效果',
        '新增：技能书浮动提示中，会提示此技能是否已学习',
        '修复：当一轮战斗在最后一位玩家行动后以胜利结束时，下一轮战斗备战席位异常问题',
        '修复：移动端显示装备饰品栏时，出现遮挡问题',
      ]
    },
    {
      date: '2025-07-16',
      type: 'primary',
      content: [
        '调整：罐头类食品的持续提升至80回合，冷却时间提升至80回合',
        '修复：饰品槽位未生效问题',
        '下面是一些技能调整',
        '中毒',
        ' - 中毒伤害提升至(15 + 智力(30 + 技能等级*3)%)',
        ' - 持续时间提升至6回合',
        '星辉风暴',
        ' - 伤害提升至(40 + 智力(160 + 技能等级*2)%)',
        ' - 负面效果概率提升至(50 + 技能等级*2)%，持续时间提升至2回合',
        '封印魔法',
        ' - 原效果为“对一名随机的敌人造成(12 + 智力80% + 此敌人技能数量*45 + 技能等级*5）伤害\n对所有拥有正在冷却中的技能的敌人，对其施加技能封印（技能冷却暂停，持续4回合）",”',
        ' - 调整为“对一名技能最多的敌人造成(12 + 智力(140 + 技能等级*5)% + 此敌人技能数量*45）伤害\n对所有拥有正在冷却中技能的敌人，对其施加技能封印（技能冷却暂停，持续4回合）“',
        '禁忌魔法',
        ' - 原效果为“对所有敌人造成(40 + 智力140% + 技能等级*8)伤害，并有30%概率沉默2回合\n自身被扰乱3回合”',
        ' - 调整为“失去(10 + 当前生命值的10%)点生命值，对所有敌人造成(40 + 智力140% + 技能等级*8)伤害，并有30%概率沉默2回合\n自身被扰乱3回合，另1个随机技能额外增加2回合冷却”',
      ]
    },
    {
      date: '2025-07-16',
      type: 'primary',
      content: [
        '新增：一些提升自我动作',
        '新增：两个缝制饰品',
        '新增：一些罐头食品',
        '新增：一款新上市的酒',
        '新增：生活和战斗饰品槽位扩充至6个',
        '优化：市场->上架记录中，可以通过点击资源名称，跳转至对应物品的"市场详情"数据中',
        '优化：等级排行榜中，对于等级一样的玩家，将基于对应的经验值进行排名',
        '优化：评论区会将图片类链接作为图片进行显示，格式：“[图片链接]”',
        '修复：龙之咆哮伤害问题',
        '修复：腐蚀吐息选择目标问题',
        '修复：骨盾状态在消失时，会额外提供一次防御问题',
        '修复：镜像影分身没有继承释放者技能自动释放配置问题',
        '修复：发布求购订单时，结算为非金币物品时，“总支付”内会错误显示数值问题',
        '修复：单位在回合开始结算状态时阵亡，其回合仍会继续的问题',
        '修复：复制技能配置时，技能顺序不会被复制问题',
        '修复：破甲技能书无掉落问题',
        '修复：自身装备栏中，已装备物品的槽位无法显示浮动说明',
        '其他：浆果酒现在不提供饱食度',
        '其他：已封禁玩家的订单已从市场中清理',
        '其他：现在每点力量提供0.25攻击力（仅战斗内显示加成）',
        '其他：村民守则更新',
      ]
    },
    {
      date: '2025-07-15',
      type: 'primary',
      content: [
        '新增：游戏词典菜单，目前包含技能、状态、单位',
        '优化：自动逻辑配置置界面，目标选择添加“全部友军”与“全部敌军”',
        '优化：释放技能时，浮动显示当前释放的技能',
        '优化：添加恢复魔法与消耗魔法的浮动文字',
        '其他：每1点耐力，在回合开始时回复0.1生命值',
        '其他：每1点智力，在回合开始时回复0.05魔法值',
        '下面是一些技能调整，剩余的技能调整将在接下来几次更新中进行',
        '横扫',
        ' - 伤害从(10 + 攻击力(80 + 技能等级*1)%)调整为(10 + 攻击力(80 + 技能等级*1)% + 力量(50 + 技能等级*1)%)',
        '暴风雪',
        ' - 冷却时间从8降低至7',
        ' - 魔法消耗从40降低至30',
        '破甲',
        ' - 技能目标从“防御最低的敌人”改为“防御最高的敌人”',
        ' - 破甲的防御降低效果从-8调整至-30%',
        '群体再生',
        ' - 原效果为“为所有友方单位附加再生状态（每回合回复10 + 智力20% + 技能等级*2.5点生命，持续3回合）“',
        ' - 调整为“为所有友方单位附加再生状态(每回合回复10 + 智力(35 + 技能等级*2.5)%)点生命，持续3回合“',
        ' - 冷却时间从8降低至7',
        '自我修复',
        ' - 治疗量从(20 + 耐力60% + 技能等级*2)调整至(20 + 耐力(100 + 技能等级*2)%)',
        ' - 魔法消耗从15降低至10',
        '驱散',
        ' - 冷却时间从5降低至4',
        '彗星打击',
        ' - 伤害从(18 + 智力130% + 技能等级*1.5)调整至(10 + 智力(130 + 技能等级*4)%)',
        ' - 冷却时间从5降低至3',
        ' - 魔法消耗从15提升至20',
        '星辰陷阱',
        ' - 伤害从(10 + 智力50% + 技能等级*0.8)调整至(10 + 智力(100 + 技能等级*3)%)',
        ' - 冷却时间从6降低至4',
        ' - 魔法消耗从15提升至20',
        '星辉风暴',
        ' - 伤害从(24 + 智力100% + 技能等级*6)调整至(8 + 智力(160 + 技能等级*3)%)',
        ' - 冷却时间从10提升至11',
        ' - 魔法消耗从15提升至20',

        '毒爪',
        ' - 原效果为“对生命值最低的敌人造成(25 + 攻击力95% + 敏捷95% + 技能等级*0.3)点伤害\n并有60%概率使目标中剧毒（失去10护甲，每回合受到(15+15%当前生命)点伤害，持续3回合）。',
        ' - 调整为“对生命值最低的敌人造成(25 + 攻击力95% + 敏捷(95 + 技能等级*3)%)点伤害\n并使目标获得剧毒（失去15%护甲，每回合受到(15+15%当前生命)点伤害，持续3回合）。”',
        ' - 魔法消耗从15降低至10',

        '暗影步',
        ' - 恢复效果从(8 + 敏捷50% + 技能等级*0.5)调整至(8 + 敏捷(50 + 技能等级*5)%)',

        '沉默打击',
        ' - 原效果为“对技能最多的敌人造成(9 + 攻击力80% + 敏捷80% + 技能等级*0.4)点伤害，并沉默1回合（无法释放技能）。”',
        ' - 调整为“对技能最多的敌人造成(15 + 攻击力100% + (敏捷100 + 技能等级*4)%)点伤害，并沉默2回合（无法释放技能）。”',
        ' - 魔法消耗从15降低至10',

        '镜像影分身',
        ' - 召唤物初始魔法值等于释放者当前魔法值',

        '绝影连杀',
        ' - 原效果为“在敌阵中高速穿梭，对敌人进行6次标记（优先选择不同目标）\n，每被标记1次，都将受到(敏捷200% + 攻击22% + 技能等级*8)点伤害\n若目标生命值低于50%，则本次攻击伤害翻倍。\n若自身处于潜行状态，则结束潜行。\n若自身不处于潜行，则进入潜行状态，持续2回合。”',
        ' - 调整为“在敌阵中高速穿梭，对敌人进行(5 + (敏捷*0.02，向下取整))次标记（优先选择不同目标）\n，每被标记1次，都将受到(攻击120% + 敏捷(120 + 技能等级*4)%)点伤害\n若目标生命值低于50%，则本次攻击伤害翻倍。\n若自身处于潜行状态，则结束潜行。\n若自身不处于潜行，则进入潜行状态，持续2回合。”',
        ' - 魔法消耗从30提升至35',

        '眩晕旋转',
        ' - 原效果为“对所有敌人造成(12+攻击力40%+自身力量60%+此敌人耐力120%)伤害，并有(40%+技能等级*1)概率眩晕1回合”',
        ' - 调整为“对所有敌人造成(12 + 攻击力60% + 力量(60 + 技能等级*2)% + 此敌人耐力120%)伤害，并有(40%+技能等级*1)概率眩晕1回合”',
        ' - 魔法消耗从12提升至15',

        '失控加速',
        ' - 原效果为“对随机单位（不分敌我）造成（攻击力150%+耐力250%）的伤害\n如果此次攻击的是友军，额外对一个随机敌人造成（攻击力200%+耐力300+自身最大生命值30%）伤害”',
        ' - 调整为“对随机单位（不分敌我）造成(攻击力150% + 耐力(250 + 技能等级*5)%)的伤害\n如果此次攻击的是友军，额外对一个随机敌人造成(攻击力200% + 耐力(300 + 技能等级*5)% + 自身最大生命值30%)伤害”',
        ' - 魔法消耗从8提升至10',

        '糖果爆裂',
        ' - 原效果为“随机两名敌人各造成(14 + 攻击力40% + 智力80%)点伤害，并有（40%+技能等级*1）概率使目标获得一个随机负面状态（中毒、眩晕、沉默、灼烧）”',
        ' - 调整为“随机两名敌人各造成(14 + 攻击力(60 + 技能等级*2)% + (智力60 + 技能等级*2)%)点伤害，并有（40%+技能等级*1）概率使目标获得一个随机负面状态（剧毒、眩晕、沉默、灼烧），持续2回合”',
        ' - 冷却时间从4提升至5',
        ' - 魔法消耗从10提升至15',

        '鬼影冲锋',
        ' - 原效果为“对一名当前生命值最低敌人造成(攻击力60%+敏捷80%)伤害，忽略20%护甲\n对最大生命值最低的敌人造成(攻击力60%+敏捷80%)伤害，有20%概率造成1回合眩晕\n如果选中了同一目标，则额外造成(攻击力60%+敏捷80%)伤害”',
        ' - 调整为“对一名当前生命值最低敌人造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害，忽略20%护甲\n对最大生命值最低的敌人造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害，有20%概率造成1回合眩晕\n如果选中了同一目标，则额外造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害”',
        ' - 魔法消耗从4提升至10',

        '狂欢号角',
        ' - 冷却时间从8降低至6',
        ' - 魔法消耗从18提升至20',

        '星辉魔法书',
        ' - 对星辉打击的额外伤害从100提升至300，分摊后的伤害不会低于智力25%',
        ' - 对星辉风暴额外伤害从200提升至400，分摊后的伤害不会低于智力25%'

      ]
    },
    {
      date: '2025-07-14',
      type: 'primary',
      content: [
        '新增：自动逻辑中，添加了逻辑分组，每个分组内的链接条件为“并且”，分组间为“或”。即多个分组中，只要存在一个分组，其内的逻辑完全符合，此技能、物品的自动使用逻辑便视为通过。',
        '新增：自动使用逻辑中，数值判断添加了debuff与buff数量判断',
        '新增：自动使用逻辑中，添加了目标技能冷却相关判断',
        '优化：技能配置界面添加“已启用”与“未启用”区分',
        '修复：控制类状态不再会跳过其余状态的结算',
        '修复：沉默效果不再会跳过使用物品阶段',
        '优化：现在来自状态的伤害、治疗将不会单独占用一次回合的时间',
        '其他：战斗物品袋，默认可携带物品上限从3提升至5',
        '部分烹饪调整',
        '猫薄荷饼干',
        ' - 新增效果：在使用后可以移除自身1个异常状态。物品冷却时间从2提升至3',
        ' - 配方调整：现在额外需要一份牛奶',
      ]
    },
    {
      date: '2025-07-14',
      type: 'primary',
      content: [
        // '新增：游客账号绑定邮箱功能',
        '优化：技能、物品自动使用逻辑中，添加是否存在Boss检查',
        '优化：移动端-战斗配置中的“技能配置”部分，添加了拖动延迟，现在长按才能触发拖动',
        '优化：聊天界面点击用户名时,新增“添加好友“菜单',
        '优化：技能释放逻辑配置界面，状态ID下拉菜单能够进行搜索',
        '调整：因战斗失败导致的重开，倒计时从30秒降低至15秒',
        '修复：因后台动作（执行任务、战斗）导致属性升级时，在角色属性界面会显示为负数问题',
        '修复：专家过期后，缓存未同步导致无法聘用问题',
        '修复：部分大猫咪操作队列延迟响应或不执行问题',
        '其他：现在大猫咪的操作队列最大长度为20',
        '技能调整，这次技能调整主要是对一些老技能进行调整，剩余的技能调整将在接下来几次更新中进行',
        '部分技能调整：',
        '基础治疗',
        ' - 技能等级加成从0.2提升至4',
        '自我疗愈',
        ' - 技能等级加成从0.15提升至4',
        '骨盾',
        ' - 添加额外效果：接下来受到的3次伤害，降低至1点，触发3次后结束骨盾效果',
        ' - 如果没有受到伤害（如因护盾完全抵挡了伤害），则不会触发骨盾',
        '横扫',
        ' - 伤害从(5 + 攻击力30% + 技能等级*0.2)调整为(10 + 攻击力(80 + 技能等级*1)%)',
        '基础群体治疗',
        ' - 治疗量从(4 + 智力100% + 技能等级*0.2)调整为(10 + 智力60% + 技能等级*2)',
        '重击：',
        ' - 原效果为“对随机敌人造成(6 + 力量120% + 攻击力110% + 技能等级*0.5)点伤害，忽略50%防御。”',
        ' - 调整为“对行动顺序最前方的敌人造成(10 + 力量120% + 攻击力150% + 技能等级*2)点伤害，忽略50%防御。”',
        ' - 冷却时间从5降低至3',
        ' - 魔法消耗从15降低至10',
        '熔岩吐息：',
        ' - 伤害从(18 + 攻击力110% + 技能等级*5)调整为(18 + 攻击力(110 + 技能等级*2)%)',
        ' - 魔法消耗从25提升至35',
        '守护者激光',
        ' - 基础技能等级加成从5降低至2',
        ' - 基于生命值造成伤害部分，技能等级加成从0.25降低至0.15',
        ' - 冷却时间从6提升至11',
        ' - 魔法消耗从35提升至60',
        '龙之咆哮：',
        ' - 原效果为“震慑所有敌人，使其攻击、防御-8，持续1回合”',
        ' - 调整为“震慑所有敌人，造成（自身最大生命值40% + 耐力130%）的伤害，并使其攻击、防御降低(8 + 技能等级*0.5)，持续1回合”',
        ' - 冷却时间从4提升至6',
        ' - 魔法消耗从0提升至25',
        '双重打击：',
        " - 伤害从(7 + 敏捷80% + 攻击力40% + 技能等级*0.3)提升至(15 + 敏捷140% + 攻击力(140 + 技能等级*2)",
        ' - 冷却时间从5降低至4',
        '弱点打击：',
        " - 原效果为“对生命值最低的敌人造成(6 + 攻击力50% + 敏捷80% + 技能等级*0.3)点伤害，目标每失去10%生命值，伤害增加2点“",
        ' - 调整为”对生命值最低的敌人造成(15 + 攻击力100% + 敏捷(120 + 技能等级*3)%)点伤害，目标每失去10%生命值，伤害增加（攻击力20%）点”',
        '爆炸射击',
        ' - 原效果为“对随机一个主要目标造成(10 + 敏捷100% + 技能等级*0.2)点伤害\n对另外两个敌人各造成(6 + 攻击力50% + 技能等级*0.1)点伤害”',
        ' - 调整为“对随机一个主要目标造成(10 + 攻击力(150 + 技能等级*8)%点伤害\n对另外两个敌人各造成(10 + 攻击力(80 + 技能等级*4)%)点伤害”',
        '冻结',
        ' - 伤害部分技能等级加成从0.1提升至4',
        ' - 冻结几率部分技能等级加成从0.1提升至1',
        ' - 冷却时间从4降低至3',
        ' - 魔法消耗从0提升至25',
        '冰弹',
        ' - 伤害从 (8 + 攻击力100% + 技能等级*0.2)调整至(8 + 攻击力150% + 技能等级*4)',
        ' - 冷却时间从5降低至3',
        ' - 魔法消耗从5提升至15',
        '吸血',
        ' - 原效果为“对随机目标造成(5 + 智力40% + 技能等级*0.1)，无视防御，并为自身回复等量生命“',
        ' - 调整为“对随机敌人造成(5 + 智力(80 + 技能等级*1)%)点伤害，无视防御，并为自身回复与最终伤害等量的生命值”',
        ' - 冷却时间从4提升至5',
        ' - 魔法消耗从20提升至40',
        '咆哮',
        ' - 原效果为“对所有敌人造成(10 + 力量25% + 耐力25% + 技能等级*0.2)点伤害，忽视50%防御“',
        ' - 调整为“对所有敌人造成(10 + 力量80% + 耐力(120 + 技能等级*2)%)点伤害，忽视50%防御',
        ' - 魔法消耗从10提升至20',
        '暴风雪',
        ' - 原效果为“对所有敌人造成(6 + 智力80% + 技能等级*5)点伤害，并有30%概率冻结目标“',
        ' - 调整为“对所有敌人造成(6 + 智力(80 + 技能等级*4)%)点伤害，并有(30 + 技能等级*0.8)%概率冻结目标',
        '铁壁',
        ' - 原效果为“大幅提升自身防御（+10，持续3回合）”',
        ' - 调整为“提升防御，数值相当于(5 + 耐力*60% + 技能等级*1）”，持续3回合。期间受到的所有伤害降低30%',
        ' - 冷却时间从3提至5',
        '诅咒',
        ' - 原效果为“使目标虚弱（攻击、防御-6，持续2回合）”',
        ' - 调整为“使随机目标虚弱，攻击、防御降低（6 + 技能等级*1），持续3回合”',
        ' - 魔法消耗从5提升至10',
        '暗影爆发',
        ' - 技能等级加成从1.5提升至3',
        ' - 魔法消耗从30提升至45',
        '群体诅咒',
        ' - 原效果为“诅咒敌方全体，使其虚弱（攻击、防御-6，持续2回合）”',
        ' - 调整为“诅咒敌方全体，攻击、防御降低（6 + 技能等级*1），持续3回合”',
        ' - 冷却时间从3提升至5',
        '神圣之光',
        ' - 原效果为“为一名生命值最低的友方单位回复(30 + 智力80% + 技能等级*1.5)点生命，为其余友军恢复(10 + 智力40% + 技能等级*0.5)点生命。”',
        ' - 调整为“为一名生命值最低的友方单位回复(30 + 智力(110 + 技能等级*2)%)点生命，为其余友军恢复(10 + 智力(65 + 技能等级*1)%)点生命。”',
        ' - 冷却时间从12降低至6',
        '祝福',
        ' - 原效果为“为所有友方单位提升攻击与防御（+6 + 智力20% + 技能等级*0.5），持续3回合。”',
        ' - 调整为“为所有友方单位提升攻击与防御（6 + 智力(20 + 技能等级*1)%），持续3回合。”',
        '群体再生',
        ' - 技能等级加成从0.5提升至2.5',
        '星辉冲击',
        ' - 原效果为“对所有敌人造成(16 + 智力70% + 技能等级*1.2)点魔法伤害，并有(30% + 技能等级*1)概率使目标沉默（2回合，无法释放技能）”',
        ' - 调整为“对所有敌人造成(8 + 智力(70 + 技能等级*1.5)%)点魔法伤害，并有(30 + 技能等级*1)%概率使目标沉默（2回合，无法释放技能）”',
        ' - 冷却时间从6提升至8',
        ' - 魔法消耗从30提升至40',
        '星辉结界',
        ' - 现在额外会使友军受到的第一次超过最大生命值30%的伤害降低至0',
        ' - 持续回合从2提升至3',
        '群体沉默',
        ' - 原效果为“使所有敌人沉默（无法释放技能，持续2回合）”',
        ' - 调整为“使所有敌人有(40% + 智力50% + 技能等级*1)概率沉默，持续2回合\n未被沉默的敌人获得“遗言”，持续3回合。”',
        ' - 冷却时间从7提升至12',
        ' - 魔法消耗从25提升至60',
        '破甲',
        ' - 伤害从(12 + 攻击力40% + 敏捷120% + 技能等级*0.3)调整至(12 + 攻击力100% + 敏捷(160 + 技能等级*3)%)',
        '偷袭',
        ' - 伤害从(10 + 攻击力90% + 敏捷90% + 技能等级*0.5)调整至(10 + 攻击力120% + 敏捷(120 + 技能等级*3)%)',
        ' - 冷却时间从4提升至2',
      ]
    },
    {
      date: '2025-07-12',
      type: 'primary',
      content: [
        '新增：在技能详情弹窗中，添加了“查看自动释放逻辑”按钮，允许查看其他玩家的技能自动释放逻辑（如果设置了自动释放逻辑）',
        '新增：其他玩家详情->技能标签页下，添加“复制技能配置”功能，用于快速复制技能的启用状态与技能的自动释放逻辑',
        '修复：镜像影分身，因魔法值为1导致无法释放技能的问题，现在继承召唤者的最大魔法值',
        '修复：部分装备因分类问题，在仓库/市场中的“全部”分类下，无法对应找到物品问题',
        '修复：一些可能导致登录时出现500错误的问题',
        '修复：“灼烧”状态造成双倍伤害问题',
        '修复：技能与部分效果中，忽视xx%护甲效果无效问题',
        '其他：见习雇佣兵猫猫现在不会占用备战队列',
      ]
    },
    {
      date: '2025-07-12',
      type: 'primary',
      content: [
        '新增：一些炼金动作',
        '新增：战斗物品袋自动使用逻辑设置',
        '优化：战斗中的角色卡片悬浮提示中，添加了物品袋显示',
        '修复：木剑无法强化问题',
        '修复：木法杖无法强化问题',
        '修复：余烬庇护无法强化问题',
        '修复：通过动作获得的物品，无法直接在“强化”界面进行强化的问题',
        '修复：装备物品时，额外添加装备适用场景检查',
        '修复：已完成建造的建筑，无法再次进行建造',
        '修复：部分护盾效果在buff失去后无法再次获得护盾问题',
        '调整：采集戒指的效果现在对所有采集动作生效',
        '调整：附魔采集戒指的效果现在对所有采集动作生效',
        '调整：采集手环的效果现在对所有采集动作生效',
        '调整：园艺手套的效果现在对所有采集动作生效',
        '调整：灵巧采集靴的效果现在对所有采集动作生效',
        '调整：猫舍家具-自动喂食器，现在需要使用一个完整的自动喂食器进行修复',
        '调整：魔晶法杖提供的护盾效果上限，由原来的不超过智力300%~320%，降低至200%~220%',
        '调整：护盾将在每场战斗开始时被重置',
        '其他：当任意单位阵亡时，会移除所有由该阵亡单位施加的嘲讽效果',
        '其他：召唤类技能问题已修复',
        '关于幸运属性：',
        ' - 每提升1级，基础强化成功率提升0.2%(+0.2%，在其他加成前)',
        ' - 每提升1级，通过动作获得物品的基础概率提升1%(*101%，在其他加成前，对猫咪助手执行的任务生效)',
        ' - 每提升1级，战利品基础掉落率提升1%(*101%，在其他加成前)',
        '关于战斗物品：',
        ' - 战斗物品与技能一样，允许设置自动使用逻辑，当满足条件时，自动使用物品。如果没有配置任何逻辑，则会在物品没有处于冷却的情况下，直接进行使用',
        ' - 如果同时有多个不处在冷却的物品满足自动使用条件，则会按照配置的顺序进行使用',
        ' - 战斗中自动使用物品不会占用回合',
        ' - 当处于“准备战斗/前往战斗/战斗中”状态时，战斗物品袋相关配置无法进行修改',
        '其他：技能魔法消耗尚未应用，在上线前（大概2～3天）会再次对各技能与消耗品的数值进行调整，同时也让各位猫猫有时间制作物品与配置物品袋',
      ]
    },
    {
      date: '2025-07-12',
      type: 'primary',
      content: [
        '其他：对于所有客户端收到的socket消息，都会额外发送一次客户端事件，事件名"moyu-socket-event"',
      ]
    },
    {
      date: '2025-07-12',
      type: 'primary',
      content: [
        '修复：当一场战斗在备战回合结束时，下一场战斗将从备战中尚未行动的单位开始进行',
        '修复：战斗因召唤物持续积累导致阻塞了部分服务器队列的问题，目前临时取消了召唤物相关技能效果',
        '其他：目前召唤类技能存在问题，因此临时取消了召唤类技能的效果，等待修复后再恢复召唤技能的作用',
      ]
    },
    {
      date: '2025-07-12',
      type: 'primary',
      content: [
        '战斗调整：',
        ' - 现在创建房间时，不再有“战斗次数”选项',
        ' - 当一场战斗以玩家胜利结束时，当前行动次序中剩余未行动的玩家在下一次战斗开始时获得额外的行动回合',
        ' - 战斗失败的自动重启时间从75秒降低值30秒',
        ' - 为开始战斗添加了15秒进入战斗区域的等待时间',
        // '市场调整：',
        // ' - 在市场购买物品时，将总是购买价格最低的订单',
        // ' - 在市场出售物品至求购订单时，将总是出售至求购价格最高的订单',
      ]
    },
    {
      date: '2025-07-11',
      type: 'primary',
      content: [
        '新增：公会聊天频道',
      ]
    },
    {
      date: '2025-07-11',
      type: 'primary',
      content: [
        '新增：猫猫公会',
        '新增：战斗物品袋（暂未实装战斗内效果，下次更新）',
        '新增：竹质钓鱼装备',
        '调整：钓鱼帽现在改为对降低所有钓鱼动作耗时3-13秒（与强化等级相关）',
        '调整：钓鱼专注帽在改为对降低所有钓鱼动作耗时8%，不在具有副作用',

        '优化：猫舍家具修理完成后，将自动启用家具',
        '优化：PC端-鼠标悬浮在动作卡片上时，能够看到动作所需资源的预览',

        '修复：立即执行动作时，在特殊情况下会出现复制现有动作而非立即新动作的问题',
        '修复：市场执行交易动作时的相关问题',
        '修复：上架物品时，库存充足的情况下提示“库存不足，无法上架”的问题',
        '修复：移动端-猫舍家具修理时，弹窗中“确认修理”按钮被遮挡问题',
      ]
    },
    {
      date: '2025-07-09',
      type: 'primary',
      content: [
        '新增：菜市口',
      ]
    },
    {
      date: '2025-07-09',
      type: 'primary',
      content: [
        '修复：建造猫舍后，在菜单中不显示“猫舍”菜单项问题',
        '修复：月光吊坠在图标中不显示强化等级的问题',
        '优化：玩家个人界面信息界面可以查看已启用的技能',
        '优化：优化了服务端事件的广播逻辑',
        '优化：在物品详情弹窗中，点击“相关动作”中的动作名称，可以快速跳转至对应动作的执行界面',
        '其他：为技能添加了各类标签',
      ]
    },
    {
      date: '2025-07-08',
      type: 'primary',
      content: [
        '新增：猫舍家具-毛绒玩具',
        '新增：猫咪重命名',
        '优化：库存变动记录添加了一些常用分类',
        '修复：使用物品后，提示中显示的数量与仓库中显示的数量不正确问题。',
        '修复：库存显示问题。',
      ]
    },
    {
      date: '2025-07-06',
      type: 'primary',
      content: [
        '修复：见习雇佣兵不会被算作额外玩家的问题',
      ]
    },
    {
      date: '2025-07-06',
      type: 'primary',
      content: [
        '新增：猫咪家具-书桌',
        '新增：建筑-小猫舍',
        '新增：酒馆-初学者雇佣兵猫猫',
        '新增：制造-铁钳',
        '新增：制造-彩虹手链',
        '新增：制造-彩虹项链',
        '优化："加入队列"按钮始终可以点击',
        '修复：影之刃与魔晶法杖在市场中搜索不到的问题',
        '修复：部分物品分类问题',
        '修复：操作队列中当前任务完成后，排序内容被重置问题',
        '其他：上架物品时，原本不允许同时拥有多个上架订单，改为允许上架多个相同价格的订单，',
      ]
    },
    {
      date: '2025-07-05',
      type: 'primary',
      content: [
        '优化：仓库分类展示优化',
        '优化：市场分类展示优化',
        '调整：挖掘类生活装备可以正确对所有挖掘类行动生效',
        '修复：秘银工匠锤 强化后装备部位错误问题',
        '修复：合金后装护腿 装备部位错误问题',
        '修复：聊天界面查看玩家信息时，弹窗显示位置问题',
        '修复：市场进入商品详情后，显示的物品数据与实际不符问题',
      ]
    },
    {
      date: '2025-07-04',
      type: 'primary',
      content: [
        '新增：魔晶法杖',
        '新增：兽牙项链可强化',
        '调整：云行靴 缝制等级要求从35调整至27',
        '调整：云行斗篷 缝制等级要求从35调整至27',
      ]
    },
    {
      date: '2025-07-04',
      type: 'primary',
      content: [
        '新增：市场税',
        ' - 在上架的商品成交时，会从卖方最终收入中抽取3%金币作为市场税',
        ' - 对于以金币作为结算标的的求购订单，在发起求购订单时，将会从求购方账户中预扣除3%金币作为市场税，每次成交将按交易数量抵扣税费，撤单时退还未结算的税费',

        '新增：一些新的可获取资源',
        '新增：一些新的装备',

        '优化：待执行的任务队列可以进行自由拖动排序',
        '优化：猫咪助手的待执行任务队列可以进行自由拖动排序',

        '调整：守护者激光 - 保留守护者激光本身的伤害及AOE能力，削弱守护者激光在组队中的表现：守护者激光在造成伤害后，将额外对敌人施加“激光抵抗”效果，持续2回合。该效果下受到守护者激光的伤害减少50%。',
      ]
    },
    {
      date: '2025-07-03',
      type: 'primary',
      content: [
        '修复：任务界面快速开始任务时，将直接显示动作弹窗',
        '修复：掉落率超过100%时掉落数量反而降低的问题',
        '调整：UI颜色调整',
      ]
    },
    {
      date: '2025-07-03',
      type: 'primary',
      content: [
        '新增：部分丝质工作服',
        '新增：秘银工匠锤',
        '新增：副本难度选择',
        ' - 副本现在除了基础难度，额外添加了5个难度等级可供选择',
        ' - 提升难度会提升怪物数值',
        ' - 提升难度会提升怪物数量',
        ' - 提升难度会提升物品掉落几率',
        '优化：现在当战利品掉落几率超过100%时（来自后勤猫咪的提升或者难度等级的提升），超过100%的部分会转而提升掉落数量（向下取整）。',
        '优化：一些UI调整',
        '优化：现在移动端不会再立刻显示战斗掉落消息框',
      ]
    },
    {
      date: '2025-07-02',
      type: 'primary',
      content: [
        '修复：部分物品分类问题',
        '修复：羊毛裁缝手套，缝纫用时降低与描述不符，现已统一为降低(7%-8.5%，与强化等级相关)',
        '修复：终止猫咪助手正在执行的任务，不会返还材料问题',
        '其他：优化了ui与服务端进度不同步问题',
        '其他：房间内离开战斗按钮始终处于可点击状态',
        '其他：现在拥有嘲讽状态时，将无法再获得潜行状态，反之亦然',
        '其他：动作的快速操作中，根据完成时间设置次数功能，现在将根据实际完成时间进行调整',
        '其他：添加自动封禁相关逻辑',
        '市场改动：',
        ' - 玩家无法对同一件物品同时进行上架与求购。即对于一件物品拥有上架订单时，将无法发起此物品的求购订单',
        ' - 玩家在同一时间，对一件物品只能拥有一条上架订单或求购订单',
        ' - 每个玩家只能拥有5条求购订单',
        ' - 下次更新会更新市场手续费',
        // ' - 对于上架操作，将收取预计总成交金额5%的手续费。该手续费在以下情况会进行退还：1.订单成交 2.上架的3小时后，进行下架操作',
      ]
    },
    {
      date: '2025-06-30',
      type: 'primary',
      content: [
        '修复：猫薄荷手链 在从+4强化至+5时，无法使用星辉精华进行保护的问题',
        '修复：禁忌魔法，技能等级伤害加成与技能描述不符问题，现已统一为（技能等级*8）',
        '修复：聊天消息初始化时，不会自动置底问题',
        '修复：开启自动重开后，战斗失败导致的卡房问题',
        '修复：任务分发问题',
        '优化：优化了进入仓库与其他制造模块的速度',
      ]
    },
    {
      date: '2025-06-29',
      type: 'primary',
      content: [
        '新增：猫舍家具',
        '新增：自动喂食器（制造->猫舍家具）',
        '新增：猫抓板（制造->猫舍家具）',
        '修复：修复部分情况下，因直接离开战斗导致的卡房问题'
      ]
    },
    {
      date: '2025-06-29',
      type: 'primary',
      content: [
        '新增：烹饪装备',
        '新增：畜牧装备',
        '新增：制造装备',
        '调整：毛毛可爱帽，畜牧用时降低由(1秒-2.5秒，与强化等级相关)，调整为降低(5%-6.5%，与强化等级相关)',
        '调整：羊毛可爱帽，畜牧用时降低由(1.6秒-3.4秒，与强化等级相关)，调整为降低(7%-8.5%，与强化等级相关)',
        '调整：羊毛裁缝服，缝纫用时降低由(4秒-5.5秒，与强化等级相关)，调整为降低(7%-8.5%，与强化等级相关)',
        '调整：羊毛裁缝手套，缝纫用时降低由(3.5秒-4.8秒，与强化等级相关)，调整为降低(7%-8.5%，与强化等级相关)',
      ]
    },
    {
      date: '2025-06-29',
      type: 'primary',
      content: [
        '新增：好友功能',
        '新增：好友私聊功能',
        '新增：房间内聊天功能',
        '优化：仓库界面添加物品名称显示',
        '优化：现在猫咪助手可以执行分解行动',
        '优化：在房主离开房间后，房主将被自动移交至第一个成员',
        '优化：任务界面移动端UI优化',
        '优化：任务在进行状态时，也可以快速开始',
        '修复：丝质夜行衣与丝质罩袍的战斗内加成与描述不符问题',
        '修复：星辰魔法书+5智力加成异常问题',
        '修复：触发眩晕后，行动顺序异常问题',
        '修复：装备界面不显示物品强化等级问题',
        '调整：守护者激光技能，原“最大伤害不超过自身攻击力500%”，调整为“对当前生命值（装备过载核心后为最大生命值）计算伤害的部分，不会超过自身攻击力500%',
      ]
    },
    {
      date: '2025-06-28',
      type: 'primary',
      content: [
        '新增：物品分解',
        ' - 物品分解入口在左侧菜单中，原“强化”菜单的下方',
        ' - 分解物品时，返还制造消耗的60%原材料，向下取整',
        ' - 分解单个物品的耗时，为原制造耗时的50%，向下取整。',
        ' - 分解强化物品时，仅返回基础制造消耗，强化所消耗的物资不进行返还。',
        '优化：仓库界面中，为可交易的物品添了“在市场中展示”按钮',
        '优化：仓库界面中，为可分解的物品添了“分解”按钮',
        '调整：因战斗失败触发的自动重开与自动开始，等待时间从4秒提升至75秒。战斗胜利后的重开等待时间不变。',
        '调整：现在触发自动开始与自动重开时，会显示剩余等待时间。',
      ]
    },
    {
      date: '2025-06-28',
      type: 'primary',
      content: [
        '新增：物品分解',
        ' - 物品分解入口在左侧菜单中，原“强化”菜单的下方',
        ' - 分解物品时，返还制造消耗的60%原材料，向下取整',
        ' - 分解单个物品的耗时，为原制造耗时的50%，向下取整。',
        ' - 分解强化物品时，仅返回基础制造消耗，强化所消耗的物资不进行返还。',
        '优化：仓库界面中，为可交易的物品添了“在市场中展示”按钮',
        '优化：仓库界面中，为可分解的物品添了“分解”按钮',
        '调整：因战斗失败触发的自动重开与自动开始，等待时间从4秒提升至75秒。战斗胜利后的重开等待时间不变。',
        '调整：现在触发自动开始与自动重开时，会显示剩余等待时间。',
      ]
    },
    {
      date: '2025-06-27',
      type: 'primary',
      content: [
        '调整：因为守护者激光的最大生命值伤害没有任何门槛且是AOE，无门槛能刷任何图，所以进行一下调整: 守护者激光现在造成的最大伤害，不会超过超过自身攻击力500%',
      ]
    },
    {
      date: '2025-06-27',
      type: 'primary',
      content: [
        '修复：属性书可交易属性问题',
        '修复：彗星打击没有掉落问题'
      ]
    },
    {
      date: '2025-06-27',
      type: 'primary',
      content: [
        '新增：增加了1件力量武器、2件敏捷类饰品和2件智力装备',
        '新增：增加了“书籍”、“经验”物品类型',
        '新增：增加了三本经验书',
        '新增：装备属性要求（之前的装备暂不进行限制）',
        '  - 装备属性要求，仅检查角色本身的属性，由装备附加的属性不会被计算在内',
        '修复：排行榜加载问题',
        '修复：因战斗、使用物品导致角色属性等级、经验出现变动，进入角色页面时显示的数值没有及时刷新的问题',
        '修复：沉默状态下，单位会无视一些控制状态进行普通攻击的问题',
        '修复：星辉冲击附带的debuff施加概率异常问题',
        '修复：在猫咪专家未被雇佣的情况下进行续约，会出现吞材料但专家没有被招聘的情况',
        '修复：在立即执行任务前，会先进行前置检查',
        '其他：现在在队列里存在任务，并立即执行另一个新任务前，会退还当前任务执行所消耗的材料，并将当前任务执行的进度清空',
        '',
        '关于这次更新：这次更新加了个数值稍微高一些的副本，希望大家慢慢刷，还有好多坑和bug没填呢',
        '关于接下来的更新：下面几次更新应该会继续把反馈的bug进行修复，以及一些之前没用到的资源给利用起来（变成生活用品、武器、饰品），然后是物资分解、回收相关功能的实现',
      ]
    },
    {
      date: '2025-06-26',
      type: 'primary',
      content: [
        '新增：个人信息页面新增了称号',
        '新增：新增了一些装备',
        '新增：战场后勤专家猫猫',
        '优化：战斗房间列表添加“仅显示等待状态”过滤',
        '修复：战斗房间列表，在加载更多时，会忽略“副本筛选”的过滤，加载所有副本的房间',
        '修复：现在大多数对1个以上目标生效的非全体性的技能，将不再会再选择潜行单位作为目标',
        '其他：换了一批土豆，之前的土豆已经做成薯条了',
        '其他：一些特殊的bug反馈者称号与赞助者称号这两天会逐步发放',
      ]
    },
    {
      date: '2025-06-25',
      type: 'primary',
      content: [
        '优化：专家猫猫可以续约',
        '优化：优化了强化效率',
        '修复：战斗最小轮数可以被设置为1的问题',
        '修复：猫咪助手饥饿值消耗异常问题',
        '修复：登录账号导致当前房间战斗停止问题',
        '修复：挖沙动作中，幸运猫盒几率问题',
        '修复：镜像影分身不会释放技能问题',
        '修复：蛋奶布丁和浆果酒使用后不会被消耗问题',
        '其他：召唤物造成伤害时，会向召唤者提供60%的“造成伤害”相关的经验',
        '其他：友军在对敌人造成伤害时，其余队友能够获得30%的“造成伤害”相关的经验',
      ]
    },
    {
      date: '2025-06-24',
      type: 'primary',
      content: [
        '修复：畜牧专家加成无效问题',
        '修复：猫咪助手无法受到专家加成问题',
      ]
    },
    {
      date: '2025-06-24',
      type: 'primary',
      content: [
        '修复：玻璃瓶图异常问题',
        '修复：市场上架记录排序问题',
        '修复：任务功能现在已重开，调整了任务类型与奖励',
      ]
    },
    {
      date: '2025-06-24',
      type: 'primary',
      content: [
        '修复：战斗不提供经验问题',
        '修复：市场筛选与"仅显示有交易的"选项同时使用会导致市场不显示问题',
        '优化：优化部分可导致卡顿的逻辑',
      ]
    },
    {
      date: '2025-06-23',
      type: 'primary',
      content: [
        '修复：部分物品分类错误问题',
        '修复：毛毛裁缝服和毛毛裁缝手套在“缝制”->"工作服"中重复显示的问题',
        '修复：现在对友军造成伤害将不在提供造成伤害的经验',
        '修复：现在结算战斗经验时，将不会计算超出当前生命值部分的伤害',
        '修复：当房间开启了“自动开始”，且玩家成功完成所有预设的战斗次数后，战斗不会自动开始，而是所有玩家均以准备状态在房间内等待的问题',
        '修复：当房间开启了“自动开始”，且在完成预设战斗次数前全部阵亡时，战斗不会自动开始，而是所有玩家均以准备状态在房间内等待的问题',
        '修复：为战斗房间状态同步添加了更多异常处理，当房间状态、战斗状同步异常时，将会自动离开房间、战斗',
        '修复：为快速穿脱装备添加了异常处理',
        '修复：市场勾选“仅显示有交易的”勾选框后，输入框过滤无效问题',
        '修复：市场勾选“仅显示有交易的”勾选框后，再点击物品分类后市场消失问题',
        '新增：添加了猫猫小酒馆',
      ]
    },
    {
      date: '2025-06-23',
      type: 'primary',
      content: [
        '修复：部分物品无法装备问题',
        '修复：冰镐强化素材中，冰弹没有显示的问题',
        '修复：物品现在可以直接从仓库中装备',
      ]
    },
    {
      date: '2025-06-23',
      type: 'primary',
      content: [
        '新增：装备分为生活装备与战斗装备',
        '  - 现在，每件装备都有自己的装备类型：生活、战斗',
        '  - 生活装备将影响装备者的生活动作耗时、生活动作消耗（消耗的材料、消耗的饱食度）',
        '  - 战斗装备将影响装备者的各项属性（攻击、防御、力量、敏捷等）',
        '  - 部分装备同时具有生活与战斗属性，此时将根据具体装备情况，提供对应的属性（比如斧头，作为生活装备时，将提供伐木效率；作为战斗装备时，将提供攻击）',
        '  - 此次更新后，所有装备都将被装备在“战斗装备”中（包含所有属性），需要各位猫猫手动进行分装',
        '修复：复活现在不会复活召唤单位(again)',
        '修复：偷天换日将无法窃取不移除状态',
        ' - 目前的不可移除状态：分裂核心、余烬庇护、召唤单位',
        '修复：小丑召集令，在己方不存在小丑猫时，才会进行召唤',
        '修复：小丑召集令，在己方存在小丑猫时，才会进行治疗',
        '修复：召唤单位在触发分裂核心的自爆后，自身不会阵亡的问题',
        '修复：召唤单位在触发分裂核心的自爆后，会跳过下一个单位的回合的问题',
        '修复：秘银头盔+1无法装备问题',
        '修复：为离开战斗额外发送了客户端消息，减少因离开战斗导致的卡房问题',
        '修复：重置密码界面在点击重置后，一直处在加载状态的问题',
        '优化：市场部分交互优化'
      ]
    },
    {
      date: '2025-06-22',
      type: 'primary',
      content: [
        '修复：夜间模式部分字体看不清问题',
        '修复：使用物品后在右上角示提示中，部分物品图标显示异常问题',
        '修复：镜像影分身现在能够继承技能',
        '修复：熔岩吐息技能等级系数依旧为1.2而非描述的5的问题',
        '优化：夜间模式的配置现在可以在当前设备上记录',
        '优化：市场优化',
      ]
    },
    {
      date: '2025-06-22',
      type: 'primary',
      content: [
        '修复：同类饰品不再能同时装备多个',
        '修复：使用物品后在右上角示提示中，部分物品图标显示异常问题',
        '修复：镜像影分身现在能够继承技能',
        '优化：夜间模式的配置现在可以在当前设备上记录',
        '优化：市场优化',
      ]
    },
    {
      date: '2025-06-21',
      type: 'primary',
      content: [
        '修复：更新日志里分裂核心强化物资异常问题，应该是过载核心强化物资异常问题，睡了💤',
      ]
    },
    {
      date: '2025-06-21',
      type: 'primary',
      content: [
        '修复：战斗无掉落问题，明天发补偿',
        '修复：分裂核心强化物资异常问题',
      ]
    },
    {
      date: '2025-06-21',
      type: 'primary',
      content: [
        '优化：市场交易金额添加金额分隔符',
        '优化：市场内可直接查看出售、求购物品的详细信息',
        '削弱：去除星辉王冠的闪光弹效果',
        '修复：修复分裂核心召唤物不会自曝的问题',
        '调整：过载核心在+3后，将变得很致命',
      ]
    },
    {
      date: '2025-06-21',
      type: 'primary',
      content: [
        '新增：新增了一些可合成装备',
        '新增：星辉王冠现在是可装备物品',
        '新增：预先上线了一些食品的战斗内生命值、魔法值恢复简介，蓝耗系统正式上线前根据会反馈意见进行数值调整',
        '新增：预先上线了技能的魔法消耗预览，蓝耗系统正式上线前会根据反馈意见进行数值调整',
        '新增：预上线了1个副本给乐于探险的猫猫探索，暂未补充掉落',
        '优化：优化了一下部分移动端的UI',
        '修复：执行任务次数可以为非整数的问题。',
        '修复：静默烟雾弹会导致普通攻击进入冷却的问题',
        '修复：特殊情况下直接离开战斗导致的卡房问题。',
        '修复：狂欢号角Buff只存在的两回合的问题。',
        '修复：熔岩吐息伤害不正常问题。',
        '修复：绝影连杀触发"若自身不处于潜行，则进入潜行状态，持续1回合"时，潜行不生效问题，现在触发此效果时，附加的潜行将变为2回合。',
        '调整：熔岩吐息伤害从(18 + 攻击力60% + 技能等级*1.2) 提高为(18 + 攻击力110% + 技能等级*5)',
        '调整：“灼烧”状态，从每回合受到(2 + 当前生命值5%)无视防御伤害，改为受到(10 + 最大生命值6%)无视防御伤害',
        '其他：为所有向服务端发送的ws消息添加了状态检查，如果更新后出现问题（应该不会），尝试退出登录并重新登录，如仍有问题请联系管理员',
      ]
    },
    {
      date: '2025-06-21',
      type: 'primary',
      content: [
        '修复：对交易数量与交易金额填写的内容进行检查。',
        '修复：创建战斗房间时，“自动开始”功能无效，必须在房间内手动修改才生效的问题。',
        '修复：丝质法师手套+3没有装备效果问题。',
        '修复：丝质法师帽+3没有装备效果问题。',
        '另外今天猫猫村的市场管理员将对近期市场交易记录进行一次审计，对明显异常交易进行资源扣除，如果您因此被误伤（一般不会），可携带上架记录与猫头大大联系。',
      ]
    },
    {
      date: '2025-06-20',
      type: 'primary',
      content: [
        '新增：战斗内离开战斗功能。',
        '新增：房间自动开启战斗。',
        '调整：求购市场UI问题。',
        '修复：制作余烬庇护所需材料中，银项链资源ID错误问题。',
      ]
    },
    {
      date: '2025-06-19',
      type: 'primary',
      content: [
        '新增：战斗自动重开，可在创建房间或编辑房间时开启。开启后，每次战斗完整结束（包括完成全部轮次战斗或战斗失败）时，会在4秒后重新从第一轮开始进行战斗。重开的战斗将使用新的战斗配置离线运行。',
        '新增：新增加了一些照料家禽效率装备与一些新饰品',
        '新增：现在可以在【强化->查看可强化物品】中，查看每个物品各个强化等级的详细数据',
        '优化：求购市场排序优化',
        '优化：施放技能时，会高亮本回合释放的技能',
        '调整：制作幸运猫神像的学识需求从15降低至8',
        '调整：现在战斗次数最少为5次。',
        '修复：为装备变动请求添加锁。',

        '',
        '下面是部分怪物金币掉落的调整，因遗迹深处的熔岩巨龙金币掉落(1600~1850)与其他区域中特殊敌人的掉落(200~400)相比显得过于离谱，因此对所有特殊敌人的金币掉落进行了调整：',

        '调整：幽暗森林的森林巨魔 金币掉落从30～60提升至200～300。',
        '调整：遗迹深处的遗迹守护者 金币掉落从80~120提升至300~420。',
        '调整：遗迹深处的熔岩巨龙 金币掉落从1600~1850降低至420~545。',
        '调整：极寒雪原的极寒冰灵王 金币掉落从90~130提升至480~605。',
        '调整：极寒雪原的雪原巨兽 金币掉落从180~250提升至500~625。',
        '调整：猫影深渊的猫祖王 金币掉落从400~600提升至600~800。',
        '调整：猫影深渊的深渊领主 金币掉落从220~320提升至580~680。',
        '调整：神圣猫咪神殿的神圣猫王 金币掉落从200~300提升至750~950。',
        '调整：影爪巢穴的影爪领主 金币掉落从200~400提升至850~1050。',
        '调整：星辉女帝试炼的星辉帝王猫 金币掉落从220~320提升至1100~1300。',
        '调整："游乐园"的游行猫王 金币掉落从280~350提升至1400~1700。',
        '',

        '下面是一些技能的调整，这次调整涉及到的是高稀有度技能中，技能等级补正的调整，后续会对技能等级补正做更多调整：',
        '调整：星辉风暴 技能等级补正 从2.5提高至6，基础伤害从30降低至24',
        '调整：守护者激光 伤害调整为(10 + 目标当前生命值(15 + 技能等级*0.25)% + 技能等级*10)',
        '调整：暴风雪 技能等级补正 从0.1提高至5',
        '调整：绝影连杀 伤害从(敏捷200% + 攻击30% + 技能等级*0.8)调整至(敏捷200% + 攻击22% + 技能等级*8)',
        '调整：小丑召集令，召唤数量从(1+技能等级*0.05)调整至(1+技能等级*0.4)，boss此技能等级降低至3',
      ]
    },
    {
      date: '2025-06-19',
      type: 'primary',
      content: [
        '新增：求购市场',
        '优化：为库存变动事件(战利品、行动奖励、行动消耗、强化、市场交易)添加了锁，避免并发变动导致库存情况覆盖的问题',
      ]
    },
    {
      date: '2025-06-17',
      type: 'primary',
      content: [
        '新增：技能释放逻辑中新增了一些判断',
        '新增：为一些现有的装备添加了强化选项',
        '新增：为丝质夜行衣与丝质罩袍添加了战斗中效果，受强化等级影响。',
        '修复：市场超售问题',
        '修复：快速重复使用物品的问题',
        '修复：强化后的丝质夜行衣，buff数值不正确问题',
        '修复：月光守护者 护盾持续时间依旧是1回合的问题',
        '修复：无法查看玩家信息的问题',
        '修复：玩家在保存角色技能配置信息时（技能释放逻辑、技能顺序、技能启用情况），需要进入战斗刷新状态后，才会生效的问题',
        '优化：优化了战斗与自身行动队列的执行逻辑',
        '优化：市场添加了交易频率检查',
        '优化：优化了市场交易的逻辑',
        '优化：现在复活不再会复活召唤物',
      ]
    },
    {
      date: '2025-06-17',
      type: 'primary',
      content: [
        '新增：增加了一些缝纫效率装备。',
        '新增：增加了丝质装备。',
        '新增：增加了一个新副本。',
        '优化：现在聊天列表仅在本就处于最底部时，收到新消息时才会自动置底，在浏览历史消息时不会自动滚动。',
        '优化：战斗房间中，允许房主编辑房间信息。',
        '优化：市场过滤优化。',
        '修复：市场过滤后空白问题。',
        '修复：多次进入首页时，完成任务通知会发送多次',
        '修复：部分玩家在离开战斗房间后，会卡在房间内的问题。',
        `修复：修复角色属性需要进入'角色'菜单才能刷新的问题`,
        '调整：月光守护者 护盾持续时间，从1回合改为3回合',

        '下面是一些技能调整，因目前群体技能普遍强于单体技能，因此调整内容主要是增加单体技能的伤害，降低群体技能的伤害，使技能搭配时有更多的选择。',
        '调整：重击 添加110%攻击力补正',
        '调整：彗星打击 智力补正从60%提升到130%',
        '调整：冻结 智力补正从40%提升到110%',
        '调整：吸血 智力补正从10%提升到40%',
        '调整：腐蚀吐息 现在额外添加 目标最大生命值5% 与 自身攻击80% 的伤害修正',
        '调整：双重打击 敏捷补正从20%提升到80%',
        '调整：弱点打击 敏捷补正从20%提升到80%',
        '调整：冰弹 攻击补正从30%提升到100%。现在有40%使目标冻结2回合。',
        '调整：守护者激光 基础伤害从20降低到10点，当前生命值伤害从20%降低至15%。新增：对生命值高于70%的单位将额外造成智力50%的伤害。',
        '调整：暗影爆发 基础智力补正从120%降低至90%。新增：对生命值高于70%的单位将额外造成智力50%的伤害。',
        '调整：星辉冲击 基础智力补正90%降低至70%',
        '调整：星辉风暴 基础伤害从40降低至30，基础智力补正从150%降低至100%',
        '调整：毒爪 基础伤害从8提升至25',

      ]
    },
    {
      date: '2025-06-16',
      type: 'primary',
      content: [
        '优化：战斗房间列表添加名称与区域筛选。',
        '优化：战斗房间列表现在按照创建时间倒序排序，即最新创建的房间会显示在最上方。',
      ]
    },
    {
      date: '2025-06-14',
      type: 'primary',
      content: [
        '新增：两个法师装备与一件饰品。',
        '优化：在资源详情弹窗中，会显示此资源会由哪些怪物掉落。',
        '修复：猫咪助手队列中图标显示异常。',
      ]
    },
    {
      date: '2025-06-13',
      type: 'primary',
      content: [
        '新增：一些银制品。',
        '新增：一些饰品。',
        '优化：为各类养成动作添加分类。',
        '优化：市场交易分类中，添加“我的上架”分类，以便快速查看自己上架的物品。',
        '优化：为市场交易添加失败时的回滚。',
        '优化：在聊天界面点击玩家名称，可以查看玩家属性及装备。',
        '优化：在房间界面点击成员名称，可以查看成员属性及装备。',
        '调整：技能“基础治疗”，调整为对生命值最低的友方单位进行释放，没有友方单位受伤时，不会自动释放。（怪物的基础治疗同步调整）',
        '调整：召唤单位现在会在其完成动作后，再离开战斗',
        '调整：在Boss战回合，Boss生成数量将有上限（2-3视具体副本）',
      ]
    },
    {
      date: '2025-06-12',
      type: 'primary',
      version: 'v0.0.5',
      content: [
        '新增：新增了一个新高难组队副本。',
        '新增：新增了一些装备。',
        '新增：为霜之王冠添加了一些比较cool的效果。',
        '调整：调整了许多基础行为的消耗与收益。',
        '优化：允许调整技能优先级。',
        '修复：战斗中玩家战斗等级始终为1的问题',
        '修复：复活技能只会在存在阵亡的友军时才会释放',
        '修复：修复了部分道具在被保护且强化失败时，会直接回退到+0的问题',
      ]
    },
    {
      date: '2025-06-07',
      type: 'primary',
      version: 'v0.0.5',
      content: [
        '新增：战斗',
        '新增：添加了库存变动记录，可以看到本次更新后，你的库存变动情况。',
        '新增：多种基础资源的点金术',
        '新增：多种可制作道具',
        '优化：现在在装备道具时，如果原槽位已经装备了道具，则会自动进行卸下后，再完成装备。',
        '优化：现在可以直接在角色页面中对应的部位直接选择物品进行装备。',
        '优化：替换了部分资源的图标，避免重复。',
        '优化：优化了任务系统的奖励。',
      ]
    },
    {
      date: '2025-06-07',
      type: 'primary',
      content: [
        '新增：任务重随，重随消耗250金币，每次重随会额外消耗250金币',
        '优化：添加了一些减少动作所消耗资源的装备',
        '修复：修复了每4小时任务派发失败的问题',
      ]
    },
    {
      date: '2025-06-06',
      type: 'primary',
      content: [
        '新增：新手指南',
        '新增：意见反馈',
        '新增：夜间模式',
        '新增：炼金，允许你将基础资源转换为金币。',
        '新增：允许立即开始执行动作。此任务将移动到队列首进行执行，被插队动作的进度将被保留。',
        '优化：添加了一些效率装备',
        '优化：猫咪饱食度',
        '优化：默认添加14天免登录',
        '优化：任务队列中会显示完成整个队列需要消耗的饱食度',
        '调整：商店现在仅售卖基础资源，且不再接受玩家卖出资源。',
        '修复：现在聊天窗口打开时，会自动滚动到底部',
        '修复：右上角角色信息不显示问题',
      ]
    },
    {
      date: '2025-06-05',
      type: 'primary',
      version: 'v0.0.4',
      content: [
        '新增：初版猫咪助手',
        '新增：初版装备功能',
        '新增：锻造',
        '新增：纺织',
        '优化：添加了一部分效率物品，提升对应的工作效率，后续会继续更新与扩展',
        '优化：调整了一部分图标，新图标制作中',
      ]
    },
    {
      date: '2025-06-04',
      type: 'primary',
      content: [
        '新增：密码重置功能',
        '新增：用户档案（目前支持修改昵称与头像）',
        '新增：聊天功能',
        '优化：调整了任务队列中，任务结束时间的计算逻辑，现在能更准确的给出每个任务的预计完成时间',
        '优化：现在每在市场中交易(出售所得、购买花费)1金币，都将给予玩家0.04的交易技能经验',
        '优化：现在除了总等级排行榜外，还为每种角色属性（采集、钓鱼、挖掘）都创建了一个单独的等级排行榜',
        '数值变动：现在大多数行动都会消耗饱食度',
        '修复：修复了探索、寻宝事件中，部分物品获取的概率问题',
        'UI：许多UI优化',
      ]
    },
    {
      date: '2025-06-02',
      version: 'v0.0.3',
      type: 'primary',
      content: [
        '添加市场功能',
        '添加物品使用功能',
        '调整了各项属性升级所需经验',
        '添加了“烹饪”动作',
        '添加饱食度概念',
        '现在探索动作需要消耗饱食度',
      ]
    },
    {
      date: '2025-06-01',
      version: 'v0.0.2',
      type: 'primary',
      content: [
        '添加了商店功能',
        '添加了许多事件',
      ]
    },
    {
      date: '2025-05-31',
      version: 'v0.0.1',
      type: 'primary',
      content: [
        '首次上线'
      ]
    },
  ]
} as const as {
  [year: string]: {
    date: string;
    type: 'primary';
    version?: string;
    content: string[];
  }[];
}

const yearOrder = Object.keys(updateLogs).toReversed()

type UpdateLogMsg = {
  type: 'string' | 'resource' | 'state' | 'skill' | 'action';
  content: string
}

function parseUpdateLogContent(item: string): UpdateLogMsg[] {
  const result: UpdateLogMsg[] = []

  // 匹配 resource:xxx 或 state:xxx 的正则表达式
  const regex = /(resource:[a-zA-Z0-9_+\-]+)|(state:[a-zA-Z0-9_+\-]+)|(skill:[a-zA-Z0-9_+\-]+)|(action:[a-zA-Z0-9_+\-]+)/g


  let lastIndex = 0
  let match: RegExpExecArray | null

  // 遍历所有匹配项
  while ((match = regex.exec(item)) !== null) {
    const matchStart = match.index
    const matchEnd = regex.lastIndex

    // 添加匹配前的普通文本
    if (matchStart > lastIndex) {
      const textBefore = item.slice(lastIndex, matchStart)
      if (textBefore.trim()) {
        result.push({
          type: 'string',
          content: textBefore
        })
      }
    }

    // 添加匹配到的 resource 或 state
    const matchedText = match[0]
    if (matchedText.startsWith('resource:')) {
      result.push({
        type: 'resource',
        content: matchedText.replace('resource:', '')
      })
    } else if (matchedText.startsWith('state:')) {
      result.push({
        type: 'state',
        content: matchedText.replace('state:', '')
      })
    } else if (matchedText.startsWith('skill:')) {
      result.push({
        type: 'skill',
        content: matchedText.replace('skill:', '')
      })
    } else if (matchedText.startsWith('action:')) {
      result.push({
        type: 'action',
        content: matchedText.replace('action:', '')
      })
    }

    lastIndex = matchEnd
  }

  // 添加最后剩余的文本
  if (lastIndex < item.length) {
    const remainingText = item.slice(lastIndex)
    if (remainingText.trim()) {
      result.push({
        type: 'string',
        content: remainingText
      })
    }
  }

  // 如果没有匹配到任何 resource 或 state，返回整个字符串作为普通文本
  if (result.length === 0) {
    result.push({
      type: 'string',
      content: item
    })
  }

  return result
}


</script>

<style scoped>
.update-log {
  max-width: 800px;
  margin: 0 auto;
}
</style>