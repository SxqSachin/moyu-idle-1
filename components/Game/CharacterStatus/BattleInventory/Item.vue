<template>
  <el-card :key="item.id" class="w-56" shadow="never" body-style="padding: 8px;">
    <div class="flex items-center gap-2">
      <el-popover width="240" :show-after="200">
        <template #reference>
          <div class="w-full">
            <div class="flex items-center gap-2 cursor-pointer">
              <GameCommonSimpleResourceIconAndName :icon-size="10" :resource-id="item.id" :hide-name="true">
              </GameCommonSimpleResourceIconAndName>
              <span class="font-bold">{{ item.name }}</span>
            </div>
            <div class="text-xs text-gray-500 w-full overflow-hidden truncate">{{ item.description }}</div>
            <div class="mt-1 text-xs text-gray-400">剩余：{{ item.remainingCount }}</div>
            <div class="mt-1 text-xs text-gray-400">准备：{{ item.prepareCount }}</div>
          </div>
        </template>
        <div>
          <span class="text-xs text-gray-500"> 战斗中效果 </span>
          <div class="flex flex-col flex-wrap gap-1 mt-1">
            <GameCommonResourceInBattleEffect :resource-id="item.id"></GameCommonResourceInBattleEffect>
          </div>
        </div>
      </el-popover>
    </div>

    <el-divider class="my-2!"></el-divider>

    <div class="mt-2">
      <el-button size="small" type="primary" :disabled="readonly"
        @click="e => editItemUseLogic(e, item)">使用逻辑</el-button>
      <el-button size="small" type="success" :disabled="readonly || item.remainingCount >= item.prepareCount"
        @click="e => refillItem(e, item)">补充</el-button>
      <el-button size="small" type="danger" :disabled="readonly" @click="e => removeItem(e, item.id)">取回</el-button>
    </div>
  </el-card>

  <el-dialog v-model="showLogicDialog" title="自动使用逻辑设置" width="380px" append-to-body>
    <GameCharacterStatusSkillLogicEditor v-model="localLogic" />
    <div class="mt-4">
      <div class="text-sm text-gray-600 mb-2">使用节点（可多选）：</div>
      <el-select v-model="localUseWhen" multiple placeholder="选择使用节点" class="w-full">
        <el-option label="自身回合开始" :value="AllBattlePhase.SELF_TURN_START" />
        <el-option label="战斗开始" :value="AllBattlePhase.BATTLE_START" />
      </el-select>
      <div class="text-xs text-gray-400 mt-2">选择后将在战斗对应的时点尝试使用该物品。</div>
      <div class="text-xs text-gray-400 mt-2">留空默认为“自身回合开始”</div>
    </div>
    <template #footer>
      <template v-if="!readonly">
        <el-button @click="showLogicDialog = false">取消</el-button>
        <el-button type="primary" @click="saveLogic">保存</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="tsx">
import { emitGetBattleInventory, emitRefillBattleInventory, emitRemoveResourceFromBattleInventory, emitUpdateBattleUseItemLogic, onRefillBattleInventoryFail, onRefillBattleInventorySuccess, onRemoveResourceFromBattleInventoryFail, onRemoveResourceFromBattleInventorySuccess, onUpdateBattleUseItemLogicFail, onUpdateBattleUseItemLogicSuccess } from '~/api/game/socket/character';
import { emitRequestInventory } from '~/api/game/socket/inventory';
import { waitUtilConnected } from '~/api/game/socket/socket';
import type { FuncAction } from '~/shared/types';
import Item from '../../Cattery/Item.vue';
import type { GameBattleLogic } from '~/shared/types/skill';
import { AllBattlePhase } from '~/shared/types/battle';
import { clone } from '~/shared/utils';

type Item = {
  id: string;
  name: string;
  description: string;
  remainingCount: number;
  prepareCount: number;
  ai: GameBattleLogic[]
  useWhen?: AllBattlePhase[]
}

const props = defineProps<{
  item: Item
  readonly: boolean
}>()

const showLogicDialog = ref(false)
const localLogic = ref<GameBattleLogic[]>([])
const localUseWhen = ref<AllBattlePhase[]>([])

watch(
    () => props.item,
    (val) => {
      localLogic.value = JSON.parse(JSON.stringify(val.ai || []))
      localUseWhen.value = (val.useWhen && Array.isArray(val.useWhen)) ? clone(val.useWhen) : []
    },
    { immediate: true }
)

function refillItem(e: Event, item: Item) {
  if (!e.isTrusted) return

  if (!item.id || item.remainingCount >= item.prepareCount) return;

  emitRefillBattleInventory(item.id, item.prepareCount - item.remainingCount);
}
function removeItem(e: Event, resourceId: string) {
  if (!e.isTrusted) return;
  if (!resourceId) return;

  emitRemoveResourceFromBattleInventory(resourceId);
}

function editItemUseLogic(e: Event, item: Item) {
  if (!e.isTrusted) return;
  if (!item.id) return;

  showLogicDialog.value = true;
  localLogic.value = JSON.parse(JSON.stringify(item.ai || []));
}
function saveLogic(e: Event) {
  if (!e.isTrusted) return;
  if (!props.item.id) return;

  // sanitize useWhen before sending
  const allowed = new Set<AllBattlePhase>([AllBattlePhase.BATTLE_START, AllBattlePhase.SELF_TURN_START]);
  const sanitizedUseWhen = (localUseWhen.value || []).filter((v) => typeof v === 'string' && allowed.has(v)).slice(0, 10)

  // Atomic update: send ai and useWhen together to save bandwidth
  emitUpdateBattleUseItemLogic(props.item.id, localLogic.value, sanitizedUseWhen);

  showLogicDialog.value = false;
}


onMounted(async () => {
  await waitUtilConnected()
})
onUnmounted(() => {
});
</script>