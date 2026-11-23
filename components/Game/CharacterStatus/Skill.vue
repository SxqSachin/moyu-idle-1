<template>
  <div class="py-0">
    <el-tabs v-model="activeTab" type="card" class="mb-2">
      <el-tab-pane label="已启用" name="enabled">
        <div class="p-2">
          <div v-if="enabledSkills.length === 0" class="text-gray-400 text-sm w-full">暂无已启用技能</div>
          <draggable v-else
          :disabled="!!battleInfo?.battleStatus"
          v-model="localSkills"
            class="grid gap-2 w-full skill-grid"
            @end="onDragEnd" item-key="skillId" handle=".skill-card"
            :animation="220" :ghost-class="'drag-ghost'" :chosen-class="'drag-chosen'" :drag-class="'drag-dragging'"
            :delay="device.isMobile ? 150 : 0">
            <template #item="{ element: skill }">
              <div class="relative skill-card transition-all duration-200">
                <GameCharacterStatusSkillBase :skill="skill"></GameCharacterStatusSkillBase>
              </div>
            </template>
          </draggable>

          <el-button class="mt-2" @click="saveCurrentSkillAsOutfit" type="primary" plain>
            保存当前技能配置
          </el-button>
        </div>
      </el-tab-pane>
      <el-tab-pane label="未启用" name="disabled">
        <div class="grid gap-2 p-2 skill-grid">
          <template v-for="skill in skills" :key="skill.skillId">
            <div v-if="!skill.enabled" class="relative skill-card transition-all duration-200">
              <GameCharacterStatusSkillBase :skill="skill"></GameCharacterStatusSkillBase>
            </div>
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue"
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { emitGetCharacterBattleSkills, emitReorderCharacterSkills, onReorderCharacterSkillsSuccess } from '~/api/game/socket/skills'
import draggable from 'vuedraggable'
import type { FuncAction } from "~/shared/types"
import { useBattleInfo } from "~/composables/game/useBattleInfo"
import { emitSaveCurrentSkillAsOutfit, onSaveCurrentSkillAsOutfitFail, onSaveCurrentSkillAsOutfitSuccess } from "~/api/game/socket/outfit"

const battleInfo = useBattleInfo()
const skills = useCharacterBattleSkills()
const localSkills = ref<any[]>([])
const device = useDevice()

const activeTab = ref("enabled")
const enabledSkills = computed(() =>
  skills.value.filter(s => s.enabled)
)

const showSuccess = ref(false)
let unbind: FuncAction | undefined
let unbind2: FuncAction | undefined
let unbind3: FuncAction | undefined

// 初始化和监听时都按 order 排序
watch(skills, (val) => {
  localSkills.value = [...val].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter(s => s.enabled)
}, { immediate: true })

onMounted(async () => {
  await waitUtilConnected()
  emitGetCharacterBattleSkills()
  unbind = onReorderCharacterSkillsSuccess(() => {
    showSuccess.value = true
    setTimeout(() => showSuccess.value = false, 1200)
  })

  unbind2 = onSaveCurrentSkillAsOutfitSuccess(() => {
    ElNotification.success({
      title: "保存成功",
    })
  })
  unbind3 = onSaveCurrentSkillAsOutfitFail((data) => {
    ElNotification.error({
      title: "保存失败:" + data.message,
    })
  })
})

onUnmounted(() => {
  if (unbind) unbind()
})

function onDragEnd() {
  const skillOrder = localSkills.value.map(s => s.skillId)
  if (skillOrder.length) {
    emitReorderCharacterSkills(skillOrder)
  }
}

function saveCurrentSkillAsOutfit() {
  if (localSkills.value.length === 0) {
    ElMessage.warning("当前没有启用的技能")
    return
  }

  ElMessageBox.prompt(
    '请输入方案名称',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /^.{1,12}$/,
      inputErrorMessage: '请输入1~12个字符',
    }
  ).then(({ value }) => {
    emitSaveCurrentSkillAsOutfit(value);
  }).catch(() => { })

}
</script>

<style scoped>
.skill-card {
  margin: 0;
  padding: 0;
  transition: box-shadow 0.2s, transform 0.2s;
  width: 100%;
  min-width: 0;
}

.skill-grid {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

@media (max-width: 640px) {
  .skill-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.drag-ghost {
  opacity: 0.5;
  background: #f3f4f6;
  /* border: 1.5px dashed #a5b4fc; */
}
.drag-chosen {
  box-shadow: 0 0 8px 2px #6366f1;
  transform: scale(1.04);
  z-index: 10;
}
.drag-dragging {
  opacity: 0.8;
  background: #e0e7ff;
}
</style>