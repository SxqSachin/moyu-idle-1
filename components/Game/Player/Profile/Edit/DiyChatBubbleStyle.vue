<template>
    <div class="space-y-12">
        <div>
            <div class="flex flex-row items-center justify-start gap-2 mb-2">
                <h4 class="text-sm font-medium">对话气泡</h4>
                <el-tooltip placement="top">
                    <template #content>
                        <div>
                            <p>在这里选择对话气泡背景</p>
                        </div>
                    </template>
                    <el-icon class="cursor-pointer text-gray-400">
                        <Icon name="material-symbols:help" />
                    </el-icon>
                </el-tooltip>
                <el-select v-model="localBubbleId" placeholder="请选择" class="w-64!">
                    <el-option label="无" value=""></el-option>
                    <template v-for="available of userStyle.availableChatBubbleStyles">
                        <el-option :value="allChatBubbleStyle[available].value"
                            :label="allChatBubbleStyle[available].name" class="h-full!">
                            <div class="flex flex-col items-start mb-2">
                                <div>{{ allChatBubbleStyle[available].name }}</div>
                            </div>
                            <msg :msg='{
                                id: -1,
                                sender: user!.uuid,
                                sender_name: user!.name,
                                content: `大家好呀，我是${user!.name}!`,
                                created_At: now.toISOString(),
                                extra2: {
                                    bubble:
                                        allChatBubbleStyle[available].value
                                }
                            }'></msg>
                        </el-option>
                    </template>
                </el-select>
            </div>
        </div>


        <template v-if="canDiyBubbleStyle">
        <!-- 背景色渐变 -->
        <div v-if="!localBubbleId">
            <div class="flex flex-row items-center justify-start gap-2 mb-2">
                <h4 class="text-sm font-medium">背景色渐变</h4>
                <el-tooltip placement="top">
                    <template #content>
                        <div>
                            <p>最多允许设置7种背景色渐变</p>
                            <p>如果选择了非默认的气泡背景，则背景色渐变不会生效</p>
                        </div>
                    </template>
                    <el-icon class="cursor-pointer text-gray-400">
                        <Icon name="material-symbols:help" />
                    </el-icon>
                </el-tooltip>
                <el-button type="primary" size="small" @click="addBgColor"
                    :disabled="localStyle.bgColor.length >= MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT">添加颜色</el-button>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                <template v-for="(color, index) in localStyle.bgColor" :key="`bg-${index}`">
                    <el-color-picker v-model="localStyle.bgColor[index]" :predefine="predefineColors" size="large" />
                    <el-button v-if="localStyle.bgColor.length > 1" type="danger" size="small" round
                        class="p-1! w-6! h-6!" @click="removeBgColor(index)">
                        <el-icon>
                            <Icon name="material-symbols:delete-outline"></Icon>
                        </el-icon>
                    </el-button>
                </template>
            </div>
        </div>

        <!-- 文字色渐变 -->
        <div>
            <div class="flex flex-row items-center justify-start gap-2 mb-2">
                <h4 class="text-sm font-medium">文字色渐变</h4>
                <el-tooltip placement="top">
                    <template #content>
                        <div>
                            <p>最多允许设置7种文字色渐变</p>
                            <p>如果选择了非默认的“对话气泡”，则可能还需要同步添加“文字阴影”，以便使文字清晰展示</p>
                        </div>
                    </template>
                    <el-icon class="cursor-pointer text-gray-400">
                        <Icon name="material-symbols:help" />
                    </el-icon>
                </el-tooltip>
                <el-button type="primary" size="small" @click="addTextColor"
                    :disabled="localStyle.textColor.length >= MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT">添加颜色</el-button>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                <template v-for="(color, index) in localStyle.textColor" :key="`text-${index}`">
                    <el-color-picker v-model="localStyle.textColor[index]" :predefine="predefineColors" size="large" />
                    <el-button v-if="localStyle.textColor.length > 1" type="danger" size="small" round
                        class="p-1! w-6! h-6!" @click="removeTextColor(index)">
                        <el-icon>
                            <Icon name="material-symbols:delete-outline"></Icon>
                        </el-icon>
                    </el-button>
                </template>
            </div>
        </div>

        <!-- 文字阴影 -->
        <div>
            <div class="flex flex-row items-center justify-start gap-2 mb-2">
                <h4 class="text-sm font-medium">文字阴影</h4>
                <el-tooltip placement="top">
                    <template #content>
                        <div>
                            <p>最多允许设置2种文字阴影</p>
                        </div>
                    </template>
                    <el-icon class="cursor-pointer text-gray-400">
                        <Icon name="material-symbols:help" />
                    </el-icon>
                </el-tooltip>
                <el-button type="primary" size="small" @click="addTextShadow"
                    :disabled="localStyle.textShadow.length >= MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT">添加阴影</el-button>
            </div>
            <div class="flex flex-col gap-2 items-start">
                <template v-for="(shadow, index) in localStyle.textShadow" :key="`shadow-${index}`">
                    <div class="flex flex-wrap gap-2 items-center w-full">
                        <el-color-picker v-model="localStyle.textShadow[index].color" :predefine="predefineColors"
                            size="large" />
                        <el-slider v-model="localStyle.textShadow[index].blur" :min="1" :max="10" :step="1"
                            class="flex-1" :show-input="false" />
                        <el-button type="danger" size="small" @click="removeTextShadow(index)" round
                            class="p-1! w-6! h-6!">
                            <el-icon>
                                <Icon name="material-symbols:delete-outline"></Icon>
                            </el-icon>
                        </el-button>
                    </div>
                </template>
            </div>
        </div>
        </template>

        <!-- 预览 -->
        <div>
            <h4 class="text-sm font-medium mb-2">预览</h4>
            <div class="p-4 rounded-lg">
                <msg :msg='{
                    id: -1,
                    sender: user!.uuid,
                    sender_name: user!.name,
                    content: `大家好呀，我是${user!.name}!`,
                    created_At: now.toISOString(),
                    extra2: {
                        bubble: localBubbleId || undefined,
                        bubbleDiyStyle: localStyle
                    }
                }'></msg>
            </div>
        </div>

        <!-- 确定按钮 -->
        <div class="flex justify-end">
            <el-button type="primary" @click="confirm">确定</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import Msg from '~/components/Game/Chat/Msg.vue';
