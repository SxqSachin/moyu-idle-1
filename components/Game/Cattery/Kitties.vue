<template>
    <div class="text-gray-600 dark:text-gray-300 mb-6 text-sm">
        <div class="text-sm mt-4 text-gray-400">
            <!-- <div class="flex flex-col gap-1 text-sm">
                <div>ps:</div>
                <div>猫咪助手每次能安排3个待办工作</div>
                <div>猫咪助手不是万能的～（至少没办法替你完成锻炼和读书！）</div>
                <div>猫咪助手执行的动作，不会受到任何增益或减益的影响（比如不会受来自装备的效率提升影响）</div>
                <div>猫咪助手执行的动作无法为你完成任务，也不会给你提供任何经验奖励（资源奖励还是会上交☺️）</div>
                <div>猫咪助手进行工作时，不受工作的饱食度影响，每分钟会降低{{ KITTY_SATIETY_PER_SECOND * 60 }}饱食度(100饱食度可以工作{{ (100 /
                    (KITTY_SATIETY_PER_SECOND * 60 * 60)).toFixed(2) }}小时)。</div>
                <div>猫咪饱食度为0时，会立刻结束所有工作开始休息。</div>
                <div>喂食部分食物可以提升猫咪助手的饱食度上限。</div>
            </div> -->
        </div>
    </div>

    <template v-if="!kittyInfo.length">
        <div class="text-gray-500 mb-4">看起来你还没有招募小猫咪</div>
        <el-button type="primary" @click="dialogVisible = true">招募一个</el-button>
    </template>
    <template v-else-if="kittyInfo.length < maxKittyCount">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <template v-for="kitty in kittyInfo" :key="kitty.uuid">
                <GameCatteryItem :kitty="kitty"></GameCatteryItem>
            </template>
        </div>
        <div class="text-gray-500 my-4">你还可以招募{{maxKittyCount - kittyInfo.length}}只小猫咪</div>
        <el-button type="primary" @click="dialogVisible = true">招募一个</el-button>
    </template>
    <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <template v-for="kitty in kittyInfo" :key="kitty.uuid">
                <GameCatteryItem :kitty="kitty"></GameCatteryItem>
            </template>
        </div>
        <div class="mt-6">目前你只能招募{{maxKittyCount}}只小猫咪🐱，等待后续开放吧～</div>
    </template>
    <el-dialog v-model="dialogVisible" title="招募小猫咪" width="350px" center>
        <div class="flex flex-col gap-4">
            <el-input v-model="newKittyName" maxlength="10" show-word-limit placeholder="给你的猫咪起个名字吧" />
        </div>
        <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="loading" @click="hireKitty">确定招募</el-button>
        </template>
    </el-dialog>
</template>

<script lang="tsx" setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { onDispatchAllKittyInfo, emitGetAllKittyInfo, emitCreateKitty, onKittyUpdated } from '~/api/game/socket/kitty'
import { useKittyInfo } from '~/composables/game/useKittyInfo'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction, FuncReturnVoid } from '~/shared/types'
import { KITTY_SATIETY_PER_SECOND } from '~/shared/data/constant'
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo'

const kittyInfo = useKittyInfo()
const dialogVisible = ref(false)
const newKittyName = ref('')
const loading = ref(false)

const buildingInfo = useCharacterBuildingInfo()

let unbind: FuncReturnVoid;
let unbindUpdate: FuncAction

onMounted(async () => {
    await waitUtilConnected()

    emitGetAllKittyInfo()
    unbind = onDispatchAllKittyInfo(kittyList => {
        kittyInfo.value = kittyList
    })

    unbindUpdate = onKittyUpdated(kitty => {
        const index = kittyInfo.value.findIndex(k => k.uuid === kitty.uuid)
        if (index !== -1) {
            kittyInfo.value[index] = kitty
        }
    })
})

onUnmounted(() => {
    unbind!()
    unbindUpdate()
})

async function hireKitty(e: Event) {
    if (e.isTrusted === false) {
        return
    }

    if (!newKittyName.value.trim()) {
        ElMessage.warning('名字不能为空')
        return
    }
    loading.value = true
    try {
        emitCreateKitty(newKittyName.value)
        dialogVisible.value = false
        newKittyName.value = ''

    } catch (e) {
        ElMessage.error('招募失败')
    } finally {
        loading.value = false
    }
}

const maxKittyCount = computed(() => {
    let base = 0;

    if ((buildingInfo.value?.baseCattery?.level ?? 0) > 0) {
        base += 1
    }

    if ((buildingInfo.value?.baseCattery2?.level ?? 0) > 0) {
        base += 1
    }

    // if ((buildingInfo.value?.baseCattery3?.level ?? 0) > 0) {
    //     base += 1
    // }

    return base
});
</script>