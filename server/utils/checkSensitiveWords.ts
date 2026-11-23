// 如果你已经用工具生成了 JSON，可以从这里直接引入
// 注意：TypeScript 的项目需要启用 `resolveJsonModule` 才能导入 json
import json from '@/assets/resource/sensitiveWords.json';

let sensitiveSet: Set<string> | null = null;

function normalizeWord(raw: string): string | null {
  if (!raw) return null;
  let w = raw.trim();
  if (!w) return null;
  // 忽略注释或元信息行
  if (w.startsWith('#') || w.startsWith('//')) return null;
  // 标准化：折叠连续空白并小写（ASCII 部分）
  w = w.replace(/\s+/g, ' ').toLowerCase();
  return w;
}

async function loadSensitiveWords(): Promise<Set<string>> {
  if (sensitiveSet) return sensitiveSet;
  const set = new Set<string>();

  // 仅使用预生成的 JSON 文件（必须存在且为字符串数组）
  if (Array.isArray(json) && json.length > 0) {
    for (const item of json) {
      if (typeof item !== 'string') continue;
      const n = normalizeWord(item);
      if (n) set.add(n);
    }
  } else {
    // 如果 JSON 不可用或为空，返回空集合（不尝试读取文本文件）
    // 这样可以避免在运行时访问大量文件并保证行为可控
    console.warn('sensitiveWords.json is empty or missing; sensitive set will be empty');
  }

  sensitiveSet = set;
  return set;
}

/**
 * 检查文本中是否包含敏感词。
 * @param text 任意文本
 * @returns true=有敏感词/不可发布，false=无敏感词/可发布
 */
export async function checkSensitiveWords(text: string): Promise<boolean> {
  const set = await loadSensitiveWords();
  if (!text) return false;
  // 标准化输入文本
  const normalized = text.replace(/\s+/g, ' ').toLowerCase();

  // 固定格式白名单：房间创建提示
  // 例："我创建了一个(xxxxxx)战斗房间" 或 "我创建了一个战斗房间：xxxx"
  const whitelistPatterns = [
    /我创建了一个“大麻烦”战斗房间：/i,
    /我创建了一个战斗房间：/i,
  ];
  for (const pat of whitelistPatterns) {
    if (pat.test(text)) {
      return false;
    }
  }
  for (const word of set) {
    if (!word) continue;
    if (normalized.includes(word)) {
      console.log('Detected sensitive word:', word);
      return true;
    }
  }
  return false;
}
