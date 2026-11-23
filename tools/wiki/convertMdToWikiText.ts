import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
 * 用 pandoc 将 Markdown 转换为 WikiText
 */
function markdownToWikiTextPandoc(md: string): string {
  fs.writeFileSync('temp_pandoc.md', md, 'utf-8');
  const wikitext = execSync('pandoc temp_pandoc.md -f markdown -t mediawiki', { encoding: 'utf-8' });
  fs.unlinkSync('temp_pandoc.md');
  return wikitext;
}

/**
 * 测试 Markdown 转换为 WikiText
 */
function testMarkdownToWikiText(filePath: string) {
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
    wikiText = markdownToWikiTextPandoc(body);
    console.log('转换后的 WikiText:\n', wikiText);
  } catch (err) {
    console.error(`pandoc 转换失败: ${filePath}`, err);
  }
}

// 测试文件路径
const testFilePath = path.resolve(__dirname, '../wiki/skills/astralBlast.md');
testMarkdownToWikiText(testFilePath);
