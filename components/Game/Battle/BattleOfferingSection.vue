<template>
  <el-card shadow="never" class="mb-4" body-class="p-3! md:p-4!">
    <div class="font-bold mb-4 flex flex-col md:flex-row items-center justify-between gap-2">
      <div class="flex flex-row items-center gap-2">
        <span>战斗契约</span>
        <el-button size="small" plain @click="showOfferingHelp = true">
          查看提示
        </el-button>
       </div>
       <div class="my-2"></div>
      <div v-if="room && isInPrepareState" class="flex flex-wrap items-center gap-2">
        <el-tag type="primary" :disable-transitions="true"> 已签订 {{ offeringCount }}/{{ BATTLE_ROOM_MAX_OFFERINGS }}</el-tag>
        <el-button size="small" plain @click="showOfferingSelector = true">选择</el-button>
        <div v-if="selectedOfferingSpec" class="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <span>已选：</span>
          <span class="font-semibold">{{ selectedOfferingSpec.name }}</span>
        </div>
        <el-input-number v-model="offeringForm.count" :min="1" :max="selectedOfferingMaxCount" size="small" class="w-14"
          :disabled="!offeringForm.specId" />
        <el-button size="small" type="primary" :disabled="!offeringForm.specId" @click="addOffering">加入</el-button>
      </div>
    </div>

    <template v-if="offeringList.length">
      <div class="grid gap-6" style="grid-template-columns: repeat(auto-fill, minmax(12em, 1fr));">
        <el-card v-for="row in offeringList" :key="row.specId" shadow="hover" body-class="p-3! h-full">
          <div class="flex flex-col justify-between h-full gap-1">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="font-semibold">{{ row.name }}</div>
                <div class="flex items-center gap-1">
                  <el-button v-if="canReturnOffering(row)" size="small" type="warning" plain
                    :loading="returningSpecId === row.specId" @click="returnOffering(row)">
                    {{ row.fromUserUuid === userUuid ? "取回" : "退还" }}
                  </el-button>
                  <template v-if="!row.count && !row.nextConsumeInTurns">
                    <el-tag size="small" type="danger">已耗尽</el-tag>
                  </template>
                  <template v-else>
                    <el-tag size="small" type="success">x{{ row.count }}</el-tag>
                  </template>
                </div>
              </div>
              <!-- <el-tag class="w-fit" v-if="row.spec?.stackable === false" size="small" type="danger" effect="plain">同名不叠加</el-tag> -->
              <el-tag class="w-fit" v-if="row.nextConsumeInTurns" size="small" type="success" effect="plain">生效中-剩余{{ row.nextConsumeInTurns }}场战斗</el-tag>

              <template v-if="room?.battleType == 'worldBoss' && row.spec.disableInWorldBossBattle">
                <el-tag type="danger" size="small" effect="plain" :closable="false">“大麻烦”战斗中无效</el-tag>
              </template>
              <template v-else-if="room?.battleType == 'normal' && row.spec.disableInNormalBattle">
                <el-tag type="danger" size="small" effect="plain" :closable="false">普通战斗中无效</el-tag>
              </template> 

              <div class="text-xs text-gray-500" v-if="row.desc">{{ row.desc }}</div>
              <div class="text-xs text-gray-500">消耗：{{ formatConsume(row.spec.consume) }}</div>

            </div>

            <div class="flex items-center justify-between mt-2">
              <div class="text-xs text-gray-500 flex items-center gap-2" v-if="row.fromUserUuid">
                <GameUserAvatarAndName :uuid="row.fromUserUuid" :hide-title="true" />
              </div>

            </div>
          </div>
        </el-card>
      </div>
    </template>
    <template v-else>
      <el-empty :image-size="50" description="暂无战斗契约"></el-empty>
    </template>
  </el-card>

  <el-dialog v-model="showOfferingSelector" title="选择媒介" :width="isMobile ? '100%' : '880px'"
    :close-on-click-modal="true">
    <template v-if="hasAvailableOffering">
      <div class="flex flex-col gap-6">
        <template v-for="group in offeringEffectGroups" :key="group.trigger">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <span class="font-semibold">{{ group.label }}</span>
              <el-tag type="info" size="small">可选战斗契约：{{ group.specs.length }}</el-tag>
            </div>

            <div class="flex flex-col gap-4">
              <div v-for="specEntry in group.specs" :key="specEntry.spec.id"
                class="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 pb-8">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold">{{ specEntry.spec.name }}</span>
                    <el-tag v-if="specEntry.spec.stackable === false" size="small" type="danger" effect="plain">同名不叠加</el-tag>
                    <el-tag size="small" type="success">{{ specEntry.resources.length }} 种素材</el-tag>
                  </div>
                  <div class="text-xs text-gray-500">消耗：{{ formatConsume(specEntry.spec.consume) }}</div>
                </div>
                <div class="text-xs text-gray-500">{{ specEntry.spec.description }}</div>

                <div class="flex flex-wrap gap-4 gap-y-6">
                  <ItemSlot v-for="res in specEntry.resources" :key="res.id" :resource-id="res.id" :show-count="true"
                    @click="handleSelectOffering(specEntry.spec.id as AllBattleRoomOfferingId, res.id)">
                  </ItemSlot>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
    <el-empty v-else description="当前库存中无可用战斗契约素材" />
    <template #footer>
      <el-button @click="showOfferingSelector = false">关闭</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showOfferingHelp" title="战斗契约说明" :width="isMobile ? '100%' : '640px'"
    :close-on-click-modal="true">
    <div class="flex flex-col gap-2 text-sm leading-relaxed">
      <p>战斗契约能够在战斗中提供各种增益效果，但通常也会带来额外的挑战。</p>
      <p class="font-semibold mt-2">准备阶段</p>
      <p> - 房间内的每个玩家都可以选择并提交相关的契约道具。</p>
      <p> - 战斗开始前，玩家可以取回自己提交的契约道具，此时相关的资源将退还至对应玩家的“收获箱”中。</p>
      <p> - 房主可以退还房间内其他玩家准备签订的契约，此时相关的资源将退还至对应玩家的“收获箱”中。</p>

      <p class="font-semibold mt-2">战斗过程中</p>
      <p> - 契约会在不同阶段生效，每经过一定战斗场次，就会消耗一份对应的契约。</p>
      <p> - 当某一类型的契约完全被消耗后，此契约在接下来的战斗中不再生效。</p>

      <p class="font-semibold mt-2">其他</p>
      <p> - 契约的消耗情况会保留；取回或退还时，仅返还未使用的资源。</p>
      <p> - 玩家离开房间时，将自动退还其未使用的契约资源，返还的资源将出现在玩家的“收获箱”中。</p>
      <p> - 战斗中途重启战斗时，场次消耗将被保留。</p>
      <p class="ml-4">例：某契约每30场消耗1份，当进行14场战斗后终止，再次进入战斗时仍需16场才会消耗下一份契约。</p>
      <p> - 每个战斗房间最多可签订 {{ BATTLE_ROOM_MAX_OFFERINGS }} 个战斗契约。</p>
      <p class="font-bold"> - 因契约获得的状态，不会触发任何来自装备、技能、状态、祝福、专精等来源的效果。</p>
    </div>
    <template #footer>
      <el-button type="primary" @click="showOfferingHelp = false">我知道了</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { emitBattleRoomAddOffering, emitBattleRoomReturnOffering, onBattleRoomAddOfferingError, onBattleRoomAddOfferingSuccess, onBattleRoomReturnOfferingError, onBattleRoomReturnOfferingSuccess } from "~/api/game/socket/battleRoom";
