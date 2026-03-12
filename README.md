# HTML Preview Deployer

一个基于 Next.js 的 HTML 预览与部署工具。支持上传 HTML 文件、直接粘贴或编写 HTML 代码，并将页面内容发布到 Supabase Storage，生成可访问链接和二维码。

## 本地启动

首次拉取代码后执行：

```bash
npm install
```

拉取云端环境变量后启动开发环境：

```bash
npm run dev
```

打开 http://localhost:3000 查看页面。

## 必要环境变量

当前项目后端依赖以下两个变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

建议不要手动散落维护，统一以 Vercel 为环境变量来源，本地通过 `vercel env pull` 同步到 `.env.local`。

## Vercel 与 Supabase 同步流程

这个仓库不要求额外安装 VS Code 插件。使用 `npx` 就可以直接调用 CLI。

### 1. 绑定本地目录到你的 Vercel 项目

```bash
npm run vercel:link
```

执行时会提示你登录 Vercel，并选择当前目录对应的项目。完成后会生成 `.vercel/project.json`，该文件已被忽略，不会提交到 Git。

### 2. 把 Vercel 环境变量拉到本地

```bash
npm run vercel:env:pull
```

这一步会把 Vercel 上配置的变量写入 `.env.local`。如果你的 Vercel 项目里已经配置了 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，本地开发和构建就能直接使用。

### 3. 登录并绑定 Supabase 项目

```bash
npm run supabase:login
npm run supabase:link
```

`supabase link` 会要求输入 project ref。可以在 Supabase 项目设置页面找到。

### 4. 把仓库里的数据库结构同步到 Supabase

```bash
npm run supabase:db:push
```

这个仓库当前包含一份迁移文件，用来创建：

- `deployments` 表
- `deployments` storage bucket
- 对应的 RLS / storage policies

迁移文件位置：`supabase/migrations/20240129000000_init_schema.sql`

## 推荐的日常更新顺序

每次你从 GitHub 拉到新代码，或者准备发布前，按这个顺序处理：

```bash
npm install
npm run vercel:env:pull
npm run supabase:db:push
npm run dev
```

如果你更新了 Vercel 环境变量，重新执行 `npm run vercel:env:pull` 即可。

如果你新增了 Supabase migration，执行 `npm run supabase:db:push` 即可把数据库结构同步到云端。

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm run vercel:link
npm run vercel:env:pull
npm run supabase:login
npm run supabase:link
npm run supabase:db:push
```
