<template>
  <el-card class="w-full max-w-md mx-auto mt-8 shadow-lg">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="基本信息" name="base">
        <div class="p-4">
          <GamePlayerProfileEditBase :profile="profile" />
        </div>
      </el-tab-pane>
      <el-tab-pane label="个性化" name="custom">
        <div class="p-4">
          <GamePlayerProfileEditStyle :profile="profile" />
        </div>
      </el-tab-pane>
      <el-tab-pane label="屏蔽" name="block">
        <div class="p-4">
          <GameUserBlockList/>
        </div>
      </el-tab-pane>
    </el-tabs>

  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";
import { emitUpdateProfile, onUpdateProfileSuccess, onUpdateProfileError, clearProfileListeners, emitGetProfile } from "@/api/game/socket/profile";

const activeTab = ref("base")

import { clone, ObjectKeys, sanitizeInput } from "~/shared/utils";
import { useUserStyle } from "~/composables/game/useUserStyle";
import type { GameUserCustomStyle } from "~/shared/types/style";
import { allBattleStyle, allProfileStyle } from "~/shared/data/allStyle";
import { emitSetStyle } from "~/api/game/socket/style";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
const props = defineProps<{
  profile: PlayerProfileInfo
}>();

const userStyle = useUserStyle();

</script>