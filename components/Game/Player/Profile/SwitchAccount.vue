<template>
  <el-card>
    <template #header>
      切换账号
    </template>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  gap-6 justify-center">
      <template v-for="(acc, idx) in (MAX_SUBACCOUNT_COUNT + 1)" :key="idx">
        <el-card>
          <template v-if="accounts[idx]">
            <div class="h-16">
              <GameUserAvatarAndName :uuid="accounts[idx].uuid"></GameUserAvatarAndName>
            </div>
            <el-button v-if="currentUuid === accounts[idx].uuid" type="success" plain disabled size="small"
              class="w-full" @click="switchAccount(accounts[idx].uuid)">当前账号</el-button>
            <template v-else>
              <el-button type="primary" size="small" class="w-full"
                @click="switchAccount(accounts[idx].uuid)">切换</el-button>

              <!-- <el-button type="primary" size="small" class="w-full"
                @click="openDialog(accounts[idx].uuid)">打开</el-button> -->
            </template>
          </template>
          <template v-else>
            <div class="flex-1 flex flex-col justify-center items-center mb-4 h-16">
              <el-icon class="mb-2" color="#aaa" size="32">
                <Plus />
              </el-icon>
              <div class="text-gray-400">未创建</div>
            </div>
            <el-button type="success" size="small" class="w-full" @click="openCreateDialog"
              :disabled="accounts.length >= idx + 1">创建账号</el-button>
          </template>
        </el-card>

      </template>
    </div>
    <!-- 创建账号弹窗 -->
    <el-dialog v-model="showCreateDialog" title="创建账号" width="350px">
      <el-form @submit.prevent>
        <el-form-item label="账号名称">
          <el-input v-model="newAccountName" maxlength="12" show-word-limit placeholder="请输入账号名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateAccount">创建</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="tsx">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage, ElNotification } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import type { FuncAction } from "~/shared/types";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { emitCreateSubAccount, emitGetAccountList, onCreateSubaccountError, onGetAccountListError, onGetAccountListSuccess, } from "~/api/game/socket/account";
import type { AccountInfo } from "~/shared/types/account";
import { MAX_SUBACCOUNT_COUNT } from "~/shared/data/constant";

const accounts = ref<AccountInfo[]>([]);

const openDialogVal = ref<Record<string, boolean>>({});

const showCreateDialog = ref(false);
const newAccountName = ref("");

const user = useUserSession()

const href = computed(() => {
  return location.href;
});

const currentUuid = computed(() => {
  return user.user.value?.uuid
});

let off1: FuncAction;
let off2: FuncAction;
let off3: FuncAction;

onMounted(async () => {
  await waitUtilConnected();

  off1 = onCreateSubaccountError((data) => {
    ElNotification.error({
      title: "创建账号失败",
      message: data.message,
    });
  });

  off2 = onGetAccountListSuccess((data) => {
    accounts.value = data.list;
  });

  off3 = onGetAccountListError((data) => {
    ElNotification.error({
      title: "获取账号列表失败",
      message: data.message,
    });
  });

  emitGetAccountList();
});

onUnmounted(() => {
  off1?.();
  off2?.();
  off3?.();
});

function openCreateDialog() {
  newAccountName.value = "";
  showCreateDialog.value = true;
}

function handleCreateAccount(e: Event) {
    if (!e.isTrusted) return;
    const name = newAccountName.value.trim();
    if (!name) {
        ElMessage.warning("请输入账号名称");
        return;
    }
    if (accounts.value.length >= MAX_SUBACCOUNT_COUNT + 1) {
        ElMessage.warning("最多只能有3个子账号");
        showCreateDialog.value = false;
        return;
    }
    emitCreateSubAccount(name);
    showCreateDialog.value = false;
}

function openDialog(uuid: string) {
  openDialogVal.value[uuid] = true;
  // window.open(`/game/player/profile/${uuid}`, '_blank');
}

function switchAccount(uuid: string) {
  $fetch('/api/game/user/switch_account', {
    method: 'POST',
    body: { targetAccountUuid: uuid },
  }).then(async (res) => {
    if (res.code === 200) {
      ElMessage.success("切换账号成功");
      await user.fetch()

      location.reload()
    } else {
      ElMessage.error(res.msg);
    }
  }).catch((err) => {
    ElMessage.error("切换账号失败，请稍后再试");
  });
}
</script>