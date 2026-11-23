<template>
    <div class="flex flex-col gap-4 justify-start py-2">
        <el-tabs v-model="activeTab" class="avatar-tabs">
            <el-tab-pane label="预设头像" name="preset">
                <div>
                    <div class="mb-2 text-base">已解锁：</div>
                    <div class="flex flex-wrap gap-4 justify-start">
                        <template v-for="key in availableAvatars" :key="key">
                            <div class="cursor-pointer rounded-full border-2 w-17 h-17"
                                :class="selected === key ? 'border-pink-400 ring-2 ring-pink-400' : 'border-transparent'"
                                @click="selectAvatar(key)">
                                <el-avatar :src="avatarMap[key]" :size="64" />
                            </div>
                        </template>
                    </div>
                </div>
                <div v-if="lockedAvatars.length">
                    <div class="mb-2 text-base">未解锁：</div>
                    <div class="flex flex-wrap gap-4 justify-start">
                        <template v-for="key in lockedAvatars" :key="key">
                            <el-popover width="200" placement="top">
                                <template #reference>
                                    <div class="cursor-pointer rounded-full w-17 h-17 relative">
                                        <el-avatar :src="avatarMap[key]" :size="64" />
                                        <div class="rounded-full w-16 h-16 bg-gray-500 opacity-70 absolute top-0 left-0">
                                        </div>
                                    </div>
                                </template>
                                <div>
                                    <p>{{ checkAvatarAvailable(key).msg }}</p>
                                </div>
                            </el-popover>
                        </template>
                    </div>
                </div>
            </el-tab-pane>
            <el-tab-pane label="上传自定义" name="upload">
                <template v-if="playerProfile.canUseCustomAvatar?.normal">
                    <div class="avatar-editor flex flex-col gap-6">
                        <div class="editor-left flex flex-col items-center gap-4" v-if="previewUrl">
                            <div class="crop-wrapper relative">
                                <img ref="cropImgRef" :src="previewUrl" class="original-img" alt="裁剪" />
                            </div>
                            <div v-if="previewUrl" class="preview-section flex flex-col items-center gap-2">
                                <div class="preview-circle avatar-crop-preview"></div>
                                <span class="text-xs text-gray-500">圆形预览</span>
                            </div>
                        </div>
                        <div class="editor-right flex-1 flex flex-col gap-4">
                            <el-upload
                                v-if="!previewUrl"
                                class="upload-panel"
                                drag
                                :show-file-list="false"
                                :auto-upload="false"
                                :on-change="onElUploadChange"
                                :accept="acceptTypes"
                            >
                                <div class="el-upload__text">拖拽文件到此或 <em>点击选择</em></div>
                                <template #tip>
                                    <div class="el-upload__tip text-xs text-gray-500">支持 {{ acceptTypes }} ，最大4MB</div>
                                </template>
                            </el-upload>

                            <div v-if="previewUrl" class="control-block flex flex-col gap-3">
                                <!-- <div class="zoom-row flex items-center gap-3">
                                    <span class="text-xs text-gray-600">缩放</span>
                                    <el-slider v-model="zoomLevel" :min="0.5" :max="2" :step="0.01" @input="onZoomInput" class="flex-1" />
                                    <el-button size="small" text @click="resetCropper">重置</el-button>
                                </div> -->
                                <!-- <div class="file-info flex items-center gap-2" v-if="fileName">
                                    <span class="text-xs truncate max-w-[220px]">{{ fileName }}</span>
                                    <el-button text size="small" @click="clearFile">清除</el-button>
                                </div> -->
                            </div>

                            <div v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</div>
                            <div v-if="uploading" class="flex items-center gap-2">
                                <el-progress :percentage="uploadProgress" :status="uploadProgress===100?'success':''" style="width:160px" />
                                <span class="text-xs" v-if="uploadProgress<100">上传中...</span>
                                <span class="text-xs text-green-600" v-else>处理完成</span>
                            </div>
                            <div class="action-row flex flex-wrap gap-3" v-if="previewUrl">
                                <el-button size="small" type="info" plain @click="reselectImage">重新选择</el-button>
                                <el-button type="primary" size="small" :disabled="!file || uploading" @click="upload">裁剪并上传</el-button>
                                <el-button size="small" :disabled="!uploadedAvatar" @click="applyUploaded">使用该头像</el-button>
                            </div>
                            <div v-if="uploadedAvatar" class="text-xs text-green-600">上传成功（点击“使用该头像”并保存后应用）</div>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div class="text-gray-500 space-y-1">
                        <div>你暂无权限使用自定义头像</div>
                        <div v-if="!playerProfile.canUseCustomAvatar?.normal">累计赞助点数达到 {{ CUSTOM_AVATAR_MIN_SPONSOR_POINTS }} 及以上后可用</div>
                    </div>
                </template>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang="tsx">