import { allBattleRoomOffering, type AllBattleRoomOfferingId } from "~/shared/data/allBattleRoomOffering";
import { BATTLE_ROOM_MAX_OFFERINGS } from "~/shared/data/constant";
import { useInventory } from "~/composables/game/useInventory";
import { allGameResource } from "~/shared/data/allGameResources";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import type { BattleRoom } from "~/shared/types/battleRoom";
import type { BattleRoomOfferingConsumeRule, BattleRoomOfferingEffectTrigger, BattleRoomOfferingSpec } from "~/shared/types/battleRoomOffering";
import type { FuncAction } from "~/shared/types";
import ItemSlot from "~/components/Game/Common/ItemSlot.vue";

const { isMobile } = useDevice();

const props = defineProps<{
  room: BattleRoom | null;
  isInPrepareState: boolean;
}>();

const inventory = useInventory();
const offeringForm = ref<{ specId: AllBattleRoomOfferingId | ""; count: number }>({ specId: "", count: 1 });
const showOfferingSelector = ref(false);
const showOfferingHelp = ref(false);
const selectedOfferingResourceId = ref<AllGameResourceID | null>(null);
const returningSpecId = ref<string | null>(null);
const { user } = useUserSession();
const userUuid = computed(() => user.value?.uuid || "");

