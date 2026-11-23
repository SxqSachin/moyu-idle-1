<template>
    <template v-if="fetched">
        <slot></slot>
    </template>
    <template v-else>
        <el-skeleton style="--el-skeleton-circle-size: 48px" animated>
            <template #template>
                <div class="flex flex-col gap-4">
                <template v-for="uuid in props.uuidList" :key="uuid">
                    <div class="flex flex-row">
                        <div>
                            <el-skeleton-item variant="circle" />
                        </div>
                        <div class="flex-1 ml-2 flex flex-col gap-2 py-2 justify-around">
                            <el-skeleton-item variant="text" style="width: 60%" />
                            <el-skeleton-item variant="text" style="width: 30%" />
                        </div>
                    </div>
                </template>
                </div>
            </template>
        </el-skeleton>
    </template>
</template>
<script lang="ts" setup>
import { useUserProfileInfo } from '~/composables/game/useUserProfileInfo';
import { allTitles } from '~/shared/data/allTitle';
import { clone } from '~/shared/utils';

const userProfiles = useUserProfileInfo()

const fetched = ref(false);

const props = defineProps<{
    uuidList: string[],
    listenChange?: boolean
}>()

onMounted(async () => {
    await fetch();
})

watch(() => props.uuidList, async (a, b) => {
    if (!props.listenChange) return;
    await fetch();
})

const fetch = async () => {
    fetched.value = false;

     if (props.uuidList.length) {
        let unfetchedUuidList = props.uuidList.filter(uuid => !userProfiles.value[uuid]);
        if (unfetchedUuidList.length) {
            unfetchedUuidList = [...new Set(unfetchedUuidList)];
            let res = await $fetch("/api/game/user/batch_profile", {
                method: "POST",
                body: {
                    uuidList: unfetchedUuidList
                }
            })
            if (res.code === 200 && 'data' in res) {
                Object.keys(res.data).forEach(uuid => {
                    userProfiles.value[uuid] = res.data[uuid];
                    userProfiles.value = clone(userProfiles.value)
                })
            }
        }
    }

    setTimeout(() => {
        fetched.value = true;
    }, 100); // 模拟加载时间
}

</script>