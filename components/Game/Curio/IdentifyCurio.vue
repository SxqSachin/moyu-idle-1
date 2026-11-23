<template>
  <div class="text-center py-12">
    <el-button
      type="primary"
      :loading="loading"
      @click="openIdentifyDialog"
      class="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4"
    >
      鉴定古董
    </el-button>
    <p class="mt-4 text-gray-600">鉴定需要消耗 unidentifiedCurio</p>

    <!-- 鉴定动画 -->
    <div v-if="loading" class="mt-8">
      <el-progress type="circle" :percentage="0" status="success" class="mx-auto" />
      <p class="mt-4 text-gray-600">正在鉴定中...</p>
    </div>

    <!-- 鉴定结果 -->
    <div v-if="lastIdentifiedResults" class="mt-8 p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h3 class="text-xl font-bold mb-4 text-gray-800">鉴定结果</h3>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(result, index) in lastIdentifiedResults"
          :key="index"
          class="p-4 border rounded-lg"
          :class="result.type === 'curio' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'"
        >
          <div v-if="result.type === 'curio'" class="text-center">
            <h4 class="font-semibold text-lg mb-2">{{ result.data.name }}</h4>
            <p class="text-sm text-gray-600 mb-2">{{ result.data.description }}</p>
            <p class="text-sm mb-1"><strong>稀有度:</strong> {{ result.data.rarity }}</p>
            <p class="text-sm"><strong>标签:</strong> {{ result.data.lore_tag }}</p>
            <el-tag type="warning" size="small" class="mt-2">古董</el-tag>
          </div>
          <div v-else class="text-center">
            <h4 class="font-semibold text-lg mb-2">{{ result.data.id }}</h4>
            <p class="text-sm text-gray-600 mb-2">获得 {{ result.data.count }} 个</p>
            <el-tag type="success" size="small">普通物品</el-tag>
          </div>
        </div>
      </div>
      <el-button @click="closeResult" class="mt-4">关闭</el-button>
    </div>

    <!-- 鉴定弹窗 -->
    <el-dialog v-model="identifyDialogVisible" title="鉴定古董" width="400px" :close-on-click-modal="false">
      <div class="text-center">
        <p class="mb-4">选择鉴定数量 (1-10)</p>
        <el-input-number
          v-model="selectedCount"
          :min="1"
          :max="10"
          class="mb-4"
        />
        <p class="text-sm text-gray-600">需要消耗 {{ selectedCount }} 个 unidentifiedCurio</p>
        <p class="text-sm text-gray-600">当前拥有: {{ unidentifiedCurioCount }} 个</p>
        <div v-if="unidentifiedCurioCount < selectedCount" class="text-red-600 mt-2">
          道具不足，无法鉴定
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="identifyDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :disabled="unidentifiedCurioCount < selectedCount"
            :loading="loading"
            @click="confirmIdentify"
          >
            确认鉴定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CurioIdentifyResult } from '~/shared/types/curio';

interface Props {
  loading: boolean;
  error: string | null;
  unidentifiedCurioCount: number;
  lastIdentifiedResults: CurioIdentifyResult[] | null;
  identifyCurio: (count: number) => Promise<void>;
  clearLastIdentifiedResults: () => void;
}

const props = defineProps<Props>();

const identifyDialogVisible = ref(false);
const selectedCount = ref(1);

function openIdentifyDialog() {
  identifyDialogVisible.value = true;
}

async function confirmIdentify() {
  await props.identifyCurio(selectedCount.value);
  identifyDialogVisible.value = false;
}

function closeResult() {
  props.clearLastIdentifiedResults();
}
</script>