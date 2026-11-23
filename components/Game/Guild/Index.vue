<template>
    <el-card body-class="p-3! md:p-4!">
        <h2 class="text-2xl font-bold mb-4">{{ titleName }}</h2>

        <!-- <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            喵！欢迎来到猫猫公会之家。这里是小猫咪们团结协作、共同成长的温馨角落。加入公会后，可以和伙伴们一起完成任务、参与活动，还能享受专属的公会福利喵！

            <div class="mt-4">
                <el-text size="small">
                    公会可以选择一个专精方向，比如采集、制造、战斗等。选择后，公会内专精职业的小猫咪们在相关活动中会获得额外加成，让大家在喜欢的领域更加出色！快和你的猫猫伙伴们一起打造属于你们的强力公会吧 (=^･ω･^)ﾉ
                </el-text>
            </div>
        </div> -->

        <GameGuildPanel></GameGuildPanel>
    </el-card>
</template>

<script setup lang="tsx">
import { useMyGuild } from '~/composables/game/useMyGuild';

let myGuild = useMyGuild()

myGuild.value?.name

const titleName = computed(() => {
    return myGuild.value?.name || '猫猫公会'
})

</script>