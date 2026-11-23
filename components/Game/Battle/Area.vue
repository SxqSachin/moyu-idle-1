<template>
    <div class="p-4">
        <h2 class="text-2xl font-bold mb-4">战斗大厅</h2>
        <div class="text-gray-600 dark:text-gray-400 text-sm">
            喵呜~欢迎来到猫猫们的战斗大厅！在这里可以选择冒险区域、加入房间、与小伙伴们一起挑战强敌，收获成长与荣耀。记得团结协作，勇敢探索，每一次战斗都是新的冒险喵 (=｀ω´=)

            <el-button class="ml-4" size="small" type="primary" plain @click="showBattleHelp = true">查看提示</el-button>
        </div>

        <el-dialog v-model="showBattleHelp" title="关于战斗" :width="isMobile ? '100%' : '640px'">
            <el-tabs v-model="helpActiveTab">
                <el-tab-pane label="副本探险" name="area">
                    <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                        <div>关于战斗：</div>
                        <ol class="list-decimal list-inside text-xs text-xs/6">
                            <li>每只猫咪初始有50基础生命与魔法。
                                每点<span class="drop-shadow-lg font-bold">耐力</span>提升5点最大生命值，每回合开始时回复{{HP_REGEN_PER_TURN_PRE_STAMINA}}生命值；每点<span class="drop-shadow-lg font-bold">智力</span>提升5点最大魔法值，每回合开始时回复{{MP_REGEN_PER_TURN_PRE_INTELLIGENCE}}魔法值。
                            </li>
                            <li>战斗开始前，会根据战斗中每个成员的<span class="drop-shadow-lg font-bold">“敏捷”</span>属性的数值，确定行动顺序。</li>
                            <li>战斗开始后，玩家的属性信息将被固定（即修改装备也不会影响玩家在战斗中的数据）。</li>
                            <li>
                                <p class="inline">战斗掉落的资源，会在这一轮<span class="font-bold">战斗成功后</span>，由每个玩家独立判定各自的掉落物。</p>
                                <div class="pl-4">
                                    <p>此外：</p>
                                    <p>每场战斗胜利后，每名成员各自有{{BATTLE_EXPERIENCE_DROP_PERCENT}}%几率获得力量精华、敏捷精华、智力精华。</p>
                                </div>
                            </li>
                            <li>战斗开始后，直到战斗完成或战斗失败前，无法离开战斗。</li>
                            <li>
                                <p class="inline">每击败一个怪物，都会为你提供“战斗”属性的经验。同时：</p>
                                <div class="pl-4">
                                    <p> 每1级“战斗”等级，给予{{ATTACK_PER_BATTLE_LEVEL}}的“攻击”、{{DEFENCE_PER_BATTLE_LEVEL}}的“防御" (向下取整，仅在战斗中显示此加成，角色界面不显示)</p>
                                    <p class="mb-0">每造成1点伤害，给予{{STRENGTH_EXP_PER_DEAL_DAMAGE}}的“力量”经验、{{DEX_EXP_PER_DEAL_DAMAGE}}的“敏捷”经验、{{ATTACK_EXP_PER_DEAL_DAMAGE}}的“攻击”经验</p>
                                    <ul class="pl-4 list-disc">
                                        <li> 友军每造成1点伤害，其他友军均能够对应经验的{{ DAMAGE_EXP_SHARE_PERCENT * 100 }}%</li>
                                        <li> 召唤物造成伤害时，召唤者能够获取对应经验的{{ SOMMONER_DAMAGE_EXP_SHARE_PERCENT * 100 }}%</li>
                                    </ul>
                                    <p> 每受到1点伤害，给予{{STAMINA_EXP_PER_TAKE_DAMAGE}}的“耐力”经验、{{DEX_EXP_PER_TAKE_DAMAGE}}的“敏捷”经验、{{DEFENCE_EXP_PER_DEAL_DAMAGE}}的“防御”经验</p>
                                    <p> 每次释放技能，给予对应技能1点经验</p>
                                    <p> 每次释放技能，会提升{{INTELLIGENCE_EXP_PRE_CAST_SKILL}}智力属性的经验</p>
                                </div>
                                <p class="inline-block pl-4">这些属性将在每场战斗结束后结算</p>
                            </li>
                        </ol>
                    </div>
                </el-tab-pane>
                <el-tab-pane label="大麻烦" name="worldBoss">
                    <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                        <div>关于“大麻烦”：</div>
                        <ol class="list-decimal list-inside text-xs text-xs/6">
                            <li>“大麻烦”是一类全服Boss挑战。</li>
                            <li>它们大多非常强大，需要大家齐心协力才能击退。</li>
                            <li>它们的血量将在不同战斗中共享并保存战斗进度。因此不必担心因战斗失败导致进度丢失。</li>
                            <li>当某个“大麻烦”被击败后，只要你所在的队伍房间对“大麻烦”造成过伤害，即使后续离开了“大麻烦”战斗，你也可以参与战利品结算。 </li>
                            <div class="ml-2"> - 参与战斗所获的奖励，将在结束结算完成后（通常5分钟内），发放到玩家的收获箱中。</div>
                            <li>当某个“大麻烦”被击败后，未参与战斗的玩家，可以在战斗结算完成后，在“大麻烦”对应的卡片内领取一次奖励，此时存在一些特殊规则：</li>
                            <div class="ml-2">(1). 对于100%掉落的物品，获取的数量降低35%</div>
                            <div class="ml-2"> - 例，某“大麻烦”100%掉落100000-200000金币，则通过此方式，只能获得65000-130000金币</div>
                            <div class="ml-2"> - 向下取整，对于只掉落1个的物品，则总是至少获得1个</div>
                            <div class="ml-2">(2). 对于非100%掉落的物品，则获取概率降低80%。</div>
                            <div class="ml-2"> - 例：某战利品的掉落率为5%，则通过此方法获取奖励时，此战利品的获取概率为5% * 0.2 = 1%</div>

                            <li>结算时，根据伤害排名获得额外掉落概率提升：</li>
                            <div class="ml-2"> - 伤害前25的队伍，获得额外100%掉落概率提升(*200%)</div>
                            <div class="ml-2"> - 伤害前125的队伍，获得额外50%掉落概率提升(*150%)</div>
                            <div class="ml-2"> - 每个分段不叠加</div>

                            <br/>
                            <li>你可以提前设置击败Boss后的动作，选择在房间中等待或者自动开始副本探索。</li>
                        </ol>
                    </div>
                    <!-- 留空：用户后续补充内容 -->
                </el-tab-pane>
            </el-tabs>
            <template #footer>
                <el-button type="primary" @click="showBattleHelp = false">我知道了</el-button>
            </template>
        </el-dialog>

        <h2 v-if="isBeginner" class="font-bold my-4 flex flex-col gap-2">
            <span class="text-base font-bold"> 喵呜~见习猫猫的战斗小提醒： </span>
            <el-text class="self-start!">见习猫猫可以在“镇中心”->“征战圣火纪念碑”处获取“见习猫猫战斗祝福”，帮助见习猫猫更安全的进行战斗。</el-text>
            <el-text class="self-start!">见习猫猫可以在“酒馆”中以十分优惠的时薪聘请“雇佣兵猫猫”带你熟悉战斗！（如果还没有建造“酒馆”，可以在“家园”->“建造”中进行建造）。</el-text>
            <el-text class="self-start!">见习猫猫在战斗中的前几步放慢一点也没关系！猫猫村中的每个人都可以有自己的节奏。</el-text>
            <el-text class="self-start!">你可以慢慢熟悉战斗，逐步接触装备、技能、专精、祝福等战斗系统。</el-text>
        </h2>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="探险" name="area">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <el-card v-for="area in areaList" :key="area.id" class="cursor-pointer hover:shadow-xl transition" @click="showAreaDetail(area)" body-class="h-full flex flex-col justify-between">
                    <div class="flex flex-col gap-2">
                      <div class="text-lg font-bold">{{ area.name }}</div>
                      <div class="text-gray-500 line-clamp-2">{{ area.description }}</div>
                      <!-- <div v-if="area.specialDescription">
                        <el-tag type="warning">场地效果</el-tag>
                      </div> -->
                      <div class="flex gap-4 mt-2">
                        <span class="text-sm" v-if="area.minLevel || area.maxLevel">等级范围：
                            <template v-if="area.minLevel"> {{ area.minLevel }} </template>
                            <template v-if="area.minLevel && area.maxLevel"> - </template>
                            <template v-if="area.maxLevel"> {{ area.maxLevel }} </template>
                        </span>
                        <span class="text-sm">敌人数：{{ area.minEnemies }} - {{ area.maxEnemies }}</span>
                      </div>
                    </div>

                    <div>
                      <el-divider></el-divider>

                      <div class="flex flex-row gap-4 mt-4">
                        <el-button plain class="mx-0! w-full" @click.stop="showAreaDetail(area)">详情</el-button>
                        <el-button type="primary" class="mx-0! w-full"
                          @click.stop="openCreateRoomDialog(area)">创建房间</el-button>
                      </div>
                    </div>
                </el-card>
            </div>
          </el-tab-pane>
          <el-tab-pane label="“大麻烦”" name="worldBoss">
            <GameBattleWorldBossList />
          </el-tab-pane>
        </el-tabs>        <!-- 区域详情弹窗 -->
        <el-dialog v-model="areaDialogVisible" width="700px" :title="areaDetail?.name" destroy-on-close>
            <div v-if="areaDetail">
                <div class="mb-2 text-gray-600 dark:text-gray-400">{{ areaDetail.description }}</div>
                <!-- <div v-if="areaDetail.specialDescription" class="mb-4 text-xs text-gray-500 dark:text-gray-400 mt-4">
                    <div>特殊效果：</div>
                    {{ areaDetail.specialDescription }}
                </div> -->
                <div class="mb-4 flex gap-6">
                    <span>等级范围：{{ areaDetail.minLevel }} - {{ areaDetail.maxLevel }}</span>
                    <span>敌人数：{{ areaDetail.minEnemies }} - {{ areaDetail.maxEnemies }}</span>
                </div>
                <el-card shadow="never" class="mb-4">
                    <div class="font-semibold mb-2">普通敌人池 <span
                            class="text-gray-400 dark:text-gray-400 font-light">(点击名称查看详情)</span></div>
                    <el-table :data="getEnemyPool(areaDetail.enemyPool)" size="small" border>
                        <el-table-column prop="name" label="敌人" width="100">
                            <template #default="{ row }">
                                <el-tag class="cursor-pointer" type="info" effect="plain" @click="showEnemyDetail(row)">
                                    {{ row.name }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column prop="level" label="等级" width="60" />
                        <el-table-column prop="hp" label="生命" width="70" />
                        <el-table-column prop="attack" label="攻击" width="70" />
                        <el-table-column prop="defense" label="防御" width="70" />
                        <el-table-column prop="description" label="描述" />
                        <el-table-column prop="weight" label="权重" width="60" />
                        <el-table-column prop="expReward" label="给予经验" width="60" />
                    </el-table>
                </el-card>
                <el-card v-if="areaDetail.specialBattles?.length" shadow="never" class="mb-4">
                    <div class="font-semibold mb-2">特殊战斗</div>
                    <el-table :data="areaDetail.specialBattles" size="small" border>
                        <el-table-column prop="every" label="每N次" width="80" />
                        <el-table-column label="敌人">
                            <template #default="{ row }">
                                <div class="flex flex-wrap gap-2">
                                    <el-tag v-for="e in getEnemyPool(row.enemies)" :key="e.id" type="danger"
                                        effect="plain" class="cursor-pointer" @click.stop="showEnemyDetail(e)">
                                        {{ e.name }} (权重{{ e.weight }})
                                    </el-tag>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="description" label="描述" />
                    </el-table>
                </el-card>
            </div>
        </el-dialog>


        <!-- 敌人详情弹窗 -->
        <el-dialog v-model="enemyDialogVisible" width="400px" :title="enemyDetail?.name" destroy-on-close>
            <div v-if="enemyDetail" class="space-y-2">
                <ul class="space-y-1 text-sm">
                    <li><span class="font-semibold">等级：</span>{{ enemyDetail.level }}</li>
                    <li><span class="font-semibold">生命：</span>{{ enemyDetail.maxHp }}</li>
                    <li><span class="font-semibold">魔法：</span>{{ enemyDetail.maxMp }}</li>
                    <!-- <li><span class="font-semibold">攻击：</span>{{ enemyDetail.attack }}</li>
                    <li><span class="font-semibold">防御：</span>{{ enemyDetail.defense }}</li> -->
                    <li><span class="font-semibold">力量：</span>{{ enemyDetail.status.strength.level }}</li>
                    <li><span class="font-semibold">敏捷：</span>{{ enemyDetail.status.dexterity.level }}</li>
                    <li><span class="font-semibold">智力：</span>{{ enemyDetail.status.intelligence.level }}</li>
                    <li><span class="font-semibold">耐力：</span>{{ enemyDetail.status.stamina.level }}</li>
                    <li><span class="font-semibold">攻击属性：</span>{{ enemyDetail.status.attacking.level }}</li>
                    <li><span class="font-semibold">防御属性：</span>{{ enemyDetail.status.defencing.level }}</li>
                    <el-divider class="my-2!"></el-divider>
                    <li class="mb-1"><span class="font-semibold">描述：</span>{{ enemyDetail.description }}</li>
                    <li v-if="enemyDetail.skills && Object.keys(enemyDetail.skills).length" class="mb-1">
                        <span class="font-semibold">技能：</span>
                        <span>
                            <span v-for="(skill, skillId) in enemyDetail.skills" :key="skillId" class="mr-1">
                                <GameCommonBattleSkillName :skill-id="skillId" :level="skill!.level" />
                            </span>
                        </span>
                    </li>
                  <li v-if="enemyDetail.state && Object.keys(enemyDetail.state).length" class="mb-1">
                    <span class="font-semibold">状态：</span>
                    <span>
                      <span v-for="(state, stateId) in enemyDetail.state" :key="stateId" class="mr-1">
                        <GameCommonStateName :state-id="stateId"></GameCommonStateName>
                      </span>
                    </span>
                  </li>
                  <li v-if="enemyDetail.equipment && Object.keys(enemyDetail.equipment).length" class="mb-1">
                    <span class="font-semibold">装备：</span>
                    <span>
                      <span v-for="(equipmentId, part) in enemyDetail.equipment" :key="part" class="mr-1">
                        <template v-if="equipmentId">
                            <GameCommonResourceIconAndName :resource-id="equipmentId" />
                        </template>
                      </span>
                    </span>
                  </li>
                    <li v-if="enemyDetail.drops && enemyDetail.drops.length">
                        <span class="inline-block font-semibold mb-1">掉落：</span>
                        <div class="inline-flex flex-row gap-2 flex-wrap">
                            <GameCommonResourceIconAndName v-for="drop in enemyDetail.drops" :key="drop.id"
                                :resource-id="drop.id">: {{ getRewardCountAndPercentStr(drop) }}
                            </GameCommonResourceIconAndName>
                        </div>
                    </li>
                </ul>
            </div>
        </el-dialog>

        <!-- 创建房间弹窗 -->
        <el-dialog v-model="showCreateDialog" title="创建战斗房间" width="400px">
            <GameBattleCreateBattleRoom :default-area="createDialogDefaultArea || 'forest_001'" @create-room="onCreateRoom" @cancel="showCreateDialog = false"></GameBattleCreateBattleRoom>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, } from "vue";