const effectGroupLabel: Record<BattleRoomOfferingEffectTrigger, string> = {
  onPrepareBattleData: "战斗调整",
  onBattleStart: "开战效果",
  afterBattleStart: "开战后效果",
  onTurnStart: "回合开始效果",
  onTurnEnd: "回合结束效果",
  onConsume: "消耗触发",
};

type OfferingSpecWithResources = {
  spec: BattleRoomOfferingSpec;
  resources: typeof allGameResource[keyof typeof allGameResource][];
};

const offeringEffectGroups = computed(() => {
  const groups: Partial<Record<BattleRoomOfferingEffectTrigger, { trigger: BattleRoomOfferingEffectTrigger; label: string; specs: OfferingSpecWithResources[] }>> = {};

  Object.values(allBattleRoomOffering).forEach((spec) => {
    if (spec.kind.type == 'resource') {
      const resourceId = spec.kind.resourceId;
      const resource = allGameResource[resourceId];
      if (!resource) return;
      if ((inventory.value?.[resource.id]?.count ?? 0) <= 0) return;

      const triggers = (spec.effects?.map((e) => e.trigger) ?? []) as BattleRoomOfferingEffectTrigger[];
      const targetTriggers: BattleRoomOfferingEffectTrigger[] = triggers.length ? triggers : ["onBattleStart"];

      targetTriggers.forEach((trigger) => {
        const t = trigger as BattleRoomOfferingEffectTrigger;
        const group = groups[t] || { trigger: t, label: effectGroupLabel[t], specs: [] };
        group.specs.push({ spec, resources: [resource] });
        groups[t] = group;
      });
      return;
    }



    if (spec.kind.type !== "alchemyTag") return;
    const tagId = spec.kind.tagId;
    const resources = Object.values(allGameResource)
      .filter((r) => r.alchemyTag?.includes(tagId))
      .filter((r) => (inventory.value?.[r.id]?.count ?? 0) > 0);
    if (!resources.length) return;

    const triggers = (spec.effects?.map((e) => e.trigger) ?? []) as BattleRoomOfferingEffectTrigger[];
    const targetTriggers: BattleRoomOfferingEffectTrigger[] = triggers.length ? triggers : ["onBattleStart"];

    targetTriggers.forEach((trigger) => {
      const t = trigger as BattleRoomOfferingEffectTrigger;
      const group = groups[t] || { trigger: t, label: effectGroupLabel[t], specs: [] };
      group.specs.push({ spec, resources });
      groups[t] = group;
    });
  });

  return Object.values(groups) as Array<{ trigger: BattleRoomOfferingEffectTrigger; label: string; specs: OfferingSpecWithResources[] }>;
});

const hasAvailableOffering = computed(() => offeringEffectGroups.value.some((g) => g.specs.length));

function formatConsume(consume: BattleRoomOfferingConsumeRule) {
  const turns = consume.turns ?? 0;
  const amount = consume.amount ?? 0;
  return `每${turns}场战斗消耗 ${amount} 个`;
}

