<template>
  <div class="player-info-card flex flex-col gap-2 relative z-50" :class="profileCardClass">
    <!-- 基础信息 -->
    <div class="flex flex-col md:flex-row items-center gap-4 md:gap-5">
      <div class="relative profile-card__avatar">
        <GamePlayerProfileAvatar :avatar="playerInfo?.base.avatar ?? 'avatar_1'" :border="playerInfo?.base.style.currentAvatarBorder" :size="96"
          class="w-20 h-20 md:w-24 md:h-24 mb-2 md:mb-0" />
      </div>
      <div class="text-center md:text-left flex flex-col items-center md:items-start player-info-card__header">
        <div class="relative text-xl md:text-2xl w-fit font-extrabold drop-shadow profile-card__name">
          {{ playerInfo?.base.name || "——" }}
          <template v-if="playerInfo?.base.hName?.length">
            <el-popover>
              <template #reference>
                <el-icon>
                  <Icon name="material-symbols:history" class="text-base" />
                </el-icon>
              </template>
              <div class="max-h-48 overflow-y-auto flex flex-col gap-1">
                <div class="mb-2">曾用名:</div>
                <div v-for="(name, index) in playerInfo?.base.hName" :key="index">
                  {{ name }}
                </div>
              </div>
            </el-popover>
          </template>
        </div>
        <div v-if="title" class="text-sm md:text-md tex-gray-400 drop-shadow profile-card__title">
          {{ title }}
        </div>

        <div class="flex flex-row items-center gap-2 my-0 profile-card__guild-info" v-if="playerInfo?.base.guild">
          <div class="text-sm md:text-md tex-gray-400 drop-shadow profile-card__guild">
            <GameCommonGuildInfo :uuid="playerInfo.base.guild" :plain="true" />
          </div>

          <div v-if="playerInfo?.base.guildTitle"
            class="text-sm md:text-md tex-gray-400 drop-shadow my-2 profile-card__guild-title">
            [{{ playerInfo?.base.guildTitle }}]
          </div>
        </div>

        <div class="text-gray-500 text-xs mt-1 profile-card__join-date">
          成为猫猫村民的日子：{{ playerInfo ? formatTime(new Date(playerInfo.base.createDate)) : "——" }}
        </div>
        <div class="text-gray-500 text-xs mt-1 profile-card__join-date" v-if="playerInfo?.base.lastOnlineDate">
          最后活跃时间：{{ playerInfo ? formatTime(new Date(playerInfo.base.lastOnlineDate)) : "——" }}
        </div>
      </div>
    </div>
    <div class="my-2 player-info-card__current-action current-action" v-if="allInfo?.currentActionId">
      <span class="mr-2">当前正在:</span>
      <GameCommonActionNameAndIcon :action-id="allInfo.currentActionId"></GameCommonActionNameAndIcon>
    </div>
    <div v-if="!playerInfo" class="text-gray-400 text-center py-8">加载中...</div>

    <!-- PC端卡片网格 -->
    <div v-if="playerInfo" class="player-info-part relative">

      <el-tabs v-model="activeTab" class="w-full">
        <el-tab-pane label="属性" name="status" :lazy="true">

          <div class="grid grid-cols-3 gap-3 md:gap-3 p-1">
            <el-card v-for="(desc, statusId) in allCharacterStatus" :key="statusId" shadow="hover"
              class="player-status-card" body-class="flex flex-row items-center gap-3 p-2!">
              <span class="text-xl md:text-2xl">{{ desc.icon }}</span>
              <div>
                <div class="text-gray-400 text-sm player-status-card__name">{{ desc.name }}</div>
                <div class="text-xs text-gray-500 font-bold player-status-card__level">
                  Lv.{{ getStatusLevel(statusId) }}
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
        <el-tab-pane label="装备" name="equipment" :lazy="true">

          <el-tabs v-model="equipmentTab" class="w-full">
            <el-tab-pane label="生活" name="work">
              <GameCharacterEquipmentOtherCharacterWorkEquipment :user-uuid="characterUuid">
              </GameCharacterEquipmentOtherCharacterWorkEquipment>
            </el-tab-pane>
            <el-tab-pane label="战斗" name="battle">
              <GameCharacterEquipmentOtherCharacterEquipment :user-uuid="characterUuid">
              </GameCharacterEquipmentOtherCharacterEquipment>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        <el-tab-pane label="技能" name="skill" :lazy="true">
          <div v-if="playerInfo?.skills.length" class="p-1">
            <div class="flex flex-row flex-wrap gap-2">
              <template v-for="skill in playerInfo?.skills" :key="skill.skillId">
                <GameCommonBattleSkillName v-if="skill.enabled" :level="skill.level" :skill-id="skill.skillId"
                  :extra="skill.extra" :logic="skill.logic">
                </GameCommonBattleSkillName>
              </template>
            </div>
            <el-divider class="my-2!"></el-divider>
            <div>
              <el-button class="mt-2 w-full player-info__copy-skill" type="primary" @click="copySkillAndLogic">
                复制技能配置
              </el-button>
            </div>
          </div>
          <div v-else>
            <div class="text-gray-400 text-center py-8">暂无技能</div>
          </div>
          <!-- <GameCharacterEquipmentOtherCharacterEquipment :user-uuid="characterUuid"></GameCharacterEquipmentOtherCharacterEquipment> -->
        </el-tab-pane>
        <el-tab-pane label="猫咪" name="kitties" :lazy="true">
          <div v-if="allInfo?.kittiesInfo.length" class="flex flex-col flex-wrap gap-2 p-1">
            <template v-for="kitty in allInfo.kittiesInfo" :key="kitty.kitty.uuid">
              <div
                class="flex flex-row items-center justify-between bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-700/30 player-profile__kitty">
                <div class="flex items-center space-x-2">
                  <div
                    class="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-md flex items-center justify-center flex-shrink-0">
                    <span class="text-white text-xs">🐱</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs text-gray-500 dark:text-gray-400  player-profile__kitty-name-label">猫咪</div>
                    <div
                      class="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate player-profile__kitty-name">
                      {{ kitty.kitty.name }}
                    </div>
                  </div>
                </div>

                <div class="ml-2 text-sm player-profile__kitty-current-action" v-if="kitty?.currentActionId">
                  <span class="mr-2">当前正在:</span>
                  <GameCommonActionNameAndIcon :action-id="kitty.currentActionId"></GameCommonActionNameAndIcon>
                </div>
                <div v-else class="player-profile__kitty-current-action">
                  正在休息 😴
                </div>

              </div>
            </template>
          </div>
          <div v-else>
            <div class="text-gray-400 text-center py-8">还没有小猫咪</div>
          </div>
          <!-- <GameCharacterEquipmentOtherCharacterEquipment :user-uuid="characterUuid"></GameCharacterEquipmentOtherCharacterEquipment> -->
        </el-tab-pane>
      </el-tabs>

    </div>

    <!-- 扩展插槽 -->
    <slot></slot>
  </div>

  <el-dialog v-model="missingSkillsDialogVisible" title="复制技能配置失败">
    <span>复制技能配置失败，因为您缺少以下技能：</span>
    <div class="flex flex-wrap gap-2 mt-4">
      <template v-for="skillId of missingSkillIdList">
        <GameCommonBattleSkillName :skill-id="skillId"></GameCommonBattleSkillName>
      </template>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="missingSkillsDialogVisible = false">
          我知道了
        </el-button>
      </div>
    </template>
  </el-dialog>