import { allBattleAreas } from "@/shared/data/allBattleInfo";
import { allGameEnemies } from "@/shared/data/allGameEnemy";
import { GameCommonResourceIconAndName } from "#components";
import type { Enemy, ItemDrop } from "~/shared/types/emeny";
import type { AllBattleAreaID, BattleArea } from "~/shared/types/battle";
import { ATTACK_EXP_PER_DEAL_DAMAGE, ATTACK_PER_BATTLE_LEVEL, BATTLE_EXPERIENCE_DROP_PERCENT, BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, DAMAGE_EXP_SHARE_PERCENT, DEFENCE_EXP_PER_DEAL_DAMAGE, DEFENCE_PER_BATTLE_LEVEL, DEX_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_TAKE_DAMAGE, HP_REGEN_PER_TURN_PRE_STAMINA, INTELLIGENCE_EXP_PRE_CAST_SKILL, MIN_BATTLE_ROUND, MP_REGEN_PER_TURN_PRE_INTELLIGENCE, SOMMONER_DAMAGE_EXP_SHARE_PERCENT, STAMINA_EXP_PER_TAKE_DAMAGE, STRENGTH_EXP_PER_DEAL_DAMAGE } from "~/shared/data/constant";
import { useIsBeginner } from "~/composables/game/useIsBeginner";

