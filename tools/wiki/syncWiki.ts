import fs from 'fs';
import path from 'path';
import axios from 'axios';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

const CONFIG = {
  apiEndpoint: 'http://wiki.moyu-idle.com/api.php',
  username: '摸鱼',
  password: '220702yuki.',
  isInitialization: true, // 是否为初始化模式
  targetDirectory: '物品', // Wiki 中的目标目录
  folderToSync: path.resolve(__dirname, '../../wiki/resource'), // 要同步的文件夹路径
  onlyIndex: true, // 新增参数：只推送索引
};

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
 * 登录到 Wiki 并获取令牌
 */
async function loginToWiki() {
  // 获取登录令牌
  console.log('获取登录令牌...');
  const tokenResponse = await axios.get(CONFIG.apiEndpoint, {
    params: {
      action: 'query',
      meta: 'tokens',
      type: 'login',
      format: 'json',
    },
  });

  console.log('登录令牌响应:', tokenResponse.data);
  const loginToken = tokenResponse.data?.query?.tokens?.logintoken;
  const cookies = tokenResponse.headers['set-cookie'];

  if (!loginToken) {
    throw new Error('无法获取登录令牌');
  }

  // 执行登录
  console.log('执行登录...');
  const loginParams = {
    action: 'clientlogin',
    username: CONFIG.username,
    password: CONFIG.password,
    logintoken: loginToken,
    loginreturnurl: 'http://localhost', // 必须提供，但实际不会使用
    format: 'json',
  };
  console.log('登录参数:', loginParams);

  const loginResponse = await axios.post(CONFIG.apiEndpoint, new URLSearchParams(loginParams), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies?.join('; '),
    },
  });

  console.log('登录响应:', loginResponse.data);
  if (loginResponse.data?.clientlogin?.status !== 'PASS') {
    throw new Error('登录失败，请检查用户名和密码');
  }

  // 获取 CSRF 令牌
  console.log('获取 CSRF 令牌...');
  const csrfResponse = await axios.get(CONFIG.apiEndpoint, {
    params: {
      action: 'query',
      meta: 'tokens',
      format: 'json',
    },
    headers: {
      Cookie: loginResponse.headers['set-cookie'],
    },
  });

  console.log('CSRF 令牌响应:', csrfResponse.data);
  return {
    csrfToken: csrfResponse.data?.query?.tokens?.csrftoken,
    cookies: loginResponse.headers['set-cookie'],
  };
}

/**
 * 推送内容到 Wiki
 */
async function pushToWiki(title: string, content: string, csrfToken: string, cookies: string[] = []) {
  console.log(`开始推送: ${title}`);

  // 确保 cookies 数组被正确转换为字符串
  const cookieHeader = cookies?.join('; ') || '';

  const response = await axios.post(
    CONFIG.apiEndpoint,
    new URLSearchParams({
      action: 'edit',
      title,
      text: content,
      token: csrfToken,
      format: 'json',
    }),
    {
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (response.data?.edit?.result !== 'Success') {
    console.error(`推送失败: ${title}`, response.data);
  } else {
    console.log(`成功推送: ${title}`);
  }
}

/**
 * 生成索引内容
 */
function generateIndexContent(files: string[]): string {
  return files
    .map((file) => `* [[${CONFIG.targetDirectory}/${path.basename(file, '.md')}]]`)
    .join('\n');
}

/**
 * 提取技能名称作为标题
 */
function extractSkillName(content: string): string {
  const lines = content.split('\n');
  // 假设技能名称在 Markdown 文件的第一行，以 "# " 开头
  const titleLine = lines.find((line) => line.startsWith('# '));
  if (titleLine) {
    return titleLine.replace('# ', '').trim();
  }
  return '未命名技能';
}

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
 * 同步文件夹到 Wiki
 */

async function syncFolderToWiki(folderPath: string) {
  console.log(`开始同步文件夹: ${folderPath}`);
  const { csrfToken, cookies } = await loginToWiki();

  const files = fs.readdirSync(folderPath).filter((file) => file.endsWith('.md'));
  // 先收集所有条目名
  const allTitles: string[] = files.map((file) => {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseMarkdown(content);
    return metadata.title || extractSkillName(body);
  });

  if (CONFIG.onlyIndex) {
    // 只推送索引
    const indexContent = generateIndexContent(allTitles);
    console.log('仅推送索引条目...');
    await pushToWiki(CONFIG.targetDirectory, indexContent, csrfToken, cookies);
    console.log('索引推送完成！');
    return;
  }

  // 构建推送任务
  const tasks = files.map((file, index) => {
    return async () => {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { metadata, body } = parseMarkdown(content);
      const skillName = metadata.title || extractSkillName(body);
      const title = `${CONFIG.targetDirectory}/${skillName}`;

      console.log(`同步进度: ${index + 1}/${files.length} - ${title}`);

      if (!CONFIG.isInitialization) {
        // 检查条目是否存在
        const checkResponse = await axios.get(CONFIG.apiEndpoint, {
          params: {
            action: 'query',
            titles: title,
            format: 'json',
          },
        });

        const pages = checkResponse.data?.query?.pages;
        const pageExists = pages && Object.keys(pages).some((key) => key !== '-1');

        if (pageExists) {
          console.log(`跳过已存在条目: ${title}`);
          return;
        }
      }

      // 用 pandoc 转换 Markdown 为 WikiText
      const wikiText = markdownToWikiTextPandoc(body);

      await pushToWiki(title, wikiText, csrfToken, cookies);
    };
  });

  // 控制并发
  const CONCURRENCY = 64;
  let running = 0;
  let i = 0;
  await new Promise((resolve, reject) => {
    let finished = 0;
    function next() {
      if (finished >= tasks.length) return resolve(null);
      while (running < CONCURRENCY && i < tasks.length) {
        const task = tasks[i++];
        running++;
        task()
          .catch((e) => console.error('推送失败:', e))
          .finally(() => {
            running--;
            finished++;
            next();
          });
      }
    }
    next();
  });

  // 生成索引条目
  const indexContent = generateIndexContent(allTitles);
  console.log('生成索引条目...');
  await pushToWiki(CONFIG.targetDirectory, indexContent, csrfToken, cookies);
  console.log('同步完成！');
}

// 执行同步
syncFolderToWiki(CONFIG.folderToSync).catch((err) => console.error('同步失败:', err));