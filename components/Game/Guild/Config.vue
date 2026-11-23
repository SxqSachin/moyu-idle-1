<template>
    <div>
        <el-tabs v-model="tab">
            <el-tab-pane :lazy="true" label="公会信息" name="info">
                <el-form :model="baseInfoForm" label-width="80px" class="space-y-4 px-2 pt-2">
                    <el-form-item label="名称">
                        <el-input v-model="baseInfoForm.name" maxlength="16" show-word-limit />
                    </el-form-item>
                    <el-form-item label="简介">
                        <el-input v-model="baseInfoForm.description" type="textarea" maxlength="100" show-word-limit />
                    </el-form-item>
                    <el-form-item label="专精">
                        <el-select :multiple="true" v-model="baseInfoForm.type" placeholder="请选择专精">
                            <el-option label="生活" value="life" />
                            <el-option label="摸鱼" value="idle" />
                            <el-option label="战斗" value="battle" />
                            <template v-for="mainType of allGameActionMainType">
                                <el-option :label="mainType.name" :value="mainType.id">
                                    <el-icon class="menu-icon">
                                        <Icon :name="mainType.icon" class="size-5" mode="css"></Icon>
                                    </el-icon>
                                    {{ mainType.name }}
                                </el-option>
                            </template>
                        </el-select>
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" @click="onSaveBaseInfo" :loading="loading">保存修改</el-button>
                        <el-button @click="emits('close')">取消</el-button>
                    </el-form-item>
                </el-form>
            </el-tab-pane>

            <el-tab-pane :lazy="true" label="头衔" name="title">
                <div class="mb-4 flex justify-end">
                    <el-button type="primary" size="small" @click="openAddTitleDialog">新建头衔</el-button>
                </div>
                <el-table :data="titleList" style="width: 100%">
                    <el-table-column prop="title" label="头衔" width="120" />
                    <el-table-column prop="role" label="角色" width="120">
                        <template #default="scope">
                            <span>{{ getGuildRoleName(scope.row.role) }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column prop="description" label="描述" />
                    <el-table-column label="操作" width="140" fixed="right">
                        <template #default="scope">
                            <el-button size="small" @click="openEditTitleDialog(scope.row)">编辑</el-button>
                            <el-popconfirm title="确定删除该头衔吗？" @confirm="onDeleteTitle(scope.row)">
                                <template #reference>
                                    <el-button size="small" type="danger">删除</el-button>
                                </template>
                            </el-popconfirm>
                        </template>
                    </el-table-column>
                </el-table>

            </el-tab-pane>
        </el-tabs>

        <!-- 新建/编辑弹窗 -->
        <el-dialog v-model="titleDialog.visible" :title="titleDialog.editing ? '编辑头衔' : '新建头衔'" width="400px">
            <el-form :model="titleDialog.form" label-width="60px">
                <el-form-item label="头衔" :rules="[{ required: true, message: '请输入头衔' }, { max: 10, message: '最多10个字' }]">
                    <el-input v-model="titleDialog.form.title" maxlength="12" show-word-limit />
                </el-form-item>
                <el-form-item label="角色">
                    <el-select v-model="titleDialog.form.role" placeholder="请选择角色">
                        <el-option :label="getGuildRoleName(GuildRole.MEMBER)" :value="GuildRole.MEMBER" />
                        <el-option :label="getGuildRoleName(GuildRole.OFFICER)" :value="GuildRole.OFFICER" />
                        <el-option :label="getGuildRoleName(GuildRole.LEADER)" :value="GuildRole.LEADER" />
                    </el-select>
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="titleDialog.form.description" maxlength="40" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="titleDialog.visible = false">取消</el-button>
                <el-button type="primary" @click="onSubmitTitle" :loading="titleDialog.loading">
                    {{ titleDialog.editing ? "保存" : "创建" }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="tsx">
import { onMounted } from "vue";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { ElNotification } from "element-plus";
import {
    emitGetMyGuild, emitGetOtherGuildInfo, emitUpdateGuildInfo,
    onGetMyGuildSuccess, onGetOtherGuildSuccess, onUpdateGuildInfoFail, onUpdateGuildInfoSuccess,
    emitGetGuildTitles, onGetGuildTitlesSuccess, onGetGuildTitlesFail,
    emitAddGuildTitle, onAddGuildTitleSuccess, onAddGuildTitleFail,
    emitUpdateGuildTitle, onUpdateGuildTitleSuccess, onUpdateGuildTitleFail,
    emitDeleteGuildTitle, onDeleteGuildTitleSuccess, onDeleteGuildTitleFail
} from "~/api/game/socket/guild";
import type { FuncAction } from "~/shared/types";
import { getGuildRoleName, GuildRole, type GameGuild } from "~/shared/types/guild";
import { allGameActionMainType } from "~/shared/data/allGameActions";
import { sanitizeInput } from "~/shared/utils";
import { de } from "element-plus/es/locale/index.mjs";

const guild = ref<GameGuild | null>()
const editing = ref(false);
const loading = ref(false);

const tab = ref("info")

const baseInfoForm = ref({
    name: guild.value?.name ?? "",
    description: guild.value?.description || '',
    type: guild.value?.type || []
})

const emits = defineEmits<{
    (e: 'close'): void
}>()

const titleList = ref<{ uuid: string; title: string; role: GuildRole; description?: string }[]>([]);
const titleDialog = ref({
    visible: false,
    editing: false,
    loading: false,
    form: {
        uuid: "",
        title: "",
        role: GuildRole.MEMBER,
        description: ""
    }
});

let offGetGuild: FuncAction
let offUpdateSuccess: FuncAction
let offUpdateFail: FuncAction
let offGetTitlesSuccess: FuncAction
let offGetTitlesFail: FuncAction
let offAddTitleSuccess: FuncAction
let offAddTitleFail: FuncAction
let offUpdateTitleSuccess: FuncAction
let offUpdateTitleFail: FuncAction
let offDeleteTitleSuccess: FuncAction
let offDeleteTitleFail: FuncAction

function onSaveBaseInfo() {
    if (!guild.value) return

    loading.value = true
    editing.value = false

    baseInfoForm.value.name = sanitizeInput(baseInfoForm.value.name)

    emitUpdateGuildInfo({
        guildUuid: guild.value.uuid,
        name: baseInfoForm.value.name,
        description: baseInfoForm.value.description,
        type: baseInfoForm.value.type
    })
}

function openAddTitleDialog() {
    titleDialog.value.visible = true;
    titleDialog.value.editing = false;
    titleDialog.value.form = {
        uuid: "",
        title: "",
        role: GuildRole.MEMBER,
        description: ""
    };
}
function openEditTitleDialog(row: any) {
    titleDialog.value.visible = true;
    titleDialog.value.editing = true;
    titleDialog.value.form = { ...row };
}
function onSubmitTitle() {
    if (!guild.value) return;
    titleDialog.value.loading = true;
    if (titleDialog.value.editing) {
        emitUpdateGuildTitle({
            guildUuid: guild.value.uuid,
            titleUuid: titleDialog.value.form.uuid,
            title: titleDialog.value.form.title,
            role: titleDialog.value.form.role,
            description: titleDialog.value.form.description
        });
    } else {
        emitAddGuildTitle({
            guildUuid: guild.value.uuid,
            title: titleDialog.value.form.title,
            role: titleDialog.value.form.role,
            description: titleDialog.value.form.description
        });
    }
}
function onDeleteTitle(row: any) {
    if (!guild.value) return;
    emitDeleteGuildTitle({
        guildUuid: guild.value.uuid,
        titleUuid: row.uuid
    });
}

onMounted(async () => {
    await waitUtilConnected()

    offGetGuild = onGetMyGuildSuccess((guildData) => {
        guild.value = guildData.guild

        baseInfoForm.value.name = guild.value?.name || ''
        baseInfoForm.value.description = guild.value?.description || ''
        baseInfoForm.value.type = guild.value?.type || []

        emitGetGuildTitles(guild.value!.uuid);
    })

    offUpdateSuccess = onUpdateGuildInfoSuccess(() => {
        loading.value = false
        editing.value = false
        // 可选：弹窗提示

        ElNotification({
            title: "公会信息已成功更新！",
            type: "success",
            duration: 1800,
        })

        emitGetOtherGuildInfo(guild.value!.uuid)
    })
    offUpdateFail = onUpdateGuildInfoFail((e) => {
        loading.value = false
        // 可选：弹窗提示

        ElNotification({
            title: "公会信息更新失败:" + e.message,
            type: "error",
            duration: 1800,
        })
    })
    // 头衔相关监听
    offGetTitlesSuccess = onGetGuildTitlesSuccess((data) => {
        titleList.value = data.titles;
    })
    offGetTitlesFail = onGetGuildTitlesFail(() => {
        titleList.value = [];
    })
    offAddTitleSuccess = onAddGuildTitleSuccess(() => {
        titleDialog.value.visible = false;
        titleDialog.value.loading = false;
        emitGetGuildTitles(guild.value!.uuid);
        ElNotification({ title: "添加成功", type: "success", duration: 1200 });
    })
    offAddTitleFail = onAddGuildTitleFail((e) => {
        titleDialog.value.loading = false;
        ElNotification({ title: "添加失败", message:e.message, type: "error", duration: 1200 });
    })
    offUpdateTitleSuccess = onUpdateGuildTitleSuccess(() => {
        titleDialog.value.visible = false;
        titleDialog.value.loading = false;
        emitGetGuildTitles(guild.value!.uuid);
        ElNotification({ title: "修改成功", type: "success", duration: 1200 });
    })
    offUpdateTitleFail = onUpdateGuildTitleFail((e) => {
        titleDialog.value.loading = false;
        ElNotification({ title: "修改失败", message:e.message, type: "error", duration: 1200 });
    })
    offDeleteTitleSuccess = onDeleteGuildTitleSuccess(() => {
        emitGetGuildTitles(guild.value!.uuid);
        ElNotification({ title: "删除成功", type: "success", duration: 1200 });
    })
    offDeleteTitleFail = onDeleteGuildTitleFail((e) => {
        ElNotification({ title: "删除失败", message:e.message, type: "error", duration: 1200 });
    })

    emitGetMyGuild()
})
onUnmounted(() => {
    if (offGetGuild) offGetGuild();
    if (offUpdateSuccess) offUpdateSuccess();
    if (offUpdateFail) offUpdateFail();
    if (offGetTitlesSuccess) offGetTitlesSuccess();
    if (offGetTitlesFail) offGetTitlesFail();
    if (offAddTitleSuccess) offAddTitleSuccess();
    if (offAddTitleFail) offAddTitleFail();
    if (offUpdateTitleSuccess) offUpdateTitleSuccess();
    if (offUpdateTitleFail) offUpdateTitleFail();
    if (offDeleteTitleSuccess) offDeleteTitleSuccess();
    if (offDeleteTitleFail) offDeleteTitleFail();
})
</script>