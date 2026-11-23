# 摸鱼 Idle 1

项目源码采用 [PolyForm Noncommercial 1.0.0](LICENSE)，可用于非商业用途，并可在许可条款下修改和分发。第三方内容适用各自的许可。

本地启动前，请按 [.env.example](.env.example) 创建 `.env.development`，填写自己的数据库、会话密钥和所需服务配置。生产环境使用 `.env.production`。

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
