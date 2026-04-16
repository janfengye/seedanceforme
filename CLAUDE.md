# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Seedance 2.0 Web 是一个 React + TypeScript 前端、Express + SQLite 后端的 AI 视频生成应用。本地代码已经不再是早期单页面 + 单 SessionID 的形态，而是包含：

- 用户注册 / 登录 / 登出 / 改密 / 积分
- 左侧导航 + 多页面路由
- 项目 / 任务 / 批量管理
- 下载管理
- 管理员后台
- 多即梦 Session 账号管理
- 严格的用户归属隔离（ownership）

当前文档必须以本地代码为准，不要再沿用旧 GitHub 时代的描述。

## 当前实现与旧文档的关键差异

以下几点是最容易写错的地方：

1. 类型入口已经是 `src/types/index.ts`，不是 `src/types.ts`
2. 平台登录会话存于 localStorage 键 `seedance_session_id`
3. 用户缓存键为 `seedance_user_cache`
4. 前端鉴权头使用 `X-Session-ID`
5. 项目 / 任务 / 批量 / 下载已按用户归属隔离，普通用户不能查看或操作其他用户的数据
6. 任务模型已扩展为 `draft -> output*` 双层结构，而不是旧版单层任务
7. 即梦 Session 已演进为”每用户多账号”模型，解析优先级为 `user_default > legacy_global > env_default > none`
8. 浏览器下载本地视频走 token 链路，不是直接暴露本地文件路径
9. `AppProvider` 会随 `currentUser` 变化清空并重载项目、任务、设置状态
10. 当前支持 4 个模型，VIP 模型使用 `draft version 3.3.12`，普通模型使用 `3.3.9`

## 模型配置

当前项目支持 4 个即梦 Seedance 2.0 模型，配置位于 `server/services/videoGenerator.js`：

| 前端 modelKey | model_req_key | benefit_type | draft version | 说明 |
|---|---|---|---|---|
| `seedance-2.0` | `dreamina_seedance_40_pro` | `dreamina_video_seedance_20_pro` | `3.3.9` | 全能模型（普通） |
| `seedance-2.0-vip` | `dreamina_seedance_40_pro_vision` | `seedance_20_pro_720p_output` | `3.3.12` | 全能模型（VIP 720p） |
| `seedance-2.0-fast` | `dreamina_seedance_40` | `dreamina_seedance_20_fast` | `3.3.9` | 快速模型（普通） |
| `seedance-2.0-fast-vip` | `dreamina_seedance_40_vision` | `seedance_20_fast_720p_output` | `3.3.12` | 快速模型（VIP 720p） |

VIP 模型（`seedance-2.0-vip`、`seedance-2.0-fast-vip`）与普通模型的请求差异：
- `sceneOptions` 额外包含 `resolution: “720p”` 和 `inputVideoDuration: 0`
- `extraVipFunctionKey` 格式为 `{modelId}-720p`（普通模型为 `{modelId}`）
- 生成 URL 额外包含 `commerce_with_input_video=1` 参数
- `extend` 额外包含 `workspace_id: 0`
- `draft_content` 的 `min_version` / `version` 使用 `3.3.12`（普通模型为 `3.3.9`）

前端模型定义位于 `src/types/index.ts` 的 `ModelId` 类型和 `MODEL_OPTIONS` 数组。

## 常用命令

```bash
# 安装前后端依赖
npm run install:all

# 同时启动前端 :5173 与后端 :3001
npm run dev

# 单独启动前端 / 后端
npm run dev:client
npm run dev:server

# 前端类型检查
npx tsc --noEmit

# 前端构建
npm run build

# 生产启动
npm start
```

当前仓库未配置测试框架和 linter。

## 前端结构

```text
src/
├── main.tsx
├── App.tsx
├── index.css
├── types/
│   └── index.ts
├── context/
│   └── AppContext.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── VideoPlayer.tsx
│   └── Icons.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── SingleTaskPage.tsx
│   ├── BatchManagement.tsx
│   ├── DownloadManagement.tsx
│   ├── Settings.tsx
│   └── AdminPage.tsx
└── services/
    ├── authService.ts
    ├── videoService.ts
    ├── projectService.ts
    ├── taskService.ts
    ├── batchService.ts
    ├── downloadService.ts
    └── settingsService.ts
```

### 路由真值

`src/App.tsx` 当前路由：

- `/login`
- `/register`
- `/`
- `/batch`
- `/download`
- `/settings`
- `/admin`
- `* -> /`

`/admin` 仅管理员可访问；未登录用户会被 `ProtectedRoute` 重定向到 `/login`。

### 认证与前端状态

前端存在两套不同语义的会话：

1. **平台登录会话**
   - localStorage: `seedance_session_id`
   - 用户缓存: `seedance_user_cache`
   - 请求头: `X-Session-ID`
   - 来源：`src/services/authService.ts`