</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from "vue"
import { ElCard } from "element-plus"
import { allCharacterStatus } from "@/shared/data/allCharacterStatus"
import type { AllCharacterStatusType, PlayerInfo } from "@/shared/types/characterInfo"
import { bindCharacteSocketAction, emitGetCharacterInfo, } from "@/api/game/socket/character"
import { formatTime } from "~/shared/utils"
import { waitUtilConnected } from "~/api/game/socket/socket"
import type { GameSocketData } from "~/shared/types/socket"
import { allTitles } from "~/shared/data/allTitle"
import type { Kitty } from "~/shared/types/kitty"
import type { AllGameActionID } from "~/shared/types/gameAction"
import { emitCopySkillLogic, emitGetCharacterBattleSkills, onCopySkillLogicFail, onCopySkillLogicSuccess } from "~/api/game/socket/skills"
import type { FuncAction } from "~/shared/types"

const activeTab = ref("status")
const equipmentTab = ref("work")

const props = defineProps<{ characterUuid: string }>()

const allInfo = ref<{ playerInfo: PlayerInfo, currentActionId: string; kittiesInfo: { kitty: Kitty, currentActionId: AllGameActionID }[] }>()
const playerInfo = ref<PlayerInfo | null>(null)
const loading = ref(false)
const error = ref("")

