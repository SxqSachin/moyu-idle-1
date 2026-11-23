<template>
    <el-card body-class="p-3! md:p-4!">
        <h2 class="text-2xl font-bold mb-4">商业街</h2>

        <div class="text-gray-600 dark:text-gray-400 mb-4 text-sm">
        </div>

        <el-tabs v-model="activeTab">
            <el-tab-pane label="商业街" name="publicShops">
                <PublicShopsPanel :shops="publicShops?.shops || []"
                    :total="publicShops?.total || 0" :page="publicPage" :page-size="publicPageSize"
                    :default-search="publicSearch" :default-resource-id="publicResourceId"
                    @open="openDetail"
                    @search="onPublicSearch" @filter="onFilter" @page="onPublicPageChange" />
            </el-tab-pane>

            <el-tab-pane label="我的店铺" name="myShops" :lazy="true">
                <MyShopsPanel @open="openDetail" @renew="onRenew" @remove="removeItem" />
            </el-tab-pane>
        </el-tabs>
    </el-card>


</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { usePlayerShop } from "~/composables/game/usePlayerShop";
import MyShopsPanel from "./MyShopsPanel.vue"
import PublicShopsPanel from "./PublicShopsPanel.vue"

const activeTab = ref("publicShops");

const {
    fetchMyShops,
    openShop,
    renewShop,
    removeItem,
    publicShops,
    fetchPublicShops,
    resetPublicShopSeed,
} = usePlayerShop();

const showExpired = ref(false);
const publicSearch = ref("");
const publicPage = ref(1);
const publicPageSize = ref(20);
const publicResourceId = ref<AllGameResourceID | undefined>(undefined);
const onRenew = (uuid: string) => renew(uuid, 7)

function openDetail(shopUuid: string) {
    openShop(shopUuid);
}
function renew(shopUuid: string, days: number) {
    renewShop(shopUuid, days);
}

function reloadMyShops() { fetchMyShops({ includeExpired: showExpired.value }); }
function reloadPublic() { fetchPublicShops({ page: publicPage.value, pageSize: publicPageSize.value, search: publicSearch.value || undefined, resourceId: publicResourceId.value }); }
function onPublicPageChange(p: number) { publicPage.value = p; reloadPublic(); }
function onPublicSearch(kw: string) { publicSearch.value = kw || ""; publicPage.value = 1; reloadPublic(); }
function onFilter(payload: { resourceId?: AllGameResourceID; keywords?: string }) {
    publicSearch.value = payload.keywords || "";
    publicResourceId.value = payload.resourceId;
    publicPage.value = 1;
    reloadPublic();
}

onMounted(() => {
    reloadMyShops();
    // 每次打开“商业街”视图时重置随机种子，确保每次打开都有新的随机顺序
    resetPublicShopSeed();
    reloadPublic();
});
</script>
