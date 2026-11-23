<template>
    <div class="flex flex-row flex-wrap text-xs gap-2">
        <template v-for="tag in tags" :key="tag">
            <el-tag size="small" type="primary">{{ AllResourceAlchemyTag[tag].name }}</el-tag>
        </template>
    </div>
</template>

<script setup lang="tsx">
import { allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { AllResourceAlchemyTag } from '~/shared/types/gameAlchemy';
import type { AllGameResourceID } from '~/shared/types/gameResource';


const props = defineProps<{
    uuid: AllGameResourceID
}>();

const resource = computed(() => {
    return allGameResourceWithInternal[props.uuid];
});

const tags = computed(() => {
    return resource.value.alchemyTag || [];
});
</script>