const missingSkillsDialogVisible = ref(false)
const missingSkillIdList = ref<string[]>([]);

const profileCardEffectName = computed(() => {
  return playerInfo.value?.base?.effect?.profileCard ?? "";
});
const playerStyle = computed(() => {
  return playerInfo.value?.base.style
})
const profileCardClass = computed<string>(() => {
  let effect =  playerStyle.value?.currentProfileStyle ?? profileCardEffectName.value;

  if (!effect) {
    return "";
  }

  return 'profile-card--' + effect
});

function fetchInfo() {
  if (!props.characterUuid) return
  loading.value = true
  error.value = ""
  emitGetCharacterInfo(props.characterUuid)
}

const onGetInfoSuccess = (info: { playerInfo: PlayerInfo, currentActionId: string; kittiesInfo: { kitty: Kitty, currentActionId: AllGameActionID }[] }) => {
  allInfo.value = info
  playerInfo.value = info.playerInfo
  loading.value = false
}

const onGetInfoError = (data: GameSocketData<{ message: string }>) => {
  error.value = data.data.message
  loading.value = false
}

const title = computed(() => {
  if (!playerInfo.value?.base.title) {
    return ''
  }

  return allTitles[playerInfo.value?.base.title].name
})

const copySkillAndLogic = () => {
  emitCopySkillLogic(props.characterUuid)
}

const getStatusLevel = (statusId: AllCharacterStatusType) => {
  // @ts-ignore
  return playerInfo.value.status[statusId]?.level ?? 1
}

let off1: FuncAction
let off2: FuncAction
let off3: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  off1 = onCopySkillLogicSuccess(() => {
    ElNotification({
      title: "技能配置复制成功",
      type: "success",
      duration: 2000,
    })
    emitGetCharacterBattleSkills()
  })
  off2 = onCopySkillLogicFail((data) => {
    if (!data.missingSkills?.length) {
      ElNotification({
        title: "技能配置复制失败",
        message: data.message,
        type: "error",
        duration: 2000,
      })
      return
    }
    missingSkillsDialogVisible.value = true
    missingSkillIdList.value = data.missingSkills
  })

  off3 = bindCharacteSocketAction({
    onGetInfoError,

    // @ts-ignore
    onGetInfoSuccess,
  })

  fetchInfo()
})
watch(() => props.characterUuid, fetchInfo)

onUnmounted(() => {
  off1?.()
  off2?.()
  off3?.()
})
</script>

<style lang="scss" scoped>
.player-info-card {
  max-width: 420px;
  min-width: 280px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .player-info-card {
    padding: 0.5rem !important;
    max-width: 98vw;
    min-width: 0;
    box-shadow: none;
    background: transparent;
  }

  .player-info-card .grid {
    gap: 0.3rem !important;
  }

  .player-info-card .el-card {
    min-height: 68px !important;
    height: 68px !important;
    padding-left: 0.3rem !important;
    border-radius: 0.6rem !important;
    font-size: 0.9rem !important;
  }

  .player-info-card .text-2xl,
  .player-info-card .text-3xl {
    font-size: 1.1rem !important;
  }

  .player-info-card .text-lg {
    font-size: 0.95rem !important;
  }

  .player-info-card .font-semibold {
    font-weight: 600 !important;
  }
}
</style>