const emits = defineEmits(["createRoom"])

const props = defineProps<{ defaultTab?: 'area' | 'worldBoss' }>()

const isBeginner = useIsBeginner();

const areaList = Object.values(allBattleAreas) as BattleArea[];

const activeTab = ref(props.defaultTab || 'area');

watch(() => props.defaultTab, (val) => {
    activeTab.value = val || 'area'
})

const { isMobile } = useDevice();

const showBattleHelp = ref(false);
const helpActiveTab = ref<'area'|'worldBoss'>('area');

const areaDialogVisible = ref(false);
const areaDetail = ref<any>(null);

function showAreaDetail(area: any) {
    areaDetail.value = area;
    areaDialogVisible.value = true;
}

function getEnemyPool(pool: any[]) {
    return pool.map(e => ({
        // @ts-ignore
        ...allGameEnemies[e.id],
        weight: e.weight,
    })).filter(Boolean);
}

const enemyDialogVisible = ref(false);
const enemyDetail = ref<Enemy>();

function showEnemyDetail(enemy: any) {
    enemyDetail.value = enemy;
    enemyDialogVisible.value = true;
}

const getRewardCountAndPercentStr = (reward: ItemDrop) => {
    let count = `${reward.range.min} ~ ${reward.range.max}`
    let percent = +(reward.percent * 100).toFixed(2)
    if (percent == ~~percent) {
        percent = ~~percent
    }
    return `${count} (${percent}%)`
}

// 创建房间相关
const showCreateDialog = ref(false);
const createDialogDefaultArea = ref<AllBattleAreaID | undefined>('forest_001');

function openCreateRoomDialog(area: any) {
    createDialogDefaultArea.value = area.id;

    showCreateDialog.value = true;
}

function onCreateRoom() {
    showCreateDialog.value = false;
    emits('createRoom');
}

</script>