# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Seedance 2.0 — 基于字节跳动即梦平台(jimeng.jianying.com)和 CapCut Dreamina(dreamina.capcut.com)的 AI 视频生成 Web 应用。
Fork 自 `wwwzhouhui/seedance2.0`，我们的仓库为 `dongbuyu2022/seedanceforme`（私有）。

- 前端：React 19 + TypeScript + Vite 6 + Tailwind CSS 3.4
- 后端：Express 4.21 + better-sqlite3 + Playwright-core（无头 Chromium 绕过反爬）
- 部署：Docker 自定义构建

## 基础设施

| 角色 | IP | SSH别名 | 说明 |
|------|-----|---------|------|
| 开发/管理机 | 70.39.198.233 | (本机) | 项目文档、代码修改、通过SSH管理部署服务器 |
| 部署服务器 | 38.165.45.152 | us-lax2 | Docker 运行 seedance，12C/16GB Ubuntu 24.04 |

## 部署信息

- 服务器项目路径：`/opt/seedanceforme`
- Docker 容器名：`seedance-web`
- 端口：`3001`（内部），Caddy 反向代理到 HTTPS
- **正式访问地址：`https://ourteam.queencloud.net/`**
- **⚠️ 禁止使用 `http://38.165.45.152:3001` 作为访问地址或提供给用户！该 IP 仅用于 SSH 管理。**
- 反向代理：Caddy（配置 `/etc/caddy/Caddyfile`），自动 HTTPS
- 默认管理员：`admin@seedance.com` / `admin123456`
- 数据持久化：`/opt/seedanceforme/data/seedance.db`（SQLite）
- 构建模式：自定义构建（`docker compose build` 从源码构建镜像）

## Git 仓库配置

```
origin   → https://github.com/dongbuyu2022/seedanceforme.git  (我们的)
upstream → https://github.com/wwwzhouhui/seedance2.0.git      (原作者)
```

同步上游更新：
```bash
ssh us-lax2 "cd /opt/seedanceforme && git fetch upstream && git merge upstream/main --no-edit && git push origin main"
```

## 常用操作命令

### 服务器操作（通过SSH执行）

```bash
# 查看容器状态和日志
ssh us-lax2 "docker ps | grep seedance"
ssh us-lax2 "docker logs seedance-web --tail 50"

# 重启
ssh us-lax2 "docker restart seedance-web"

# 代码修改后重新构建部署
ssh us-lax2 "cd /opt/seedanceforme && docker compose build && docker compose up -d --force-recreate"

# 备份数据库
ssh us-lax2 "cp /opt/seedanceforme/data/seedance.db /opt/seedanceforme/data/seedance.db.bak.\$(date +%Y%m%d)"
```

### 本地开发（在服务器上）

```bash
npm run install:all          # 安装前后端依赖
npm run dev                  # 同时启动前端:5173 + 后端:3001
npm run dev:client           # 仅前端
npm run dev:server           # 仅后端
npm run build                # 前端构建
npm start                    # 生产模式启动
npx tsc --noEmit             # 前端类型检查
```

无测试框架和 linter。

## 架构要点

### 核心流程

```
浏览器 → Express(:3001) → 上传图片到 ImageX CDN
                        → Playwright 无头浏览器注入 a_bogus 签名 → 提交生成任务到即梦API
                        → 前端每3秒轮询任务状态
                        → 视频代理流（绕过 CORS）→ 返回给浏览器
```

### 前端结构

- `src/App.tsx` — 路由：`/login`, `/register`, `/`, `/batch`, `/download`, `/settings`, `/admin`
- `src/context/AppContext.tsx` — 全局状态，用户切换时清空所有业务状态
- `src/types/index.ts` — 类型定义入口（不是 `src/types.ts`）
- `src/services/*.ts` — API 调用层，认证头使用 `X-Session-ID`
- localStorage 键：`seedance_session_id`（登录会话）、`seedance_user_cache`（用户缓存）

### 后端结构

- `server/index.js` — Express 入口，生产模式同时提供静态资源和 API
- `server/browser-service.js` — Playwright 浏览器代理服务
- `server/database/schema.sql` — 数据库 schema 真值来源
- `server/database/index.js` — 初始化+迁移（含 `shouldSkipMigration` 兼容逻辑）
- `server/services/videoGenerator.js` — 视频生成核心，含模型配置
- `server/services/jimengSessionService.js` — 多账号管理与轮询

### 任务模型（双层）

- `draft`：草稿任务，承载 prompt / 素材 / 计划输出数
- `output`：从 draft 展开的实际生成任务
- 关键字段：`task_kind`, `source_task_id`, `row_group_id`, `video_count`, `output_index`

### 即梦账号模型

已从单全局 SessionID 演进为"每用户多账号"，解析优先级：
`user_default > legacy_global > env_default > none`

- 单任务和批量任务共用轮询策略
- 失败自动 fallback 到下一个账号
- 按 SessionID 隔离浏览器会话、Cookie、webId、userId

### 角色与权限

三级角色体系：`super_admin` > `admin` > `user`
- `super_admin`：仅 admin@seedance.com，可管理角色（提升/降级其他用户为 admin）
- `admin`：管理员，共享 super_admin 的即梦账号池
- `user`：普通用户，通过邀请码注册
- `requireAdmin` 中间件同时允许 `super_admin` 和 `admin`
- **项目/集/镜头的增删改仅限管理员**（普通用户只能查看和关联）
- 普通用户只能操作自己的任务/批量/下载
- 删除、更新、批量启动都校验 ownership 链路

### 支持的模型

| 模型 | model_req_key | draft version |
|------|--------------|---------------|
| Seedance 2.0 | `dreamina_seedance_40_pro` | 3.3.9 |
| Seedance 2.0 VIP (720p) | `dreamina_seedance_40_pro_vision` | 3.3.12 |
| Seedance 2.0 Fast | `dreamina_seedance_40` | 3.3.9 |
| Seedance 2.0 Fast VIP (720p) | `dreamina_seedance_40_vision` | 3.3.12 |

支持国内版(jimeng)和国际版(CapCut Dreamina)双平台。

## 已知修复

### 数据库迁移 bug（已修复）

`20260326_update_email_verification_codes.sql` 原始迁移脚本在全新数据库上报错（先 UPDATE 不存在的列再 ALTER TABLE ADD）。
已在 `server/database/index.js` 的 `shouldSkipMigration` 中添加了对以下迁移的跳过逻辑：
- `20260326_update_email_verification_codes.sql`
- `20260326_add_system_config_table.sql`
- `001_add_batch_management_features.sql`

## 服务器端口分配

| 端口 | 服务 |
|------|------|
| 3001 | Seedance 2.0 |
| 8000 | grok2api（已有） |
| 8686 | gemini-api（已有） |

## 改造注意事项

- 后端是纯 JavaScript ESM（不是 TypeScript）
- `npx tsc --noEmit` 只检查前端 `src/`
- Docker 构建需下载 Chromium (~400MB)，首次较慢，镜像约 1.5-2GB
- 需要 `--shm-size=512mb`，否则 Chromium 崩溃
- Vite 开发环境通过 `/api -> :3001` 代理
- 前端所有用户可见文案为中文
- 修改认证/路由/状态相关逻辑时，同时检查 `App.tsx`、`AppContext.tsx`、`authService.ts`