<style lang="scss">
.el-dialog:has(.profile-card--yixiao) {
  .el-dialog__close {
    color: white;
  }

  background: rgb(246 234 216 / 85%);

  .current-action {
    color: #c87e17;
  }

  &:before {
    content: '';
    display: block;

    background: #f6ead8cf;
    /* background: linear-gradient(135deg, #f0f4c3, #c5e1a5);
    border: 1px solid #c5e1a5; */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    background: black;
    background-image: url(/static/images/dialog_kitty_bg_1.png);
    background-size: 440px;
    background-position: center 390px;
    // background-blend-mode: color;
    opacity: 0.1;

    @media (max-width: 768px) {
      // background: rgb(246 234 216 / 68%);
      // background-image: url(/static/images/dialog_kitty_bg_1.png);
      // background-size: 440px;
      // background-position: center 390px;
      // background-blend-mode: soft-light;
    }

  }

  .profile-card__avatar {
    &::after {
      content: "";
      display: block;
      width: 120px;
      height: 120px;
      background-image: url(/static/images/dialog_kitty_3.png);
      background-position: center;
      background-size: 120px;
      position: absolute;
      bottom: 1px;
      right: 40px;
      transform: rotateY(180deg) rotateZ(300deg);
    }
  }

  .profile-card__name,
  .profile-card__title,
  .profile-card__guild,
  .profile-card__guild-title,
  .profile-card__join-date {
    color: #c87e17;
    text-shadow: 0 0 4px #ffe46d;

    .dark & {
      color: #c87e17;
      text-shadow: 0 0 4px #ffe46d;
    }
  }

  .profile-card__name {

    @media (max-width: 768px) {
      &::before {
        top: 0;
        left: -75%;
      }
    }

    &::after {
      content: "";
      display: block;
      width: 100px;
      height: 100px;
      background-image: url(/static/images/dialog_kitty_2.png);
      background-position: center;
      background-size: 100px;
      position: absolute;
      top: -1em;
      right: -100px;
    }
  }

  .player-info-part {
    &::before {
      content: "";
      display: block;
      width: 100px;
      height: 100px;
      background-image: url(/static/images/dialog_kitty_4.png);
      background-position: center;
      background-size: 100px;
      position: absolute;
      top: -44px;
      right: 0px;
      transform: rotateY(180deg);
    }
  }


  .player-status-card {
    box-shadow: 0px 2px 1px 2px #e3c5b799;
    background-color: rgba(247, 231, 216, 0.51) !important;
    border: 1px solid rgba(232, 205, 188, 0.3882352941);

    .player-status-card__name {
      text-shadow: 0 0 4px #ffdfa0;

      .dark & {
        color: #d09c53;
      }
    }
  }

  .el-tabs__item {
    color: #f6e9d9;
    text-shadow: 0 0 2px #af3c00;
  }

  .el-tabs__item.is-active {
    color: #ffc277;
  }

  .el-tabs__active-bar {

    background-color: #ffc277;
  }

  .equipment-card {
    background-color: #f7ead78a;
    border-radius: 12px;

    .equipment-slot {
      box-shadow: 0px 2px 1px 1px #e3c5b799;
      background-color: rgba(247, 231, 216, 0.51) !important;
      border: 1px solid rgba(232, 205, 188, 0.3882352941);

      .dark &{
        color: gray;
      }
    }

    .el-divider__text.is-center {
      background-color: #f6e9d9;
      color: #ffc277;
      border-radius: 12px;
      text-shadow: 0 0 2px #af3c00;
    }

  }

    .el-divider--horizontal {
      border-color: #e8ccbf;
    }

  .el-tabs__nav-wrap {
    &::after {
      background-color: #e8ccbf;
    }

  }

  [id="pane-skill"] .el-tag {
    background-color: #f6e9d9;
    color: #c87e17;
    border-color: #ffc277;
  }

  [id="pane-kitties"] .player-profile__kitty {
    background-color: #f6e9d9;
    color: #c87e17;
    border-color: #ffc277;

    .player-profile__kitty-name {
      color: #c87e17;
    }
  }

  .player-info__copy-skill {
    background-color: #f6e9d9;
    color: #c87e17;
    border-color: #ffc277;
  }
}

