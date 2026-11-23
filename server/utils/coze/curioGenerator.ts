import { CozeAPI } from '@coze/api';
import { allCharacterStatus } from '~/shared/data/allCharacterStatus';
import { AllBaseCharacterStatusType, AllCharacterStatusType } from '~/shared/types/characterInfo';

const apiClient = new CozeAPI({
  token: process.env.COZE_API_TOKEN || "",
  baseURL: 'https://api.coze.cn'
});

type CozeCurioOutput = {
  description: string // "一块刻有猫爪印的神秘玉牌，据说持有它的猫咪能获得神秘力量。",
  lore_fragment_tag: string //  "神秘力量",
  name: string // "猫爪印玉牌",
  rarity: number // 3,
  status: AllBaseCharacterStatusType,
  status_val: number
}

export async function runCurioGenerator(lore?: string[]): Promise<CozeCurioOutput | null> {
    return null
    const res = await apiClient.workflows.runs.create({
        workflow_id: process.env.COZE_CURIO_WORKFLOW_ID || "",
        parameters: {
            "input": lore?.join(',') || ''
        },
    });

    const outputStr = res.data;

    try {
        const output = JSON.parse(outputStr);

        const result: CozeCurioOutput = JSON.parse(output.output);

        // 做严格成员验证
        if (!result.name || !result.description || !result.lore_fragment_tag || typeof result.rarity !== 'number' || !allCharacterStatus[result.status]) {
            throw new Error('Invalid GuDong output structure');
        }

        return result
    } catch (e) {
        console.error('Failed to parse GuDong output:', e);
        return null;
    }
}

// let output = await runCurioGenerator()
// console.log(output)