2. **即梦 Session 账号**
   - 存储在数据库表 `jimeng_session_accounts`
   - 通过设置页管理
   - 用于后端访问即梦平台

`src/context/AppContext.tsx` 已实现登录态切换时的状态清理：

- 无用户时清空 `projects`
- 清空 `currentProject`
- 清空 `tasks`
- 清空 `currentTask`
- 清空 `error`
- 结束 `loading`
- 将 `settings` 重置为 `{}`

因此修改认证、退出登录、切换用户相关逻辑时，要同时检查：

- `src/App.tsx`
- `src/context/AppContext.tsx`
- `src/services/authService.ts`

## 后端结构

```text
server/
├── index.js
├── browser-service.js
├── database/
│   ├── index.js
│   └── schema.sql
└── services/
    ├── authService.js
    ├── projectService.js
    ├── taskService.js
    ├── settingsService.js
    ├── jimengSessionService.js
    ├── batchScheduler.js
    ├── videoDownloader.js
    └── videoGenerator.js
```

## 权限与 ownership 规则

当前本地实现不是“大家都能看到所有项目”。正确规则是：

- 管理员可查看全量项目、任务、批量和下载记录
- 普通用户只能查看自己的项目、任务、批量和下载记录
- 删除、更新、批量启动、批量详情查询都必须沿着归属链路校验

排查 ownership 问题时优先看：

- `server/services/projectService.js`
- `server/services/taskService.js`
- `server/services/batchScheduler.js`
- `src/services/projectService.ts`
- `src/services/batchService.ts`
- `src/services/downloadService.ts`

## 任务模型

当前任务不是旧版单层任务，而是：

- `draft`：草稿任务，承载 prompt / 素材 / 行号 / 计划输出数
- `output`：从 draft 展开的实际生成任务

关键字段位于 `src/types/index.ts` 与 `server/database/schema.sql`：

- `task_kind`
- `source_task_id`
- `row_group_id`
- `row_index`
- `video_count`
- `output_index`

批量启动时，后端会校验任务是否：

- 属于当前项目
- 属于当前用户（普通用户场景）
- `task_kind === 'draft'`
- 有 prompt
- 至少有一张图片素材

视频生成请求的 draft content 版本号与模型绑定：
- 普通模型（`seedance-2.0`、`seedance-2.0-fast`）使用 `3.3.9`
- VIP 模型（`seedance-2.0-vip`、`seedance-2.0-fast-vip`）使用 `3.3.12`

该版本号同时应用于 `da_version` URL 参数和 `draft_content` 的 `min_version` / `version` 字段。

## 即梦 Session 账号模型

即梦 Session 已经从“单全局 SessionID”演进为“每用户多账号”。

相关表：

- `jimeng_session_accounts`
- `settings`（仅保留 legacy `session_id` 兼容项）

解析优先级固定为：

1. `user_default`
2. `legacy_global`
3. `env_default`
4. `none`

补充规则：

- 用户新增的第一个账号自动设为默认
- 删除默认账号后，系统会自动补一个新的默认账号
- 设置页上的 `session-accounts` 接口显式要求登录态

## 角色与权限体系

三级角色：`super_admin` > `admin` > `user`

| 角色 | 说明 | 判定方式 |
|------|------|----------|
| `super_admin` | 超级管理员，仅 admin@seedance.com（id=1） | `role = 'super_admin'` |
| `admin` | 管理员，由超级管理员提升 | `role = 'admin'` |
| `user` | 普通用户，通过邀请码注册 | `role = 'user'` |

- `requireAdmin` 中间件同时允许 `admin` 和 `super_admin`
- **所有 `role === 'admin'` 的判断必须同时兼容 `super_admin`**（常见遗漏点）
- 管理员共享超级管理员的即梦账号池（`getSessionAccountOwnerId` 辅助函数）
- 仅超级管理员可提升/降级其他用户角色

### 注册方式

- 注册只需：邀请码 + 用户名(2-10位中英文数字) + 密码
- 邀请链接格式：`/register?code=XXX`，用户点开后邀请码自动填入只读
- 无邀请码访问注册页显示提示"请通过管理员分享的邀请链接注册"
- 登录使用用户名 + 密码
- 用户表 email 字段设为 `{username}@local` 保持 schema 兼容

### 品牌

- 对外显示名称："我们的团队"（非 Seedance 2.0）
- 模型名称保持 Seedance 2.0/Fast/VIP 不变

## 即梦积分查询 API（已验证可用）

通过 jimeng-free-api 项目发现并验证的积分查询端点：

```
POST https://jimeng.jianying.com/commerce/v1/benefits/user_credit
```

### 认证方式