const selectedOfferingSpec = computed(() =>
  offeringForm.value.specId ? allBattleRoomOffering[offeringForm.value.specId] : null
);

const selectedOfferingMaxCount = computed(() => {
  if (!selectedOfferingResourceId.value) return 999;
  const stock = inventory.value?.[selectedOfferingResourceId.value]?.count ?? 1;
  return Math.max(1, Math.min(999, stock));
});

watch(
  () => selectedOfferingResourceId.value,
  () => {
    if (offeringForm.value.count > selectedOfferingMaxCount.value) {
      offeringForm.value.count = selectedOfferingMaxCount.value;
    }
  }
);

const offeringList = computed(() => {
  return (props.room?.offerings || []).map((stack) => {
    const spec = allBattleRoomOffering[stack.specId as AllBattleRoomOfferingId];
    return {
      ...stack,
      spec,
      name: spec?.name || stack.specId,
      desc: spec?.description,
    };
  });
});

const offeringCount = computed(() => (props.room?.offerings?.length ?? 0));

const canReturnOffering = (row: { fromUserUuid?: string; specId: string; count: number }) => {
  if (!props.room) return false;
  if (!props.isInPrepareState) return false;
  if (!row.count || row.count <= 0) return false;
  return props.room.ownerId === userUuid.value || row.fromUserUuid === userUuid.value;
};

function addOffering() {
  if (!props.room) return;
  if (!props.isInPrepareState) return;
  if (!offeringForm.value.specId) return;
  if (offeringCount.value >= BATTLE_ROOM_MAX_OFFERINGS) {
    ElMessage.error(`最多可拥有 ${BATTLE_ROOM_MAX_OFFERINGS} 个战斗契约`);
    return;
  }
  if (!selectedOfferingResourceId.value) {
    ElMessage.error("请选择战斗契约素材");
    return;
  }

  const count = Math.max(1, offeringForm.value.count || 0);
  if (selectedOfferingResourceId.value && count > selectedOfferingMaxCount.value) {
    ElMessage.error("数量超过库存");
    return;
  }
  emitBattleRoomAddOffering(props.room.uuid, offeringForm.value.specId, count, selectedOfferingResourceId.value);
}

function returnOffering(row: { specId: string; fromUserUuid?: string; count: number }) {
  if (!props.room) return;
  if (!canReturnOffering(row)) return;
  returningSpecId.value = row.specId;
  emitBattleRoomReturnOffering(props.room.uuid, row.specId);
}

function handleSelectOffering(specId: AllBattleRoomOfferingId, resourceId: AllGameResourceID) {
  offeringForm.value.specId = specId;
  selectedOfferingResourceId.value = resourceId;
  offeringForm.value.count = Math.min(offeringForm.value.count || 1, selectedOfferingMaxCount.value);
  showOfferingSelector.value = false;
}

let offAddOfferingSuccess: FuncAction | undefined;
let offAddOfferingError: FuncAction | undefined;
let offReturnOfferingSuccess: FuncAction | undefined;
let offReturnOfferingError: FuncAction | undefined;

onMounted(() => {
  offAddOfferingSuccess = onBattleRoomAddOfferingSuccess(() => {
    offeringForm.value = { specId: "", count: 1 };
    selectedOfferingResourceId.value = null;
    showOfferingSelector.value = false;
    ElMessage.success("战斗契约已添加");
  });

  offAddOfferingError = onBattleRoomAddOfferingError((msg) => {
    ElMessage.error(msg.message || "添加战斗契约失败");
  });

  offReturnOfferingSuccess = onBattleRoomReturnOfferingSuccess(() => {
    returningSpecId.value = null;
    ElMessage.success("剩余战斗契约已退还");
  });

  offReturnOfferingError = onBattleRoomReturnOfferingError((msg) => {
    returningSpecId.value = null;
    ElMessage.error(msg.message || "退还战斗契约失败");
  });
});

onUnmounted(() => {
  offAddOfferingSuccess?.();
  offAddOfferingError?.();
  offReturnOfferingSuccess?.();
  offReturnOfferingError?.();
});
</script>