<template>
  <el-card body-class="p-3! md:p-4!">
    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="物品" name="resource" class="text-center">
        <GameDictionaryResource></GameDictionaryResource>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="技能" name="skill" class="text-center">
        <div class="flex flex-col gap-3">
          <el-input v-model="searchSkill" clearable placeholder="搜索技能名称或描述" class="mb-3" />
          <el-divider class="my-1!"></el-divider>
          <div v-if="filteredSkills.length === 0" class="text-gray-400 text-center py-6">未找到相关技能</div>
          <el-tabs v-model="skillCategory" class="w-full">
            <el-tab-pane label="全部" name="all"></el-tab-pane>
            <el-tab-pane label="物理伤害" name="physical"></el-tab-pane>
            <el-tab-pane label="魔法伤害" name="magical"></el-tab-pane>
            <el-tab-pane v-for="(type, key) in skillTypeMap" :key="key" :label="type.label" :name="key"></el-tab-pane>
          </el-tabs>
          <div v-if="filteredSkills.length" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <template v-for="skill in filteredSkills" :key="skill.id">
              <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                <GameCommonBattleSkillName :plain="true" :skill-id="skill.id" />
              </div>
            </template>
          </div>

        </div>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="状态" name="state" class="text-center">
        <div class="flex flex-col gap-3">
          <el-input v-model="searchState" clearable placeholder="搜索状态名称或描述" class="mb-3" />
          <el-divider class="my-1!"></el-divider>
          <div v-if="filteredStates.length === 0" class="text-gray-400 text-center py-6">未找到相关状态</div>

          <el-tabs class="w-full" model-value="all">
            <el-tab-pane label="全部" name="all">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
            <el-tab-pane label="增益" name="buff">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates.filter(state => state.isBuff)" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
            <el-tab-pane label="减益" name="debuff">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates.filter(state => state.isDebuff)" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
            <el-tab-pane label="控制状态" name="control">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates.filter(state => state.consumeTurn)" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
            <el-tab-pane label="阵亡后保留" name="keepOnDeath">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates.filter(state => state.keepOnDeath)" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
            <el-tab-pane label="可叠加" name="stackable">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="state in filteredStates.filter(state => state.stackable)" :key="state.id">
                  <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                    <GameCommonStateName class="w-full h-full block" :plain="true" :delay="0"
                      :state-id="(state.id as AllBattleStateId)" />
                  </div>
                </template>
              </div>
            </el-tab-pane>
          </el-tabs>

        </div>
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="单位" name="enemy" class="text-center">
        <div class="flex flex-col gap-3">
          <el-input v-model="searchEnemy" clearable placeholder="搜索名称或描述" class="mb-3" />
          <el-divider class="my-1!"></el-divider>
          <div v-if="filteredEnemies.length === 0" class="text-gray-400 text-center py-6">未找到相关单位</div>
          <el-tabs class="w-full" model-value="all">
            <el-tab-pane label="全部" name="all" :lazy="true">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="enemyDetail in filteredEnemies" :key="enemyDetail.id">
                  <el-popover trigger="hover" :width="320" :show-after="380">
                    <template #reference>
                      <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                        {{ enemyDetail.name }}
                      </div>
                    </template>
                    <ul class="space-y-1 text-sm">
                      <GameBattleBaseBattleUnit :unit="enemyDetail" class="mb-2"></GameBattleBaseBattleUnit>
                      <li v-if="enemyDetail.drops && enemyDetail.drops.length">
                        <span class="inline-block font-semibold mb-1">掉落：</span>
                        <div class="inline-flex flex-row gap-2 flex-wrap">
                          <GameCommonResourceIconAndName v-for="drop in enemyDetail.drops" :key="drop.id"
                            :resource-id="drop.id">
                            {{ getRewardCountAndPercentStr(drop) }}
                          </GameCommonResourceIconAndName>
                        </div>
                      </li>
                    </ul>
                  </el-popover>
                </template>
              </div>
            </el-tab-pane>
            <template v-for="area in allBattleAreas" :key="area.id">
              <el-tab-pane :label="area.name" :name="area.id" :lazy="true">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <template v-for="enemyDetail in getEnemiesInArea(area.id)"
                    :key="enemyDetail.id">

                    <el-popover trigger="hover" :width="320" :show-after="380">
                      <template #reference>
                        <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                          {{ enemyDetail.name }}
                        </div>
                      </template>
                      <ul class="space-y-1 text-sm">
                        <GameBattleBaseBattleUnit :unit="enemyDetail" class="mb-2"></GameBattleBaseBattleUnit>
                        <li v-if="enemyDetail.drops && enemyDetail.drops.length">
                          <span class="inline-block font-semibold mb-1">掉落：</span>
                          <div class="inline-flex flex-row gap-2 flex-wrap">
                            <GameCommonResourceIconAndName v-for="drop in enemyDetail.drops" :key="drop.id"
                              :resource-id="drop.id">
                              {{ getRewardCountAndPercentStr(drop) }}
                            </GameCommonResourceIconAndName>
                          </div>
                        </li>
                      </ul>
                    </el-popover>
                  </template>
                </div>
              </el-tab-pane>
            </template>
            <el-tab-pane label="特殊" name="special" :lazy="true">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <template v-for="enemyDetail in specialUnites" :key="enemyDetail.id">
                  <el-popover trigger="hover" :width="320" :show-after="380">
                    <template #reference>
                      <div class="cursor-pointer dictionary-item-card bg-gray-100 dark:bg-gray-800">
                        {{ enemyDetail.name }}
                      </div>
                    </template>
                    <ul class="space-y-1 text-sm">
                      <GameBattleBaseBattleUnit :unit="enemyDetail" class="mb-2"></GameBattleBaseBattleUnit>
                      <li v-if="enemyDetail.drops && enemyDetail.drops.length">
                        <span class="inline-block font-semibold mb-1">掉落：</span>
                        <div class="inline-flex flex-row gap-2 flex-wrap">
                          <GameCommonResourceIconAndName v-for="drop in enemyDetail.drops" :key="drop.id"
                            :resource-id="drop.id">
                            {{ getRewardCountAndPercentStr(drop) }}
                          </GameCommonResourceIconAndName>
                        </div>
                      </li>
                    </ul>
                  </el-popover>
                </template>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-tab-pane>

      <el-tab-pane :lazy="true" label="垂钓" name="fishing" class="text-center">
        <FishingDictionary />
      </el-tab-pane>

      <el-tab-pane :lazy="true" label="炼金" name="alchemyTag" class="text-center">
        <div class="flex flex-col gap-4 divide-y divide-gray-200 dark:divider-gray-800 px-2">
          <template v-for="tag of AllResourceAlchemyTag">
            <div class="pb-12">
              <h3 class="text-left mb-4 font-bold">
                {{ tag.name }}
              </h3>
              <div class="flex flex-row flex-wrap gap-x-4 gap-y-8">
                <template v-if="getResourceWithAlchemyTag(tag.id).length">
                  <template v-for="resource of getResourceWithAlchemyTag(tag.id)">
                    <GameDictionaryItem :resource-id="resource.id"></GameDictionaryItem>
                  </template>
                </template>
                <template v-else>
                  <div class="text-sm text-gray-400 dark:text-gray-600">暂无内容</div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { epPropKey } from "element-plus/es/utils/index.mjs";
