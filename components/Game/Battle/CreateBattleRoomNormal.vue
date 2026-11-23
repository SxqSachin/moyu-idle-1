<template>
  <el-form :model="createForm" label-width="100px" class="pt-2">
    <el-form-item label="房间名称" required>
      <el-input v-model="createForm.name" maxlength="20" show-word-limit placeholder="请输入房间名称" />
    </el-form-item>
    <el-form-item label="选择副本" required>
      <!-- @ts-ignore -->
      <el-select v-model="createForm.area as AllBattleAreaID" placeholder="请选择副本" class="w-full">
        <el-option v-for="area in battleAreaList" :key="area.id" :label="area.name" :value="area.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="难度等级" required>
      <el-radio-group v-model="createForm.difficulty" fill="#6cf">
        <el-radio label="无额外难度" :value="0" />
        <el-radio
          v-for="(level, index) in BATTLE_ROOM_DIFFICULTY_LEVELS_INFO"
          :key="index"
          :label="index + 1"
          :value="index + 1"
        >
          难度：{{ index + 1 }}
          <el-popover width="200">
            <template #reference>
              <el-icon class="cursor-pointer text-gray-400">
                <Icon name="material-symbols:help" />
              </el-icon>
            </template>

            <div class="space-y-1">
              <div>生命值提升：{{ level.hpPercent * 100 }}%</div>
              <div>攻击力提升：{{ level.attackPercent * 100 }}%</div>
              <div>防御力提升：{{ level.defensePercent * 100 }}%</div>

              <div>额外生命值：{{ level.hpBase }}</div>
              <div>额外攻击力：{{ level.attackBase }}</div>
              <div>额外防御力：{{ level.defenseBase }}</div>

              <div>额外敌人数量：{{ level.additionalEnemyCount }}</div>
              <div>额外掉落率（乘算）：{{ (level.additionalDropPercent * 100).toFixed(2) }}%</div>
              <div>额外经验：{{ (level.additionalExpPercent * 100).toFixed(2) }}%</div>
            </div>
          </el-popover>
        </el-radio>
      </el-radio-group>
    </el-form-item>

    <el-form-item label="金币/战利品比例" v-if="isIronCat">
      <div class="w-80">
        <el-slider
          v-model="createForm.lootGoldSlider"
          :min="0"
          :max="10"
          :step="1"
          show-stops
        />
        <div class="text-sm text-gray-500 mt-1">
          金币获取：{{ (goldMultiplier * 100).toFixed(0) }}%，战利品掉落率：×{{ dropMultiplier.toFixed(2) }}
        </div>
      </div>
    </el-form-item>

    <el-form-item label="迷雾" v-if="selectedBattleArea?.denseFogModeRequireResource">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>迷雾</el-text>
          <el-tooltip placement="top">
            <template #content>
              <div>
                <span>开启后，进入地图将需要房主消耗一张对应副本的“迷雾地图” </span>
                <span>迷雾副本有以下调整：</span>
                <ul class="pl-4 list-disc space-y-1">
                  <li>继承所选“难度等级”的所有效果</li>
                  <li>怪物的基础属性将会额外获得提升，使其至少不低于相当于当前最高级副本的怪物平均属性</li>
                  <li>战斗胜利结算经验时，提供额外25%经验</li>
                  <li>会随机混入其他副本的敌人</li>
                  <li>可能会遇到在同一个副本中进行探索的其他小队的幻象，以敌人身份与你的小队进行战斗</li>
                </ul>
              </div>
            </template>
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.denseFogMode" />
    </el-form-item>

    <el-form-item label="自动重新进入迷雾" v-if="createForm.denseFogMode">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>重进迷雾</el-text>
          <el-tooltip placement="top">
            <template #content>
              <div>
                因战败导致迷雾消散时，房主将自动消耗一张对应副本的“迷雾地图”重新进入迷雾模式。
                <br />
                “迷雾地图”不足时，将会进入普通模式
              </div>
            </template>
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.autoRestartDenseFogMode" />
    </el-form-item>

    <el-form-item label="是否公开">
      <el-switch v-model="createForm.isPublic" active-text="公开" inactive-text="私有" />
    </el-form-item>
    <el-form-item label="自动重开">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>自动重开</el-text>
          <el-tooltip content="开启后，每次因战斗胜利结束战斗时，会在4秒后会自动重开房间；因战斗失败结束战斗时，会在15秒后自动重开房间。" placement="top">
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.autoRestart" />
    </el-form-item>
    <el-form-item label="自动开始">
      <template #label>
        <div class="w-48 flex items-center justify-end gap-2">
          <el-text>自动开始</el-text>
          <el-tooltip content="开启后，当全员准备就绪时，战斗将在4秒后自动开启。" placement="top">
            <el-icon class="cursor-pointer text-gray-400">
              <Icon name="material-symbols:help" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-switch v-model="createForm.autoStartBattle" />
    </el-form-item>

    <el-form-item label="战利品信息">
      <el-switch v-model="createForm.publicBattleLoot" active-text="公开" inactive-text="隐藏" />
    </el-form-item>

    <el-form-item v-if="createForm.denseFogMode && selectedBattleArea?.denseFogModeRequireResource" label="消耗">
      <GameCommonItemCountInfoIconAndName
        :item-count-info="selectedBattleArea.denseFogModeRequireResource"
        :show-count="true"
        :show-inventory-count="true"
      />
    </el-form-item>

    <el-form-item v-if="selectedBattleArea?.requireResourceToEnter" label="消耗">
      <GameCommonItemCountInfoIconAndName
        :item-count-info="selectedBattleArea.requireResourceToEnter"
        :show-count="true"
        :show-inventory-count="true"
      />
    </el-form-item>

    <el-form-item>
      <el-button @click="emits('cancel')">取消</el-button>
      <el-button type="primary" @click="handleCreateRoom" :disabled="!canCreate" :loading="creatingRoom">创建</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { emitBattleRoomCreate } from '~/api/game/socket/battleRoom';