.el-dialog:has(.profile-card--wangzong) {
  --profile-wangzong-primary: #83a3ff;
  --profile-wangzong-secondary: #002aa3;
  --profile-wangzong-bg-primary: rgb(184, 230, 255, 0.38);
  --profile-wangzong-bg-secondary: rgb(176, 196, 255, 0.56);
  --profile-wangzong-bg-card: rgb(215, 223, 247, 0.26);
  --profile-wangzong-bg-equipment: rgb(184, 230, 255, 0.28);
  --profile-wangzong-shadow: rgb(183, 215, 227, 0.6);
  --profile-wangzong-border: rgb(193, 188, 232, 0.39);
  --profile-wangzong-text-shadow: #dce9ff;
  --profile-wangzong-text-glow: #001435;
  --profile-wangzong-tab-glow: #0057e9;
  --profile-wangzong-divider: #7391dd61;
  --profile-wangzong-dark-primary: #b0c4ff;
  --profile-wangzong-dark-secondary: #d4dfff;
  --profile-wangzong-dark-level: #003284;

  // 通用变量
  --profile-close-btn-color: white;
  --profile-bg-black: #000000;
  --profile-bg-opacity: 0.4;


  padding: 0.5rem;
  
  .el-dialog__close {
    color: var(--profile-close-btn-color);
  }

  &:before {
    content: "";
    display: block;
    background: rgba(246, 234, 216, 0.8117647059);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--profile-bg-black);
    background-image: url(/static/images/wangzong_profile_bg_1.png);
    background-size: 450px;
    background-position: center 790px;
    opacity: var(--profile-bg-opacity);
  }

  .player-status-card {
    box-shadow: 0px 2px 1px 2px var(--profile-wangzong-shadow);
    background-color: var(--profile-wangzong-bg-primary) !important;
    border: 1px solid var(--profile-wangzong-border);

    .player-status-card__name {
      text-shadow: 0 0 4px var(--profile-wangzong-text-shadow);
      color: var(--profile-wangzong-primary);

      .dark & {
        color: var(--profile-wangzong-dark-primary);
        text-shadow: 0 0 4px var(--profile-wangzong-text-glow);
      }
    }

    .player-status-card__level {
      .dark & {
        color: var(--profile-wangzong-dark-level);
      }
    }
  }

  .el-tabs__item {
    text-shadow: 0 0 4px var(--profile-wangzong-text-shadow);
    color: var(--profile-wangzong-primary);

    .dark & {
      text-shadow: 0 0 4px var(--profile-wangzong-tab-glow);
      color: var(--profile-wangzong-primary);
    }
  }

  .el-tabs__item.is-active {
    color: var(--profile-wangzong-secondary);
    
    .dark & {
      color: var(--profile-wangzong-dark-secondary);
    }
  }

  .el-tabs__active-bar {
    background-color: var(--profile-wangzong-primary);
  }

  .equipment-card {
    background-color: var(--profile-wangzong-bg-card);
    border-radius: 12px;

    .equipment-slot {
      box-shadow: 0px 2px 1px 1px var(--profile-wangzong-shadow);
      background-color: var(--profile-wangzong-bg-equipment) !important;
      border: 1px solid var(--profile-wangzong-border);

      .dark & {
        color: gray;
      }
    }

    .el-divider__text.is-center {
      background-color: var(--profile-wangzong-bg-secondary);
      color: var(--profile-wangzong-primary);
      border-radius: 12px;
    }
  }

  .el-tabs__nav-wrap:after {
    background-color: var(--profile-wangzong-divider);
  }

  [id="pane-skill"] .el-tag {
    background-color: var(--profile-wangzong-dark-secondary);
    color: var(--profile-wangzong-dark-level);
    border-color: var(--profile-wangzong-border);

    .dark & {
      background-color: var(--profile-wangzong-dark-primary);
      color: var(--profile-wangzong-secondary);
      border-color: var(--profile-wangzong-bg-secondary);

    }
  }

  [id="pane-kitties"] .player-profile__kitty {
    background-color: var(--profile-wangzong-bg-primary);
    border-color: var(--profile-wangzong-border);

    color: var(--profile-wangzong-secondary);

    .dark & {
      color: var(--profile-wangzong-dark-secondary);
    }

    .player-profile__kitty-name-label {
      color: var(--profile-wangzong-secondary);
      opacity: 0.6;

      .dark & {
        color: var(--profile-wangzong-dark-secondary);
      }
    }
    .player-profile__kitty-name {
      color: var(--profile-wangzong-secondary);

      .dark & {
        color: var(--profile-wangzong-dark-secondary);
      }
    }
  }

  .player-info__copy-skill {
    background-color: var(--profile-wangzong-dark-secondary);
    color: var(--profile-wangzong-secondary);
    border-color: var(--profile-wangzong-border);

    .dark & {
      background-color: var(--profile-wangzong-primary);
    }
  }
}

