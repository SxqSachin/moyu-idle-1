<template>
    <div class="flex flex-col items-center justify-center player-avatar relative">
        <template v-if="avatarBorder">
            <el-avatar :src="avatarUrl" :size="avatarSize * avatarBorderScale.avatar" class="game-avatar" />
            <template v-if="isBorderVideo">
                <video
                    :src="avatarBorder"
                    class="game-avatar-border rounded-none!"
                    :style="borderVideoStyle"
                    autoplay
                    loop
                    muted
                    playsinline
                    preload="auto"
                    disablepictureinpicture
                    controlslist="nodownload noplaybackrate nofullscreen"
                ></video>
            </template>
            <template v-else>
                <el-avatar :src="avatarBorder" :size="avatarSize * avatarBorderScale.border" class="game-avatar-border rounded-none!" :style="borderStyle" />
            </template>
        </template>
        <template v-else>
            <el-avatar :src="avatarUrl" :size="avatarSize" class="game-avatar" />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { allAvatarBorder } from "~/shared/data/allStyle";
import { resolveAvatarUrl } from '~/utils/avatar';

const props = defineProps<{
    avatar: string,
    size?: number
    border?: keyof typeof allAvatarBorder
}>()

const avatarSize = computed(() => {
    return props.size ?? 42
})

const avatarBorder = computed(() => {
    if (props.border && props.border in allAvatarBorder) {
        return avatarBorderMap[props.border];
    }
    return "";
})

const isBorderVideo = computed(() => {
    if (!props.border) {
        return false;
    }

    const conf = allAvatarBorder[props.border];

    return conf.isAnim || (typeof avatarBorder.value === 'string' && avatarBorder.value.toLowerCase().endsWith('.webm'))
})

const avatarBorderScale = computed(() => {
    if (!props.border || !avatarBorder.value) {
        return {
            avatar: 1,
            border: 1,
        }
    }

    const conf = allAvatarBorder[props.border];

    return {
        avatar: conf.avatarScale ?? 1,
        border: conf.borderScale ?? 1,
    }
})

const avatarBorderOffset = computed(() => {
    if (!props.border || !avatarBorder.value) {
        return 0;
    }

    const conf = allAvatarBorder[props.border];

    // @ts-ignore
    if (!conf.offset) {
        return {
            x: 0,
            y: 0,
        } 
    }

    return {
        // @ts-ignore
        x: conf.offset.x ?? 0, y: conf.offset.y ?? 0,
    };
})

const borderStyle = computed(() => {
    if (!props.border || !avatarBorder.value) return {};
    const offset = typeof avatarBorderOffset.value === 'number' ? { x: 0, y: 0 } : avatarBorderOffset.value;
    return {
        position: 'absolute',
        zIndex: '1',
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        width: `${avatarSize.value * avatarBorderScale.value.border}px`,
        height: `${avatarSize.value * avatarBorderScale.value.border}px`,
        objectFit: 'contain',
        pointerEvents: 'none',
    } as Record<string, string>;
})

const borderVideoStyle = computed(() => {
    if (!props.border || !avatarBorder.value) return {};
    const offset = typeof avatarBorderOffset.value === 'number' ? { x: 0, y: 0 } : avatarBorderOffset.value;
    return {
        position: 'absolute',
        zIndex: '1',
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${avatarBorderScale.value.border})`,
        width: `${avatarSize.value}px`,
        height: `${avatarSize.value}px`,
        objectFit: 'contain',
        pointerEvents: 'none',
    } as Record<string, string>;
})

const avatarUrl = computed(() => {
    return resolveAvatarUrl(props.avatar);
});
</script>
<style lang="scss" scoped>
.game-avatar {
    background: transparent;
}
.game-avatar-border {
    background: transparent;

    overflow: visible;

    :deep(img) {
        overflow: visible !important;
    }
}
</style>