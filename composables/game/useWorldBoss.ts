import { ref, onMounted, onUnmounted } from 'vue';
import { emitWorldBossListAvailable, onWorldBossListAvailableSuccess, onWorldBossListAvailableFail } from '~/api/game/socket/worldBoss';
import type { WorldBossConfigWithState } from '~/shared/types/worldBoss';

export function useWorldBoss() {
  const bossList = ref<WorldBossConfigWithState[]>([]);
  const loading = ref(false);

  let offOk: (() => void) | undefined;
  let offFail: (() => void) | undefined;

  function refresh() {
    loading.value = true;
    emitWorldBossListAvailable();
  }

  onMounted(() => {
    offOk = onWorldBossListAvailableSuccess((resp) => {
      bossList.value = resp.list || [];
      loading.value = false;
    });
    offFail = onWorldBossListAvailableFail((err) => {
      loading.value = false;
    });
    // initial load
    refresh();
  });

  onUnmounted(() => {
    offOk?.();
    offFail?.();
  });


  const availableBossList = computed(() => {
    const now = Date.now();
    return bossList.value.filter(boss => {
        if (boss.state === 'player_lose' || boss.state === 'player_win') {
            return false;
        }

        // if (boss.startAt) {
        //     const startAt = new Date(boss.startAt).getTime();
        //     if (now < startAt) {
        //         return false;
        //     }
        // }

        if (boss.endAt) {
            const endAt = new Date(boss.endAt).getTime();
            if (now > endAt) {
                return false;
            }
        }

        if ((boss.globalState?.currentHp ?? 0) <= 0) {
            return false;
        }

        return true;
    });

  })

  return {
    bossList,
    availableBossList,
    loading,
    refresh,
  };
}