const userUniqueFlag = useUniqueFlag()

// 批量导入17个头像
const props = defineProps<{
  defaultSelected?: string
}>();

import { useUniqueFlag } from "~/composables/game/useUniqueFlag";
import { ObjectKeysTyped } from "~/shared/utils";
import { avatarCheck } from "~/shared/utils/game/avatarCheck";
import { avatarMap } from "~/utils/avatar";
import { ElMessage } from 'element-plus'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { usePlayerProfile } from "~/composables/game/usePlayerProfile";
import { CUSTOM_AVATAR_MIN_SPONSOR_POINTS } from "~/shared/data/constant";

const playerProfile = usePlayerProfile();

const selected = ref<string>(props.defaultSelected ?? "avatar_1.png")
const activeTab = ref<'preset'|'upload'>('preset')

// upload related states
const file = ref<File|null>(null)
const fileName = ref('')
const previewUrl = ref('')
const errorMsg = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadedAvatar = ref('')
const zoomLevel = ref(1)
const acceptTypes = computed(() => ['image/png','image/jpeg','image/jpg'].join(','))

// cropper states
const cropImgRef = ref<HTMLImageElement | null>(null)
let cropper: Cropper | null = null

const availableAvatars = computed(() => {
    let allAvatarKeys = ObjectKeysTyped(avatarMap);
    allAvatarKeys = allAvatarKeys.filter(key => {
        return checkAvatarAvailable(key).result;
    });

    return allAvatarKeys;
});

const lockedAvatars = computed(() => {
    let allAvatarKeys = ObjectKeysTyped(avatarMap);
    allAvatarKeys = allAvatarKeys.filter(key => {
        return !checkAvatarAvailable(key).result;
    });

    return allAvatarKeys;
});

const emits = defineEmits<{
  (e: "update:avatar", avatar: string): void
}>();

const selectAvatar = (key: string) => {
  selected.value = key;
  emits("update:avatar", key);
};

function onElUploadChange(fileObj: any) {
    errorMsg.value = ''
    const f: File = fileObj.raw
    if (!f) return
    const allowed = ['image/png','image/jpeg','image/jpg']
    if (!allowed.includes(f.type)) {
        errorMsg.value = '文件类型不支持'
        return
    }
    if (f.size > 1024 * 1024 * 4) { // 4MB 与后端保持一致
        errorMsg.value = '图片需小于4MB'
        return
    }
    file.value = f
    fileName.value = f.name
    previewUrl.value = URL.createObjectURL(f)
    nextTick(() => initCropper())
}

function clearFile() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    file.value = null
    fileName.value = ''
    previewUrl.value = ''
    errorMsg.value = ''
    uploadProgress.value = 0
}

function reselectImage() {
    clearFile()
    // 用户看到上传区域重新出现即可重新选择
}

