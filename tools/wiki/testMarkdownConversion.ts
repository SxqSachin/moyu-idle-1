import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 解析 Markdown 文件中的元数据和正文内容
 */
function parseMarkdown(content: string): { metadata: any; body: string } {
  const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (metadataMatch) {
    const metadata = yaml.load(metadataMatch[1]);
    const body = content.replace(metadataMatch[0], '').trim();
    return { metadata, body };
  }
  return { metadata: {}, body: content };
}

/**
 * 将 Markdown 转换为 WikiText（简单行级实现）
 */
function markdownToWikiText(md: string): string {
  const lines = md.split(/\r?\n/);
  let inCodeBlock = false;
  let codeLang = '';
  let result: string[] = [];

  for (let line of lines) {
    // 代码块开始
    const codeBlockStart = line.match(/^```(\w*)/);
    if (codeBlockStart) {
      inCodeBlock = true;
      codeLang = codeBlockStart[1] || '';
      result.push(`<syntaxhighlight lang="${codeLang}">`);
      continue;
    }
    // 代码块结束
    if (inCodeBlock && line.trim() === '```') {
      inCodeBlock = false;
      result.push('</syntaxhighlight>');
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      result.push(`${'='.repeat(level)} ${heading[2].trim()} ${'='.repeat(level)}`);
      continue;
    }
    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      result.push(`* ${line.replace(/^\s*[-*+]\s+/, '')}`);
      continue;
    }
    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      result.push(`# ${line.replace(/^\s*\d+\.\s+/, '')}`);
      continue;
    }
    // 其他直接输出
    result.push(line);
  }
  return result.join('\n');
}

/**
 * 测试 Markdown 转换为 WikiText
 */
function testMarkdownConversion(filePath: string) {
  console.log(`读取文件: ${filePath}`);
  let content = '';

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`无法读取文件: ${filePath}`, err);
    return;
  }

  // 解析元数据和正文内容
  let metadata, body;
  try {
    const parsed = parseMarkdown(content);
    metadata = parsed.metadata;
    body = parsed.body;
    console.log('元数据:', metadata);
  } catch (err) {
    console.error(`解析 Markdown 文件失败: ${filePath}`, err);
    return;
  }

  // 转换 Markdown 为 WikiText
  let wikiText = '';
  try {
    wikiText = markdownToWikiText(body);
    console.log('转换后的 WikiText:\n', wikiText);
  } catch (err) {
    console.error(`转换 Markdown 为 WikiText 失败: ${filePath}`, err);
  }
}

// 测试文件路径
const testFilePath = path.resolve(__dirname, '../wiki/skills/astralBlast.md');
testMarkdownConversion(testFilePath);