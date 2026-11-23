// 用于自动生成 utils/assetsResource.ts 文件

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.resolve(__dirname, '../assets/icons');
const outputFile = path.resolve(__dirname, '../utils/assetsResource.ts');

const files = fs.readdirSync(iconsDir).filter(f => /\.(png|jpg|jpeg|svg|gif)$/.test(f));

const importLines = [];
const iconMapLines = [];

files.forEach(file => {
  const baseName = file.replace(/\.[^/.]+$/, ''); // 去掉扩展名
  // 变量名合法化
  const varName = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
  importLines.push(`import ${varName} from '~/assets/icons/${file}'`);
  iconMapLines.push(`        '${baseName}': ${varName},`);
});

const content = `// 由 scripts/genAssetsResource.js 自动生成，请勿手动修改
${importLines.join('\n')}

export const assetsResource: any = {
    icon: {
${iconMapLines.join('\n')}
    }
} as const

export const getIconPath = (icon: string): string => {
    return assetsResource.icon[icon]
}
`;

fs.writeFileSync(outputFile, content, 'utf8');
console.log('assetsResource.ts 已生成');