async function upload() {
    if (!file.value) return
    errorMsg.value = ''
    uploading.value = true
    uploadProgress.value = 15
    try {
        const fd = new FormData()
        const blob = await getCroppedBlob()
        if (!blob) {
            errorMsg.value = '裁剪失败，请重试'
            uploading.value = false
            return
        }
        const uploadFile = new File([blob], fileName.value || 'avatar.png', { type: 'image/png' })
        fd.append('file', uploadFile)
        uploadProgress.value = 35
        const res: any = await $fetch('/api/game/user/upload-avatar', {
            method: 'POST',
            body: fd,
        })
        uploadProgress.value = 80
        if (res.code !== 200) {
            errorMsg.value = res.msg || '上传失败'
            uploading.value = false
            return
        }
        uploadProgress.value = 100
        uploadedAvatar.value = res.data.avatar
        ElMessage.success('上传成功')
    } catch (e: any) {
        errorMsg.value = e?.message || '上传异常'
    } finally {
        uploading.value = false
    }
}

function initCropper() {
    if (!cropImgRef.value) return
    if (cropper) {
        cropper.destroy()
        cropper = null
    }
    cropper = new Cropper(cropImgRef.value, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        background: false,
        guides: false,
        autoCropArea: 0.8,
        movable: true,
        zoomable: true,
        scalable: false,
        rotatable: false,
        responsive: true,
        preview: '.avatar-crop-preview',
    })
    zoomLevel.value = 1
}

function resetCropper() {
    if (cropper) cropper.reset()
    zoomLevel.value = 1
}

function zoom(delta: number) {
    if (cropper) cropper.zoom(delta)
}

function onZoomInput(val: number | number[]) {
    if (!cropper) return
    const v = Array.isArray(val) ? val[0] : val
    zoomLevel.value = v
    cropper.zoomTo(v)
}

function getCroppedBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (!cropper) return resolve(null)
        const canvas = cropper.getCroppedCanvas({ width: 256, height: 256, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' })
        if (!canvas) return resolve(null)
        canvas.toBlob((blob: Blob | null) => resolve(blob), 'image/png', 0.92)
    })
}

onBeforeUnmount(() => {
    if (cropper) {
        cropper.destroy()
        cropper = null
    }
})

function applyUploaded() {
    if (!uploadedAvatar.value) return
    selected.value = uploadedAvatar.value
    emits('update:avatar', uploadedAvatar.value)
    ElMessage.success('已应用新头像')
}


function checkAvatarAvailable(key: keyof typeof avatarMap): {
    result: boolean,
    msg?: string,
} {
    for (const check of avatarCheck[key]) {
        const hasFlag = userUniqueFlag.value.some(flag => flag.type === check.data.type && flag.key === check.data.key);

        if ((check.condition === 'has' && !hasFlag)) {
            return {
                result: false,
                msg: check.conditionDescription
            };
        }
    }

    return {
        result: true,
    }
}

</script>

<style scoped>
.avatar-editor { width:100%; }
.crop-wrapper { width:288px; height:288px; background: var(--el-fill-color-blank); border:1px solid var(--el-border-color); border-radius:8px; position:relative; overflow:hidden; }
@media (max-width:640px){
  .avatar-editor { flex-direction:column; }
  .crop-wrapper { width:80vw; height:80vw; max-width:320px; max-height:320px; }
}
.original-img { max-width:100%; display:block; }
.preview-circle, .avatar-crop-preview { width:96px; height:96px; border-radius:50%; overflow:hidden; border:1px solid var(--el-border-color); background:#fff; }
.avatar-crop-preview :deep(img) { width:100%; height:100%; object-fit:cover; }
.placeholder { width:100%; height:100%; }
/* Restore cropper internal sizing */
.crop-wrapper :deep(.cropper-container){ width:100%!important; height:100%!important; }
.crop-wrapper :deep(.cropper-bg){ background:#000; } /* darken background behind image */
.crop-wrapper :deep(.cropper-view-box){ outline:2px solid #fff; box-shadow:0 0 0 9999px rgba(0,0,0,.55); border-radius:4px; }
.crop-wrapper :deep(.cropper-face){ background:transparent!important; }
.crop-wrapper :deep(.cropper-dashed){ opacity:0; }
.crop-wrapper :deep(.cropper-point){ width:8px; height:8px; background:#fff; opacity:0.9; }
</style>