.el-dialog:has(.profile-card--fishing_1) {
  --profile-style-primary: #83a3ff;
  --profile-style-secondary: #002aa3;
  --profile-style-bg-primary: rgb(184, 230, 255, 0.38);
  --profile-style-bg-secondary: rgb(176, 196, 255, 0.56);
  --profile-style-bg-card: rgb(215, 223, 247, 0.26);
  --profile-style-bg-equipment: rgb(184, 230, 255, 0.28);
  --profile-style-shadow: rgb(183, 215, 227, 0.6);
  --profile-style-border: rgb(193, 188, 232, 0.39);
  --profile-style-text-shadow: #dce9ff;
  --profile-style-text-glow: #001435;
  --profile-style-tab-glow: #0057e9;
  --profile-style-divider: #7391dd61;
  --profile-style-dark-primary: #b0c4ff;
  --profile-style-dark-secondary: #d4dfff;
  --profile-style-dark-level: #003284;

  // 通用变量
  --profile-close-btn-color: white;
  --profile-bg-black: #000000;
  --profile-bg-opacity: 1;

  --profile-style-item-box-shadow: 0px 2px 1px 2px rgb(54 175 250 / 38%);
  --profile-style-item-bg-color: rgb(151 222 252 / 60%) !important;
  --profile-style-item-border-color: rgb(54 177 247 / 38%);


  // pointer-events: none;

  padding: 0.5rem;
  
  .el-dialog__close {
    color: var(--profile-close-btn-color);
  }

  &:before {
    content: "";
    display: block;
    background: rgba(246, 234, 216, 0.8117647059);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--profile-bg-black);
    background-image: url(/static/images/fishing_profile_bg_1.png);
    background-size: 460px;
    background-position: center;
    opacity: var(--profile-bg-opacity);
    border-radius: 4px;

    @media (max-width: 768px) {
      background-size: 510px;
    }
  }

  .profile-card__name {
    color: white;
    text-shadow: 0 0 4px #808af987;
  }
  .profile-card__guild-info {
    color: white;
    text-shadow: 0 0 4px #808af987;
  }
  .profile-card__title {
    color: white;
    text-shadow: 0 0 4px #808af987;
  }
  .profile-card__join-date {
    color: white;
    text-shadow: 0 0 4px #1260db;
  }

  .player-info-card__current-action {
    color: white;
    text-shadow: 0 0 4px #1260db;

    @media (max-width: 768px) {
      text-align: center;
    }
  }

  .player-status-card {
    box-shadow: 0px 2px 1px 2px rgb(54 175 250 / 38%);
    background-color: rgb(151 222 252 / 60%) !important;
    border: 1px solid rgb(54 177 247 / 38%);

    .player-status-card__name {
      text-shadow: 0 0 4px #35b0f9;
      color: #ffffff;
    }

    .player-status-card__level{
      text-shadow: 0 0 4px #0b7da8;
      color: #ffffff;
    }

    @media (max-width: 768px) {
      min-height: 56px !important;
      height: 56px !important;
      padding-left: 0.3rem !important;
      border-radius: 0.6rem !important;
      font-size: 0.9rem !important;
    }
  }

  .el-tabs__item {
    text-shadow: 0 0 4px #f0f0f1;
    color: #0399f2;
  }

  .el-tabs__item.is-active {
    color: #ffffff;
    text-shadow: 0 0 4px #28a0ec;
  }

  .el-tabs__active-bar {
    background-color: #fff;
  }

  .equipment-card {
    background-color: transparent;
    border-radius: 12px;

    .equipment-slot {
      box-shadow: var(--profile-style-item-box-shadow);
      background-color: var(--profile-style-item-bg-color);
      border: var(--profile-style-item-border-color);

      color: white;
      text-shadow: 0 0 4px #00649d;
    }

    .el-divider__text.is-center {
      background-color: var(--profile-style-bg-secondary);
      color: var(--profile-style-primary);
      border-radius: 12px;
    }
  }

  .el-tabs__nav-wrap:after {
    background-color: var(--profile-style-divider);
  }

  [id="pane-skill"] .el-tag {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    color: white;
    text-shadow: 0 0 2px #00086a;
  }

  [id="pane-kitties"] .player-profile__kitty {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    .player-profile__kitty-name-label {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
    .player-profile__kitty-name {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
    .player-profile__kitty-current-action {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
  }

  .player-info__copy-skill {
    background-color: #34b1f7;
    border: rgb(46 173 249);
  }
}

.el-dialog:has(.profile-card--night_ninja_1) {
  --profile-style-primary: #83a3ff;
  --profile-style-secondary: #002aa3;
  --profile-style-bg-primary: rgb(184, 230, 255, 0.38);
  --profile-style-bg-secondary: rgb(176, 196, 255, 0.56);
  --profile-style-bg-card: rgb(215, 223, 247, 0.26);
  --profile-style-bg-equipment: rgb(184, 230, 255, 0.28);
  --profile-style-shadow: rgb(183, 215, 227, 0.6);
  --profile-style-border: rgb(193, 188, 232, 0.39);
  --profile-style-text-shadow: #dce9ff;
  --profile-style-text-glow: #001435;
  --profile-style-tab-glow: #0057e9;
  --profile-style-divider: #7391dd61;
  --profile-style-dark-primary: #b0c4ff;
  --profile-style-dark-secondary: #d4dfff;
  --profile-style-dark-level: #003284;

  // 通用变量
  --profile-close-btn-color: white;
  --profile-bg-black: #000000;
  --profile-bg-opacity: 1;

  --profile-style-item-box-shadow: 0px 2px 4px 2px rgb(129 152 178 / 38%), inset 0px 0px 4px 2px rgb(22 51 82 / 35%);
  --profile-style-item-bg-color: rgb(16 39 63 / 62%) !important;
  --profile-style-item-border-color: rgb(15 36 56 / 38%);

  padding: 0.5rem;
  
  .el-dialog__close {
    color: var(--profile-close-btn-color);
  }

  &:before {
    content: "";
    display: block;
    background: rgba(246, 234, 216, 0.8117647059);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--profile-bg-black);
    background-image: url(/static/images/night_ninja_profile_bg_1.png);
    background-size: 545px;
    background-position: -30px 0px;
    opacity: var(--profile-bg-opacity);
    border-radius: 4px;

    @media (max-width: 768px) {
      background-size: 510px;
    }
  }

  .player-info-card__header {
    @media (max-width: 768px) {
      align-items: start;
      width: 85%;
      opacity: 0.62;
    }

    .profile-card__name {
      color: white;
      text-shadow: 0 0 4px #808af987;
    }
    .profile-card__guild-info {
      color: white;
      text-shadow: 0 0 4px #808af987;
    }
    .profile-card__title {
      color: white;
      text-shadow: 0 0 4px #808af987;
    }
    .profile-card__join-date {
      color: white;
      text-shadow: 0 0 4px #1260db;
    }
  }

  .player-info-card__current-action {
    color: white;
    text-shadow: 0 0 4px #1260db;

    @media (max-width: 768px) {
      text-align: center;
      opacity: 0.62;
    }
  }

  .player-status-card {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    .player-status-card__name {
      text-shadow: 0 0 4px #35b0f9;
      color: #ffffff;
    }

    .player-status-card__level{
      text-shadow: 0 0 4px #0b7da8;
      color: #ffffff;
    }

    @media (max-width: 768px) {
      min-height: 56px !important;
      height: 56px !important;
      padding-left: 0.3rem !important;
      border-radius: 0.6rem !important;
      font-size: 0.9rem !important;
    }
  }

  .el-tabs__item {
    text-shadow: 0 0 4px #142c45;
    color: #5578a4;
  }

  .el-tabs__item.is-active {
    color: #ffffff;
    text-shadow: 0 0 4px #b8daff;
  }

  .el-tabs__active-bar {
    background-color: #fff;
    box-shadow: 0 1px 2px 2px white;
  }

  .equipment-card {
    background-color: transparent;
    border-radius: 12px;

    .equipment-slot {
      box-shadow: var(--profile-style-item-box-shadow);
      background-color: var(--profile-style-item-bg-color);
      border: var(--profile-style-item-border-color);

      color: white;
      text-shadow: 0 0 4px #00649d;
    }

    .el-divider__text.is-center {
      background-color: var(--profile-style-bg-secondary);
      color: var(--profile-style-primary);
      border-radius: 12px;
    }
  }

  .el-tabs__nav-wrap:after {
    background-color: var(--profile-style-divider);
  }

  [id="pane-skill"] .el-tag {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    color: white;
    text-shadow: 0 0 2px #00086a;
  }

  [id="pane-kitties"] .player-profile__kitty {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    .player-profile__kitty-name-label {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
    .player-profile__kitty-name {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
    .player-profile__kitty-current-action {
      text-shadow: 0 0 4px #35b0f8;
      color: #ffffff;
    }
  }

  .player-info__copy-skill {
    background-color: #34b1f7;
    border: rgb(46 173 249);
  }
}

.el-dialog:has(.profile-card--cute_kitty_1) {
  --profile-style-primary: #83a3ff;
  --profile-style-secondary: #002aa3;
  --profile-style-bg-primary: rgb(184, 230, 255, 0.38);
  --profile-style-bg-secondary: rgb(176, 196, 255, 0.56);
  --profile-style-bg-card: rgb(215, 223, 247, 0.26);
  --profile-style-bg-equipment: rgb(184, 230, 255, 0.28);
  --profile-style-shadow: rgb(183, 215, 227, 0.6);
  --profile-style-border: rgb(193, 188, 232, 0.39);
  --profile-style-text-shadow: #dce9ff;
  --profile-style-text-glow: #001435;
  --profile-style-tab-glow: #0057e9;
  --profile-style-divider: #7391dd61;
  --profile-style-dark-primary: #b0c4ff;
  --profile-style-dark-secondary: #d4dfff;
  --profile-style-dark-level: #003284;

  // 通用变量
  --profile-close-btn-color: white;
  --profile-bg-black: #000000;
  --profile-bg-opacity: 1;

  --profile-style-item-box-shadow: 0px 2px 4px 2px rgb(189 149 104 / 54%);
  --profile-style-item-bg-color: rgb(214 187 158 / 48%) !important;
  --profile-style-item-border-color: rgb(252 247 245 / 38%);

  padding: 0.5rem;
  
  .el-dialog__close {
    color: var(--profile-close-btn-color);
  }

  &:before {
    content: "";
    display: block;
    background: rgba(246, 234, 216, 0.8117647059);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--profile-bg-black);
    background-image: url(/static/images/cute_profile_bg_1.png);
    background-size: 450px;
    background-position: -30px 0px;
    opacity: var(--profile-bg-opacity);
    border-radius: 4px;
  }

  .player-info-card__header {
    .profile-card__name {
      color: white;
      text-shadow: 0 0 4px #674f4d;
    }
    .profile-card__guild-info {
      color: white;
      text-shadow: 0 0 4px #674f4d;
    }
    .profile-card__title {
      color: white;
      text-shadow: 0 0 4px #674f4d;
    }
    .profile-card__join-date {
      color: white;
      text-shadow: 0 0 4px #674f4d;
    }
  }

  .player-info-card__current-action {
    color: white;
    text-shadow: 0 0 4px #674f4d;

    @media (max-width: 768px) {
      text-align: center;
    }
  }

  .player-status-card {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    .player-status-card__name {
      text-shadow: 0 0 4px #674f4d;
      color: #ffffff;
    }

    .player-status-card__level{
      text-shadow: 0 0 4px #674f4d;
      color: #ffffff;
    }

    @media (max-width: 768px) {
      min-height: 56px !important;
      height: 56px !important;
      padding-left: 0.3rem !important;
      border-radius: 0.6rem !important;
      font-size: 0.9rem !important;
    }
  }

  .el-tabs__item {
    text-shadow: 0 0 4px #f3d1b0;
    color: #ceb091;
  }

  .el-tabs__item.is-active {
    color: #ffffff;
    text-shadow: 0 0 4px #c2b8af;
  }

  .el-tabs__active-bar {
    background-color: #f3d1b0;
  }

  .equipment-card {
    background-color: #a2958333;
    border-radius: 12px;

    .equipment-slot {
      box-shadow: var(--profile-style-item-box-shadow);
      background-color: var(--profile-style-item-bg-color);
      border: var(--profile-style-item-border-color);

      color: white;
      text-shadow: 0 0 4px #9d4d00;
    }

    .el-divider {
      border-color: #f2d4b4;
    }

    .el-divider__text.is-center {
      background-color: #f2d4b4;
      color: #cb9d96;
      border-radius: 12px;
    }
  }

  .el-tabs__nav-wrap:after {
    background-color: #f2d4b4;
  }

  [id="pane-skill"] .el-tag {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    color: #b27a5a;
    text-shadow: 0 0 2px #ffffff;
  }

  [id="pane-kitties"] .player-profile__kitty {
    box-shadow: var(--profile-style-item-box-shadow);
    background-color: var(--profile-style-item-bg-color);
    border: var(--profile-style-item-border-color);

    .player-profile__kitty-name-label {
      color: #b27a5a;
      text-shadow: 0 0 2px #ffffff;
    }
    .player-profile__kitty-name {
      color: #b27a5a;
      text-shadow: 0 0 2px #ffffff;
    }
    .player-profile__kitty-current-action {
      color: #b27a5a;
      text-shadow: 0 0 2px #ffffff;
    }
  }

  .player-info__copy-skill {
    background-color: #e5b399ba;
    border: #e5b399;
  }
}
</style>