import { ref, computed } from "vue";
import FishingDictionary from "~/components/Game/Dictionary/Fishing/Dictionary.vue";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { allBattleState } from '~/shared/data/allBattleState';
import { allGameBattleSkills } from '~/shared/data/allGameBattleSkill';
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import { allGameResource } from "~/shared/data/allGameResources";
import type { BattleArea } from "~/shared/types/battle";
import { type BattleState, type AllBattleStateId } from "~/shared/types/BattleState";
import { type Enemy, type ItemDrop } from "~/shared/types/emeny";
import { AllResourceAlchemyTag, type AllResourceAlchemyTagId } from "~/shared/types/gameAlchemy";
import { DamageType, skillTypeMap, type SkillType } from "~/shared/types/skill";
import type { BattleSkillInfoItem } from "~/shared/types/unit";
import { isDamageType } from "~/shared/utils/game/battle";

const activeTab = ref("resource");


const skillCategory = ref<SkillType | "all" | "physical" | "magical">("all");

const searchSkill = ref("");
const searchState = ref("");
const searchEnemy = ref("");

const filteredSkills = computed(() => {
  let res = Object.values(allGameBattleSkills).filter(skill =>
    (skill.name + (skill.effectStr || "")).toLowerCase().includes(searchSkill.value.trim().toLowerCase())
  )

  if (skillCategory.value === "physical") {
    res = res.filter(skill => isDamageType(skill.damageType, DamageType.Physical));

    return res;
  } else if (skillCategory.value === "magical") {
    res = res.filter(skill => isDamageType(skill.damageType, DamageType.Magical));

    return res;
  }

  if (skillCategory.value == "all") {
    return res;
  }

  // @ts-ignore
  return res.filter(skill => skill.skillType.includes(skillCategory.value));
});

