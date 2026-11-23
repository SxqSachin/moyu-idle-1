<template>
  <el-card class="w-full" body-class="pt-0!">
    <template #header>
      <div class="flex flex-row items-center gap-2">
        <span>
          图鉴
        </span>
        <el-tooltip placement="top">
          <template #content>
            这是炼金图鉴：在炼金台中使用正确的物品组合进行炼金时，将点亮对应条目并记录配方信息<br/>
            已解锁的条目可以查看配方细节、耗时与可能产物<br/>
            你可以在已解锁的配方中点击“使用此配方”，来快速将背包中的物品放入炼金台<br/>
            <br/>
            tips:  <br/>
            - 物品可能会有多种配方 <br/>
            - 每种配方对应的成功产物、失败产物、突变产物，只有在触发对应的结果后才会解锁 <br/>
          </template>
          <el-icon class="cursor-pointer text-gray-400">
            <Icon name="material-symbols:help"></Icon>
          </el-icon>
        </el-tooltip>
      </div>
    </template>

    <el-tabs v-model="activeTabs">
      <el-tab-pane label="总览" name="list">
        <div class="flex flex-row flex-wrap gap-4 pt-1 px-2">
          <template v-for="(atlasItem, idx) in atlasList" :key="idx">
            <GameAlchemyAtlasItem @select="p => handleSelectAtlasItem(p.items)" :atlas-item="atlasItem.items" />
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="配方" name="detail">
        <template v-if="selectedAtlas && selectedAtlas.length">

          <div class="mb-4">
            <!-- buttons to switch recipe index -->
            <div class="flex flex-wrap gap-1">
              <el-button v-for="(r, i) in selectedAtlas" :key="i" :type="getRecipeBtnIndexType(i, selectedAtlas)"
                size="small" @click="() => recipePartIndex = i" class="!px-3 !py-1">
                {{ i + 1 }}
              </el-button>
            </div>
          </div>

          <template v-for="(recipe, i) of selectedAtlas" :key="i">
            <template v-if="recipePartIndex  == i">
              <template v-if="recipe">
                <GameAlchemyAtlasRecipe :recipe="recipe" :index="i" :total="selectedAtlas.length" />
              </template>
              <template v-else>
                <el-empty description="尚未解锁"></el-empty>
              </template>
            </template>
          </template>

        </template>

        <template v-else>
          <div class="p-6">
            <el-empty description="尚未选择或无配方" />
          </div>
        </template>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { emitGetUserAlchemyAtlas, onGetUserAlchemyAtlasFailed, onGetUserAlchemyAtlasSuccess } from "~/api/game/socket/alchemy";
import { waitUtilConnected } from "~/api/game/socket/socket";
import type { FuncAction } from "~/shared/types";
import type { UserAlchemyAtlas, AlchemyAtlasEntry } from "~/shared/types/gameAlchemy";
import type { AllGameResourceID } from "~/shared/types/gameResource";

const atlas = ref<UserAlchemyAtlas>({});
const selectedAtlas = ref<AlchemyAtlasEntry[] | null>(null);

const activeTabs = ref("list");
const recipePartIndex = ref(0);

const getRecipeBtnIndexType = (index: number, selectedAtlas: AlchemyAtlasEntry[]) => {
  if (!selectedAtlas[index]) {
      return 'info'
  }

  return recipePartIndex.value === index ? 'primary' : 'default';
};

const atlasList = computed(() =>
  Object.keys(atlas.value).map((k) => ({
    id: k,
    items: atlas.value[k] || [],
  }))
);

function handleSelectAtlasItem(atlasItems: AlchemyAtlasEntry[]) {
  if (!atlasItems.length) {
    return;
  }

  selectedAtlas.value = atlasItems;
  // set initial index to first unlocked recipe if any, else 0
  const firstUnlocked = atlasItems.findIndex((i) => !!i?.recipeId);
  recipePartIndex.value = firstUnlocked >= 0 ? firstUnlocked : 0;
  activeTabs.value = "detail";
}

function jumpToSpecialRecipe(mainOutputResourceId: AllGameResourceID, index: number) {
  let specialOutput = Object.values(atlas.value).find(entry => entry?.find(recipe => recipe?.mainOutputResourceId == mainOutputResourceId))

  if (!specialOutput) {
    return;
  }

  activeTabs.value = "detail";
  selectedAtlas.value = specialOutput
  recipePartIndex.value = index;
}

let off1: FuncAction;
let off2: FuncAction;

onMounted(async () => {
  await waitUtilConnected();

  off1 = onGetUserAlchemyAtlasSuccess((data) => {
    atlas.value = data;

    setTimeout(() => {
      if (selectedAtlas.value) {
        let recipeId = selectedAtlas.value.find(item => item.recipeId)?.recipeId;
        if (recipeId) {
          selectedAtlas.value = atlasList.value.find(item => item.id === recipeId)?.items || null;
        }
      }
    }, 50)
  });

  off2 = onGetUserAlchemyAtlasFailed((data) => {
    ElNotification({
      title: "获取配方图鉴失败",
      message: data.message,
      type: "error",
    });
  });

  emitGetUserAlchemyAtlas();
});

onUnmounted(() => {
  off1?.();
  off2?.();
});

defineExpose({
  jumpToSpecialRecipe,
});
</script>

<style scoped>
/* minimal transition already present in parent style */
</style>