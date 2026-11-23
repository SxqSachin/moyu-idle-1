<template>
    <el-alert v-if="showAlert" title="" description="" :type="(type ?? 'warning')" @close="onClose" close-text="关闭">
        <template #title>
            <div>
                <span> {{ title }} </span>
                <el-button class="ml-4" @click="onClick">情况通报</el-button>
            </div>
        </template>
    </el-alert>
</template>

<script setup lang="ts">

const emit = defineEmits(["onClickDetailBtn"])

const props = defineProps<{
    notifyKey: string
    title: string
    type?: "success" | "warning" | "info" | "error"
}>()

const showAlert = ref(false)
onMounted(() => {
  $fetch("/api/game/tmp_notification/get_notification_info", {
    method: "POST",
    body: {
      notificationId: props.notifyKey
    }
  }).then(res => {
    showAlert.value = !res?.is_unread
  })
})
const onClose = () => {
  $fetch("/api/game/tmp_notification/mark_notification_as_read", {
    method: "POST",
    body: {
      notificationId: props.notifyKey,
    }
  })
}

const onClick = () => {
  emit("onClickDetailBtn")
}
</script>