import { allBattleAreas } from '~/shared/data/allBattleInfo';
import { BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, LOOT_GOLD_DROP_MULTIPLIER_PER_SLIDER } from '~/shared/data/constant';
import type { AllBattleAreaID, BattleArea } from '~/shared/types/battle';
import type { CreateBattleRoomInput, CreateNormalBattleRoomInput } from '~/shared/types/battleRoom';
import GameCommonItemCountInfoIconAndName from '~/components/Game/Common/ItemCountInfoIconAndName.vue';
import { useIronCat } from '~/composables/game/useIronCat';

const emits = defineEmits<{
  (e: 'createRoom'): void;
  (e: 'cancel'): void;
}>();

const isIronCat = useIronCat()


const props = defineProps<{
  defaultArea: AllBattleAreaID;
}>();

const createForm = ref<CreateNormalBattleRoomInput>({
  name: '',
  area: props.defaultArea as AllBattleAreaID,
  isPublic: true,
  autoRestart: false,
  autoStartBattle: true,
  difficulty: 0,
  denseFogMode: false,
  autoRestartDenseFogMode: false,
  phantomUuidList: [],
  publicBattleLoot: true,
  lootGoldSlider: 0,
  autoWorldBossBattleConf: { type: 'none' },
});
const creatingRoom = ref(false);

watch(
  () => props.defaultArea,
  (newArea) => {
    createForm.value.area = newArea;
  }
);

const canCreate = computed(() => !!createForm.value.name && !!createForm.value.area);

const battleAreaList = Object.values(allBattleAreas);

const selectedBattleArea = computed(() => {
  return battleAreaList.find((area) => area.id === createForm.value.area) as BattleArea;
});

const lootGoldSlider = computed(() => createForm.value.lootGoldSlider ?? 0);
const goldMultiplier = computed(() => Math.max(0, 1 - 0.1 * (lootGoldSlider.value || 0)));
const dropMultiplier = computed(() => 1 + LOOT_GOLD_DROP_MULTIPLIER_PER_SLIDER * (lootGoldSlider.value || 0));

async function handleCreateRoom() {
  if (!canCreate.value) return;
  creatingRoom.value = true;
  emitBattleRoomCreate({
    name: createForm.value.name,
    area: createForm.value.area!,
    isPublic: createForm.value.isPublic,
    autoRestart: createForm.value.autoRestart ?? false,
    autoStartBattle: createForm.value.autoStartBattle ?? false,
    difficulty: createForm.value.difficulty ?? 0,
    denseFogMode: createForm.value.denseFogMode,
    autoRestartDenseFogMode: createForm.value.autoRestartDenseFogMode,
    phantomUuidList: createForm.value.phantomUuidList,
    publicBattleLoot: createForm.value.publicBattleLoot,
      lootGoldSlider: createForm.value.lootGoldSlider ?? 0,
    battleType: 'normal',
    autoWorldBossBattleConf: {
      type: 'none'
    }
  });
  creatingRoom.value = false;

  emits('createRoom');
}
</script>