此 API **不走 a_bogus 签名**，也不走 browserService，而是使用独立的 MD5 签名方案：

```javascript
const sign = md5(`9e2c|${uri.slice(-7)}|${PLATFORM_CODE}|${VERSION_CODE}|${deviceTime}||11ac`);
// PLATFORM_CODE = '7', VERSION_CODE = '5.8.0'
```

必须的请求头（区别于视频生成 API）：
- `Sign`: MD5 签名
- `Sign-Ver`: `'1'`
- `Device-Time`: Unix 时间戳
- `Appid`: `'513695'`
- `Appvr`: `'5.8.0'`
- `Pf`: `'7'`
- 标准浏览器伪装头（User-Agent、Sec-Ch-Ua 等）

Cookie 格式同视频生成：`sessionid=xxx; sessionid_ss=xxx; sid_tt=xxx; uid_tt=xxx`

### 返回数据结构

```json
{
  "ret": "0",
  "data": {
    "credit": {
      "vip_credit": 15000,     // VIP 积分
      "gift_credit": 0,        // 赠送积分
      "purchase_credit": 0     // 购买积分
    },
    "credits_detail": {
      "vip_credits": [{
        "vip_level": "maestro",        // 会员等级
        "residual_credits": 15000,     // 剩余积分
        "credits_life_end": 1778886358 // 积分过期时间戳（即会员到期时间）
      }]
    }
  }
}
```

### 错误码

- `ret=0`: 成功
- `ret=1014`: 签名缺失或错误（system busy）
- `ret=1015`: SessionID 过期（check login error），但仍可能附带 credit 数据

### 关键发现

- `credits_life_end` 时间戳 = 会员到期时间（北京时间），可用于自动判断账号过期
- 无需手动设置过期日期，从 API 自动获取
- 此 API 不需要 Playwright/browserService，纯 HTTP 请求即可

## 下载链路

下载管理分成两类：

1. **服务器侧下载到本地目录**
   - `/api/download/tasks/:id`
   - `/api/download/batch`
   - `/api/download/refresh`
   - `/api/download/sync-from-jimeng`

2. **把服务器本地已保存的视频交给浏览器下载**
   - 先 `POST /api/download/tasks/:id/file-token`
   - 再访问 `GET /api/download/file-by-token?token=...`

前端实现位于 `src/services/downloadService.ts`。

写下载相关文档时，不要再写成“前端直接拿本地路径下载”。当前实现是一次性 token 下载链路。

## API 认证边界说明

以下描述以当前前端调用链为准：

### 明确要求登录的前端调用

- `projectService.ts` 全部项目接口
- `taskService.ts` 全部任务 / 素材 / 生成 / 下载 / 采集接口
- `batchService.ts` 全部批量接口
- `downloadService.ts` 全部下载管理接口
- `settingsService.ts` 的 `session-accounts` 相关接口
- `videoService.ts` 提交 `/api/generate-video`

### 需要谨慎描述的边界

- `settingsService.ts` 中 `getSettings()` / `updateSettings()` 当前前端调用未显式附 `getAuthHeaders()`；修改或写文档前应先核对后端真实要求，不要笼统写成“所有 settings 接口统一鉴权”
- `videoService.ts` 中轮询 `/api/task/:taskId` 当前前端调用未显式附 `X-Session-ID`；写文档时应表述为“当前前端提交生成请求走登录态，轮询接口按现有调用链单独说明”

## 数据库真值

优先以 `server/database/schema.sql` 为准。当前核心表包括：

- `users`
- `sessions`
- `check_ins`
- `email_verification_codes`
- `system_config`
- `projects`
- `tasks`
- `task_assets`
- `generation_history`
- `jimeng_session_accounts`
- `settings`
- `schedules`
- `batches`

其中最容易遗漏的是：

- `projects.user_id`
- `tasks.user_id`
- `jimeng_session_accounts`
- `system_config`
- `email_verification_codes` 的增强字段（`purpose` / `code_hash` / `salt` / `attempts` / `request_ip` / `consumed_at`）

## 开发注意事项

- 前端所有用户可见文案为中文
- 后端是纯 JavaScript ESM，`npx tsc --noEmit` 只检查前端 `src/`
- 生产模式由 Express 同时提供前端静态资源和 API
- Vite 开发环境通过 `/api -> :3001` 代理访问后端
- 首次开发需要 `npx playwright-core install chromium`
- 涉及权限、路由、状态切换时，优先核对源码，不要信任旧文档

## 修改文档时的建议顺序

如果后续继续更新文档，推荐按以下顺序核对：

1. `server/database/schema.sql`
2. `src/types/index.ts`
3. `src/App.tsx`
4. `src/context/AppContext.tsx`
5. `src/services/*.ts`
6. `server/services/*.js`
7. `README.md` / `doc/*.md`