const filteredStates = computed<BattleState[]>(() =>
  Object.values(allBattleState).filter(state =>
    (state.name + (state.description || "")).toLowerCase().includes(searchState.value.trim().toLowerCase())
  )
);

// @ts-ignore
const filteredEnemies = computed<Enemy[]>(() =>
  Object.values(allGameEnemies).filter(enemy =>
    (enemy.name + (enemy.description || "")).toLowerCase().includes(searchEnemy.value.trim().toLowerCase())
  )
);

const getRewardCountAndPercentStr = (reward: ItemDrop) => {
  let count = `${reward.range.min} ~ ${reward.range.max}`
  let percent = +(reward.percent * 100).toFixed(2)
  if (percent == ~~percent) {
    percent = ~~percent
  }
  return `${count} (${percent}%)`
}

const getResourceWithAlchemyTag = (tag: AllResourceAlchemyTagId) => {
  return Object.values(allGameResource).filter(resource => resource.alchemyTag?.includes(tag));
}

const getEnemiesInArea = (areaId: string) => {
  const area = Object.values(allBattleAreas).find(a => a.id === areaId) as BattleArea;
  if (!area) return [];

  const normalEnemyIds = Object.values(area.enemyPool).map(ep => ep.id);
  const specialEnemyIds = area.specialBattles?.flatMap(sp => sp.enemies.map(e => e.id)) || [];

  return filteredEnemies.value.filter(enemy => [...normalEnemyIds, ...specialEnemyIds].includes(enemy.id));
}


const specialUnites = computed(() => {
  // 返回不存在于所有区域中的单位
  const allAreaEnemyIds = new Set<string>();
  Object.values(allBattleAreas).forEach(area => {
    Object.values(area.enemyPool).forEach(ep => allAreaEnemyIds.add(ep.id));
    area.specialBattles?.forEach(sp => sp.enemies.forEach(e => allAreaEnemyIds.add(e.id)));
  });
  return filteredEnemies.value.filter(enemy => !allAreaEnemyIds.has(enemy.id));
})

</script>

<style scoped>
.dictionary-card {
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
  border-radius: 16px;
  box-shadow: 0 2px 16px 0 rgba(60, 60, 100, 0.08);
}

.dictionary-item-card {
  border-radius: 10px;
  border: none;
  transition: box-shadow 0.2s;
  padding: 12px 16px;
}

.dictionary-item-card:hover {
  box-shadow: 0 4px 16px 0 rgba(80, 120, 200, 0.13);
  border-color: #a5b4fc;
}

.el-input {
  max-width: 320px;
  margin: 0 auto;
}
</style>