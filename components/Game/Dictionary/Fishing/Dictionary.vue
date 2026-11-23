<template>
  <div>
    <el-card body-class="p-3! md:p-4!">

      <el-tabs v-model="activeFishTab" class="w-full">
        <el-tab-pane label="地点" name="地点" :lazy="true">
          <el-tabs v-model="activePond" class="w-full">
            <el-tab-pane v-for="(pond, id) in ponds" :key="id" :label="pond.name" :name="id" :lazy="true">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
                <template v-for="cfg in pond.fishConfig" :key="cfg.speciesId">
                  <el-card shadow="hover" body-class="text-sm">
                    <GameDictionaryFishingCard :cfg="cfg" />
                  </el-card>
                </template>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        <el-tab-pane label="饵料" name="饵料" :lazy="true">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
                <template v-for="cfg in allFishingBaits" :key="cfg.resourceId">
                  <el-card shadow="hover" body-class="text-sm">
                    <GameDictionaryFishingBait :cfg="cfg" />
                  </el-card>
                </template>
              </div>
        </el-tab-pane>
      </el-tabs>


    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { allFishingBaits } from '~/shared/data/allFishBaitInfo'
import { allFishPond } from '~/shared/data/allFishPond'

type FishPondMap = typeof allFishPond

const ponds = allFishPond as FishPondMap

const pondKeys = Object.keys(ponds)
const activePond = ref<string>(pondKeys.length ? pondKeys[0] : '')
const activeFishTab = ref<string>('地点')
</script>

<style scoped>
.fish-species-card img {
  border-radius: 6px;
}
</style>
