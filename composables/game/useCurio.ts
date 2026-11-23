// composables/game/useCurio.ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { CurioItem, CurioItemWithOwner, CurioIdentifyResult } from '~/shared/types/curio';
import {
  emitCurioIdentify,
  onCurioIdentifySuccess,
  onCurioIdentifyError,
  emitCurioQuery,
  onCurioQuerySuccess,
  onCurioQueryError,
  emitCurioGetTags,
  onCurioGetTagsSuccess,
  onCurioGetTagsError,
  emitCurioQueryByTag,
  onCurioQueryByTagSuccess,
  onCurioQueryByTagError,
  emitCurioMuseum,
  onCurioMuseumSuccess,
  onCurioMuseumError,
} from '~/api/game/socket/curio';

export function useCurio() {
  const curios = ref<CurioItem[]>([]);
  const museumCurios = ref<CurioItemWithOwner[]>([]);
  const tags = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastIdentifiedResults = ref<CurioIdentifyResult[] | null>(null);

  const total = ref(0);
  const museumTotal = ref(0);
  const currentPage = ref(1);
  const museumCurrentPage = ref(1);
  const pageSize = ref(10);

  const hasMore = computed(() => curios.value.length < total.value);
  const museumHasMore = computed(() => museumCurios.value.length < museumTotal.value);

  // 监听器清理函数
  let offIdentifySuccess: (() => void) | null = null;
  let offIdentifyError: (() => void) | null = null;
  let offQuerySuccess: (() => void) | null = null;
  let offQueryError: (() => void) | null = null;
  let offGetTagsSuccess: (() => void) | null = null;
  let offGetTagsError: (() => void) | null = null;
  let offQueryByTagSuccess: (() => void) | null = null;
  let offQueryByTagError: (() => void) | null = null;
  let offMuseumSuccess: (() => void) | null = null;
  let offMuseumError: (() => void) | null = null;

  function setupListeners() {
    offIdentifySuccess = onCurioIdentifySuccess(({ results }) => {
      // 添加新鉴定的古董到列表
      const newCurios = results.filter(r => r.type === 'curio').map(r => r.data as CurioItem);
      curios.value.unshift(...newCurios);
      lastIdentifiedResults.value = results;
      loading.value = false;
    });

    offIdentifyError = onCurioIdentifyError(({ message }) => {
      error.value = message;
      loading.value = false;
    });

    offQuerySuccess = onCurioQuerySuccess(({ curios: newCurios, total: newTotal }) => {
      if (currentPage.value === 1) {
        curios.value = newCurios;
      } else {
        curios.value.push(...newCurios);
      }
      total.value = newTotal;
      loading.value = false;
    });

    offQueryError = onCurioQueryError(({ message }) => {
      error.value = message;
      loading.value = false;
    });

    offGetTagsSuccess = onCurioGetTagsSuccess(({ tags: newTags }) => {
      tags.value = newTags;
      loading.value = false;
    });

    offGetTagsError = onCurioGetTagsError(({ message }) => {
      error.value = message;
      loading.value = false;
    });

    offQueryByTagSuccess = onCurioQueryByTagSuccess(({ curios: newCurios, total: newTotal }) => {
      if (currentPage.value === 1) {
        curios.value = newCurios;
      } else {
        curios.value.push(...newCurios);
      }
      total.value = newTotal;
      loading.value = false;
    });

    offQueryByTagError = onCurioQueryByTagError(({ message }) => {
      error.value = message;
      loading.value = false;
    });

    offMuseumSuccess = onCurioMuseumSuccess(({ curios: newCurios, total: newTotal }) => {
      if (museumCurrentPage.value === 1) {
        museumCurios.value = newCurios;
      } else {
        museumCurios.value.push(...newCurios);
      }
      museumTotal.value = newTotal;
      loading.value = false;
    });

    offMuseumError = onCurioMuseumError(({ message }) => {
      error.value = message;
      loading.value = false;
    });
  }

  function cleanupListeners() {
    offIdentifySuccess?.();
    offIdentifyError?.();
    offQuerySuccess?.();
    offQueryError?.();
    offGetTagsSuccess?.();
    offGetTagsError?.();
    offQueryByTagSuccess?.();
    offQueryByTagError?.();
    offMuseumSuccess?.();
    offMuseumError?.();
  }

  async function identifyCurio(count: number): Promise<void> {
    loading.value = true;
    error.value = null;
    emitCurioIdentify(count);
  }

  async function loadCurios(page: number = 1): Promise<void> {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    emitCurioQuery({ page, limit: pageSize.value });
  }

  async function loadTags(): Promise<void> {
    loading.value = true;
    error.value = null;
    emitCurioGetTags();
  }

  async function loadCuriosByTag(tag: string, page: number = 1): Promise<void> {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    emitCurioQueryByTag({ tag, page, limit: pageSize.value });
  }

  async function loadMuseumCurios(page: number = 1): Promise<void> {
    loading.value = true;
    error.value = null;
    museumCurrentPage.value = page;
    emitCurioMuseum({ page, limit: pageSize.value });
  }

  function clearLastIdentifiedResults() {
    lastIdentifiedResults.value = null;
  }

  onMounted(() => {
    setupListeners();
  });

  onUnmounted(() => {
    cleanupListeners();
  });

  return {
    curios,
    museumCurios,
    tags,
    loading,
    error,
    total,
    museumTotal,
    currentPage,
    museumCurrentPage,
    pageSize,
    hasMore,
    museumHasMore,
    lastIdentifiedResults,
    identifyCurio,
    loadCurios,
    loadTags,
    loadCuriosByTag,
    loadMuseumCurios,
    clearLastIdentifiedResults,
  };
}