import { useUniqueFlag } from '~/composables/game/useUniqueFlag';
import { useUserStyle } from '~/composables/game/useUserStyle';
import { allChatBubbleStyle } from '~/shared/data/allStyle';
import { MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT, MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT, MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT } from '~/shared/data/constant'

const now = new Date();

const { user } = useUserSession();
const userStyle = useUserStyle();

const uniqueFlag = useUniqueFlag();

type BubbleStyle = {
    bgColor: string[];
    textColor: string[];
    textShadow: { color: string, blur: number }[];
}

interface Props {
    diyChatBubbleStyle?: BubbleStyle
    bubbleId?: (keyof typeof allChatBubbleStyle | "");
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'confirm': [value: BubbleStyle, bubbleId: keyof typeof allChatBubbleStyle | ""]
}>()// 本地状态，深拷贝避免直接修改 prop
const localStyle = ref<BubbleStyle>({
    bgColor: props.diyChatBubbleStyle?.bgColor ? [...props.diyChatBubbleStyle.bgColor] : ['#557dd4'],
    textColor: props.diyChatBubbleStyle?.textColor ? [...props.diyChatBubbleStyle.textColor] : ['#ffffff'],
    textShadow: props.diyChatBubbleStyle?.textShadow ? [...props.diyChatBubbleStyle.textShadow] : []
})

const localBubbleId = ref<keyof typeof allChatBubbleStyle | "">(props.bubbleId || "")

const canDiyBubbleStyle = computed(() => {
    return uniqueFlag.value.find(u => u.key == 'diy' && u.type == 'chatBubble');
})

// 预定义颜色
const predefineColors = [
    '#ff4500', '#ff6347', '#ffa500', '#ffd700', '#32cd32', '#00ced1', '#1e90ff', '#9370db', '#ff69b4', '#000000', '#ffffff'
]

// 添加背景色
function addBgColor() {
    if (localStyle.value.bgColor.length < MAX_DIY_CHAT_BUBBLE_BG_COLOR_COUNT) {
        localStyle.value.bgColor.push('#ffffff')
    }
}

// 删除背景色（至少保留一个）
function removeBgColor(index: number) {
    if (localStyle.value.bgColor.length > 1) {
        localStyle.value.bgColor.splice(index, 1)
    }
}

// 添加文字色
function addTextColor() {
    if (localStyle.value.textColor.length < MAX_DIY_CHAT_BUBBLE_TEXT_COLOR_COUNT) {
        localStyle.value.textColor.push('#000000')
    }
}

// 删除文字色（至少保留一个）
function removeTextColor(index: number) {
    if (localStyle.value.textColor.length > 1) {
        localStyle.value.textColor.splice(index, 1)
    }
}

// 添加文字阴影
function addTextShadow() {
    if (localStyle.value.textShadow.length < MAX_DIY_CHAT_BUBBLE_TEXT_SHADOW_COUNT) {
        localStyle.value.textShadow.push({ color: '#000000', blur: 1 })
    }
}

// 删除文字阴影
function removeTextShadow(index: number) {
    localStyle.value.textShadow.splice(index, 1)
}

// 确定并广播
function confirm() {
    emit('confirm', {
        bgColor: [...localStyle.value.bgColor],
        textColor: [...localStyle.value.textColor],
        textShadow: [...localStyle.value.textShadow]
    }, localBubbleId.value)
}
</script>