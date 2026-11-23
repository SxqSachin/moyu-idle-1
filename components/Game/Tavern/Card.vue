<template>
  <div v-if="cat" class="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 gap-4">
    <div class="text-3xl mr-4" v-if="cat.icon">{{ cat.icon }}</div>
    <div class="flex-1">
      <div class="font-bold text-lg mb-1">{{ cat.name }}</div>
      <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">
        {{ cat.description }}
      </div>
      <div class="text-gray-500 dark:text-gray-400 text-xs mb-2">
        {{ cat.actionDesc }}
      </div>

      <template v-if="state == 'PAUSED'">
        <div v-if="disabled && expireTime" class="text-xs text-orange-600 mb-2">
          已暂停
        </div>
        <el-button size="small" type="warning" :disabled="!disabled" @click="$emit('resume', id)"
          v-if="state == 'PAUSED' && (!inited || disabled)">
          恢复
        </el-button>
      </template>

      <template v-else>
        <div v-if="disabled && expireTime && state == 'WORKING'" class="text-xs text-green-600 mb-2">
          已招募，剩余时间：{{ formatExpireTime(expireTime) }}
        </div>

        <el-button size="small" type="primary" :disabled="disabled" @click="$emit('hire', id)"
          v-if="!inited || !disabled">
          聘用
        </el-button>
        <el-button size="small" type="success" :disabled="!disabled" @click="$emit('renew', id)"
          v-if="state == 'WORKING' && (!inited || disabled)">
          续约
        </el-button>

        <el-button size="small" type="warning" :disabled="!disabled" @click="$emit('pause', id)"
          v-if="state == 'WORKING' && (!inited || disabled)">
          暂停
        </el-button>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import allTalentCat from "~/shared/data/allTalentCat";

const props = defineProps<{
  id: string,
  inited: boolean,
  disabled?: boolean,
  state?: string
  expireTime?: string | Date
}>();
defineEmits<{
  (e: 'hire', catId: string): void
  (e: 'renew', catId: string): void
  (e: 'pause', catId: string): void
  (e: 'resume', catId: string): void
}>();

const cat = computed(() => allTalentCat.find(c => c.id === props.id));

function formatExpireTime(expireTime: string | Date) {
  const end = typeof expireTime === "string" ? new Date(expireTime) : expireTime;
  const now = new Date();
  const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  if (diff <= 0) return "已到期";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}小时${m}分钟`;
}
</script>