<template>
    <el-card>
        <el-tabs v-model="activeTab" class="w-full">
            <el-tab-pane :lazy="true" label="属性与装备" name="index">
                <GameCharacterStatus></GameCharacterStatus>
            </el-tab-pane>

            <el-tab-pane :lazy="true" label="技能&物品袋" name="inBattle">
                <div class="flex flex-col gap-4">
                    <el-card body-class="p-2!">
                        <template #header>
                            <div class="flex items-center">
                                <span>技能配置</span>
                                <el-tooltip placement="top">
                                    <template #content>
                                        你可以在脱战的情况下，对技能进行配置。<br />
                                        - 已启用的技能，在战斗中将会按照你设置的顺序依次自动释放。<br />
                                        - 如果你为某个技能配置了释放逻辑，则仅会在满足释放逻辑的情况下，才会自动进行释放。<br />
                                        - 释放后技能将会进入冷却，冷却结束后才会再次自动释放。<br />
                                        - 如果没有任何技能可以释放，则会进行普通攻击。<br />
                                        - 你可以通过拖动来调整技能释放的顺序。<br />
                                        - 你通过技能书、装备获得的新技能，将总是启用状态
                                        - 你可以禁用你不想使用的技能，被禁用的技能可以在“未启用”面板中找到。<br />
                                        - ps.如果你把普通攻击放在首位且没有为其设置释放条件，则位于普通攻击后的技能将永远不会被释放。<br />
                                    </template>
                                    <el-icon class="ml-1 cursor-pointer text-gray-400">
                                        <Icon name="material-symbols:help"></Icon>
                                    </el-icon>
                                </el-tooltip>
                            </div>
                        </template>
                        <GameCharacterStatusSkill></GameCharacterStatusSkill>
                    </el-card>
                    <el-card body-class="p-2!">
                        <template #header>
                            <div class="flex items-center">
                                <span>战斗物品配置</span>
                                <el-tooltip placement="top">
                                    <template #content>
                                        你可以在脱战的情况下，对战斗物品进行配置。<br />
                                        - 你可以将背包中，包含战斗内效果的可食用物品转移到战斗物品袋中。<br />
                                        - 战斗物品袋中的物品，战斗中将会按照你设置的顺序自动使用。<br />
                                        - 如果你为某种物品配置了使用逻辑，则仅会在满足使用逻辑的情况下，才会自动进行使用。<br />
                                        - 物品使用后，将会进入冷却，冷却结束后才会再次自动使用。<br />
                                        - 使用物品后，战斗物品带中的物品数量将会减少，如果物品带中没有存量物品，则不会进行使用。<br />
                                        - 你可以通过拖动来调整战斗物品使用的顺序。<br />
                                    </template>
                                    <el-icon class="ml-1 cursor-pointer text-gray-400">
                                        <Icon name="material-symbols:help"></Icon>
                                    </el-icon>
                                </el-tooltip>
                            </div>
                        </template>
                        <GameCharacterStatusBattleInventory></GameCharacterStatusBattleInventory>
                    </el-card>
                </div>
            </el-tab-pane>

            <el-tab-pane :lazy="true" name="skillTree">
                <template #label>
                    <el-text>专精</el-text>
                    <el-popover :width="320" trigger="hover" :show-after="380">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400 ml-1">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>
                        <div class="text-xs">
                            <div class="flex flex-col gap-1">
                                <div>专精系统包含战斗系与生活系两大类</div>
                                <div>每15级生活等级（交易与强化不进行计算），可以获得1点专精点</div>
                                <div>每7级战斗等级，可以获得1点专精点</div>
                                <div>计算等级时，仅计算原始等级，通过装备、状态获得的属性不会计算在内</div>
                                <div>部分节点有前置要求，必须先解锁前置节点才能解锁</div>
                                <div>部分节点可以多级解锁，每次解锁都会提升对应的加成效果</div>
                                <div>你可以通过使用一些物品来永久获得专精点</div>

                                <div>目前：</div>
                                <div>你可以根据自己的需求，随时调整你的专精配置</div>
                                <div>你可以随时重置已解锁的节点，重置后会返还全部已消耗的专精点</div>
                                <div>专精的内容近期可能会有很多扩展和调整</div>
                            </div>
                        </div>
                    </el-popover>
                </template>

                <GameSkillTreeAllSkillTreesPanel></GameSkillTreeAllSkillTreesPanel>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="祝福" name="affix">
                <template #label>
                    <el-text>祝福</el-text>
                    <el-popover :width="320" trigger="hover" :show-after="380">
                        <template #reference>
                            <el-icon class="cursor-pointer text-gray-400 ml-1">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </template>
                        <div class="text-xs">
                            <div class="flex flex-col gap-1">
                                <div>当总等级到达200级（不包括“交易”等级）后，能够获得祝福</div>
                                <div>初始状态下，你可以保留{{ CHARACTER_AFFIX_MAX_OWNED_DEFAULT }}个祝福，并启用其中的{{ CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT }}个</div>
                            </div>
                        </div>
                    </el-popover>
                </template>
                <GameCharacterAffixPanel></GameCharacterAffixPanel>
            </el-tab-pane>

            <el-tab-pane :lazy="true" label="配装方案" name="outfit">
                <GameCharacterOutFit></GameCharacterOutFit>
            </el-tab-pane>
        </el-tabs>
    </el-card>
</template>
<script setup lang="ts">
import { CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT, CHARACTER_AFFIX_MAX_OWNED_DEFAULT } from '~/shared/data/characterAffixConstants';

const activeTab = ref("index");
</script>