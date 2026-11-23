<template>
  <div v-if="kitties.length" class="">
    <div v-for="kitty in kitties" :key="kitty.uuid" class="mb-4">
      <GameKittyActionQueue 
      :kitty="kitty" 
      :taskQueue="allQueues[kitty.uuid] || []"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitGetKittyAllTask, } from '~/api/game/socket/kitty';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { useKittyInfo } from '~/composables/game/useKittyInfo'
import { useKittyTaskQueue } from '~/composables/game/useKittyTaskQueue';

const kitties = useKittyInfo()
const allQueues = useKittyTaskQueue()

onMounted(async () => {
  await waitUtilConnected();

  for (const kitty of kitties.value) {
    emitGetKittyAllTask(kitty.uuid)
  }
})

</script>

<style scoped>
.progress-bar-inner-text {
  bottom: 2px;
  font-size: 12px;
  left: 50%;
  transform: translateX(-50%);
  mix-blend-mode: difference;
  color: #9e9e9e;
}
</style>