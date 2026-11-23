<template>
  <div>
    <ProfileView v-if="!editing" :profile="profile" />
    <div class="flex justify-center mt-4" v-if="!editing">
      <el-button type="primary" @click="editing = true">编辑资料</el-button>
    </div>
    <ProfileEdit
      v-else
      :profile="profile"
      @updated="handleUpdated"
      @cancel="editing = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ProfileView from "./View.vue";
import ProfileEdit from "./Edit/Index.vue";
import { emitGetProfile, onGetProfileSuccess, onGetProfileError, clearProfileListeners } from "@/api/game/socket/profile";
import { ElMessage } from "element-plus";
import { usePlayerProfile } from "~/composables/game/usePlayerProfile";
import { waitUtilConnected } from "~/api/game/socket/socket";

const profile = usePlayerProfile()
const editing = ref(false);

function fetchProfile() {
  emitGetProfile();
}

onMounted(async () => {
  await waitUtilConnected()

  fetchProfile();

  onGetProfileSuccess((data) => {
    if (data) profile.value = data;
  });
  onGetProfileError((msg) => {
    ElMessage.error(msg);
  });
});

onUnmounted(() => {
  clearProfileListeners();
});

function handleUpdated() {
  editing.value = false;
  fetchProfile();
}
</script>