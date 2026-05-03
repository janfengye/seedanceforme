# 现有前端架构与 UI 模式分析

> 分析日期：2026-04-16
> 目的：为 v1.0.0 UI 详细设计提供基础参考

---

## 一、现有 UI 设计语言总结

### 1.1 配色方案

| 用途 | 色值 / Tailwind 类 | 说明 |
|------|-------------------|------|
| 页面背景 | `bg-[#0f111a]` | 深邃蓝黑 |
| 侧边栏/卡片背景 | `bg-[#1c1f2e]` | 略浅的蓝灰 |
| 输入框/嵌套背景 | `bg-[#0f111a]` 或 `bg-[#161824]` | 与页面背景同色或更深 |
| 主强调色 | `purple-500` / `purple-400` | 紫色系，用于选中态、主按钮、Logo 渐变 |
| 辅助强调色 | `indigo-600`、`pink-500` | 与 purple 搭配做渐变 |
| 文字主色 | `text-white` | 标题、主要内容 |
| 文字次色 | `text-gray-300` / `text-gray-400` | 标签、说明文字 |
| 文字弱色 | `text-gray-500` / `text-gray-600` | 占位符、辅助信息 |
| 成功色 | `green-500/20` + `text-green-400` | 状态标签、提示 |
| 警告色 | `amber-500/20` + `text-amber-400` / `yellow-500` | 管理员标签、警告提示 |
| 危险色 | `red-500/20` + `text-red-400` | 禁用状态、删除按钮 |
| 边框 | `border-gray-800` / `border-gray-700` | 卡片边框、分割线 |

**配色特点**：统一暗色主题（Dark Mode Only），紫色主调，半透明色块（`/10`、`/20`）做背景标签，整体视觉偏"赛博朋克"风。

### 1.2 布局模式

```
┌──────────────────────────────────────────────────┐
│  固定侧边栏 (w-60 / w-16 可折叠)                  │
│  ┌──────────────────────────────────────────────┐ │
│  │  Logo 区域 (h-16)                            │ │
│  ├──────────────────────────────────────────────┤ │
│  │  导航菜单 (nav)                              │ │
│  │  - 单任务生成 (/)                            │ │
│  │  - 批量管理 (/batch)                         │ │
│  │  - 下载管理 (/download)                      │ │
│  │  - 设置 (/settings)                          │ │
│  │  - 管理后台 (/admin) [仅管理员]               │ │
│  ├──────────────────────────────────────────────┤ │
│  │  用户信息 (absolute bottom)                   │ │
│  │  - 头像 + 邮箱 + 角色 + 退出按钮              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  主内容区 (lg:pl-60 / pt-16 移动端)                │
│  ┌──────────────────────────────────────────────┐ │
│  │  各页面内容                                   │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- **桌面端**：固定左侧栏 + 右侧内容区（`lg:pl-60`）
- **移动端**：顶部固定导航栏（h-16）+ 抽屉式侧边栏 + 全宽内容区
- 侧边栏支持展开/收起（`w-60` ↔ `w-16`）

### 1.3 页面级布局模式

| 页面 | 布局模式 | 特点 |
|------|---------|------|
| SingleTaskPage | 左右双栏（`md:flex-row`） | 左侧配置栏 520px + 右侧预览区 flex-1 |
| BatchManagement | 全宽单栏 | 项目选择 + 表格式 draft 列表 |
| DownloadManagement | 全宽单栏 | 筛选栏 + 表格 + 分页 |
| Settings | 全宽单栏，`max-w-4xl mx-auto` | 卡片分区 |
| AdminPage | 全宽单栏，`max-w-7xl mx-auto` | 统计卡片网格 + 表格 |

### 1.4 组件样式规范

#### 卡片（Section Card）
```
bg-[#1c1f2e] rounded-xl p-6 border border-gray-800
（AdminPage 用 rounded-2xl）
```

#### 按钮

| 类型 | 样式 |
|------|------|
| 主按钮 | `bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl font-bold` |
| 禁用态 | `disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500` |
| 次要按钮 | `bg-gray-700 hover:bg-gray-600 rounded-xl` |
| 危险按钮 | `bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg` |
| 成功按钮 | `bg-green-600 hover:bg-green-500 rounded-lg` |
| 选择按钮（选中） | `border-purple-500 bg-purple-500/10 text-purple-400` |
| 选择按钮（未选中） | `border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600` |

#### 输入框
```
bg-[#0f111a] 或 bg-[#1c1f2e]
border border-gray-700 rounded-lg px-3 py-2 text-sm
focus:outline-none focus:border-purple-500 或 focus:ring-2 focus:ring-purple-500
```

#### 表格
```
<table className="w-full">
  <thead className="bg-[#0f111a]">
    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
  <tbody className="divide-y divide-gray-800">
    <tr className="hover:bg-[#0f111a]/50">
      <td className="px-6 py-4 text-sm">
```

#### 状态标签（Badge）
```
<span className="px-2 py-1 rounded-lg text-xs font-medium bg-{color}-500/20 text-{color}-400">
```

#### 统计卡片（StatCard）
```
bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6
  左侧：标题(text-gray-400 text-sm) + 数值(text-3xl font-bold text-white)
  右侧：图标圆形(w-12 h-12 rounded-xl bg-gradient-to-br from-X to-Y)
```

### 1.5 弹窗/对话框模式

当前使用原生 `alert()` / `confirm()` / `prompt()` 进行反馈，仅 AdminPage 有自定义弹窗：
```
固定遮罩：fixed inset-0 bg-black/50 z-50
弹窗容器：bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6 w-full max-w-md
```

**改进建议**：后续统一使用自定义 Modal 组件替代原生对话框。

### 1.6 图标系统

所有图标定义在 `src/components/Icons.tsx` 中，均为 SVG 内联组件，接受 `className` 属性。已有图标包括：FilmIcon、PackageIcon、DownloadIcon、SettingsIcon、MenuIcon、CloseIcon、UserIcon、ShieldIcon、LogoutIcon、SparkleIcon、GearIcon、PlusIcon、CheckIcon、UsersIcon 等。

---

## 二、现有路由结构和页面清单

| 路由 | 页面组件 | 保护级别 | 说明 |
|------|---------|---------|------|
| `/login` | LoginPage | 公开 | 登录 |
| `/register` | RegisterPage | 公开 | 注册 |
| `/` | SingleTaskPage | 登录用户 | 单任务视频生成 |
| `/batch` | BatchManagementPage | 登录用户 | 批量任务管理 |
| `/download` | DownloadManagementPage | 登录用户 | 下载管理 |
| `/settings` | SettingsPage | 登录用户 | 全局设置 + 即梦账号管理 |
| `/admin` | AdminPage | 管理员 | 管理后台（用户管理 + 统计） |
| `*` | → `/` | — | 404 重定向 |

路由守卫通过 `ProtectedRoute` 组件实现，检查 `currentUser` 和 `requireAdmin`。

---

## 三、现有组件复用模式

### 3.1 全局状态

- `AppContext` 使用 `useReducer` 管理 projects/tasks/settings 状态
- `currentUser` 通过 props 从 `AppContent` → `AppProvider` → 各组件传递
- 用户状态独立在 `App.tsx` 中管理，不在 AppContext 中

### 3.2 服务层

| 文件 | 职责 |
|------|------|
| `authService.ts` | 登录/注册/登出/获取当前用户/管理员操作 |
| `projectService.ts` | 项目 CRUD + 项目任务查询 |
| `taskService.ts` | 任务 CRUD |
| `batchService.ts` | 批量任务管理 |
| `downloadService.ts` | 下载任务管理 |
| `settingsService.ts` | 全局设置 + 即梦账号管理 |
| `videoService.ts` | 视频生成调用 |

所有服务使用 `X-Session-ID` 头进行认证。

### 3.3 组件复用情况

- **Icons.tsx**：统一图标库，所有页面共用
- **VideoPlayer.tsx**：视频播放器，SingleTaskPage 使用
- **VideoPreviewModal.tsx**：视频预览弹窗 + 悬浮预览，DownloadManagement 使用
- **Sidebar.tsx**：全局侧边栏导航
- 无通用 Modal/Dialog 组件、无通用 Table 组件、无通用 Form 组件

**复用程度较低**，各页面基本自包含所有 UI 逻辑。

---

## 四、新增/改造页面的详细建议

### 4.1 ProfilePage（个人设置）— 新建 `/profile`

**布局参考**：Settings 页的 `max-w-4xl mx-auto` 单栏布局。

**建议结构**：
```
┌─ 页面标题："个人设置" ──────────────────────────┐
│                                                 │
│  ┌─ 基本信息卡片 ─────────────────────────────┐ │
│  │  头像区域（渐变圆形，显示昵称首字母）          │ │
│  │                                             │ │
│  │  昵称：[输入框]        [保存]               │ │
│  │  规则提示：2-10位字母或数字                  │ │
│  │                                             │ │
│  │  邮箱：xxx@xxx.com     (只读，灰色)          │ │
│  │  角色：普通用户         (只读，Badge)         │ │
│  │  注册时间：2026-04-10  (只读)               │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ 即梦账号摘要卡片 ─────────────────────────┐ │
│  │  总账号数：5                                │ │
│  │  可用账号：3                                │ │
│  │  不可用：2                                  │ │
│  │  （管理员可见完整管理入口链接到 /settings）    │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**样式要点**：
- 使用 `bg-[#1c1f2e] rounded-xl p-6 border border-gray-800` 卡片
- 昵称输入框使用现有输入框样式
- 保存按钮使用主按钮渐变样式
- 只读字段用 `text-gray-400` 显示

### 4.2 Settings 改造 — 按角色条件渲染

**当前状态**：Settings 页包含全局设置 + SessionID 账号管理，所有登录用户均可访问全部功能。

**改造方案**：
```typescript
// 在 SettingsPage 中获取 currentUser
const { currentUser } = useApp();
const isAdmin = currentUser?.role === 'admin';

return (
  <div>
    {/* 所有用户可见：默认生成参数设置 */}
    <DefaultSettingsSection />

    {/* 仅管理员可见：SessionID 完整管理 */}
    {isAdmin ? (
      <SessionAccountManagement />  // 现有的完整账号管理 UI
    ) : (
      <SessionAccountSummary />     // 新增：仅显示摘要（数量/可用/不可用）
    )}
  </div>
);
```

**注意**：AppContext 当前暴露了 `currentUser`，可直接在 `useApp()` 中获取。

### 4.3 AdminDashboard（管理面板）— 新建 `/admin/dashboard`

**当前 AdminPage 已有统计卡片和用户表格**。建议：
- `/admin` 保持为用户管理页
- 新增 `/admin/dashboard` 作为统计面板（或将统计移到 dashboard，admin 保持用户管理）

**布局建议**：
```
┌─ 统计概览 ────────────────────────────────────┐
│  [总用户] [活跃用户] [今日任务] [本周视频]       │
│  (复用现有 StatCard 组件模式)                   │
└────────────────────────────────────────────────┘

┌─ 成员活动统计 ─────────────────────────────────┐
│  时间范围：[7天 ▼]                              │
│  ┌──────┬────────┬──────┬──────┬──────────┐    │
│  │ 昵称  │ 邮箱    │ 角色  │ 生成数 │ 最后活跃  │    │
│  └──────┴────────┴──────┴──────┴──────────┘    │
└────────────────────────────────────────────────┘

┌─ 最近生成记录 ─────────────────────────────────┐
│  ┌──────┬────────┬────────┬──────┬──────────┐  │
│  │ ID    │ 用户    │ 项目    │ 状态  │ 创建时间  │  │
│  └──────┴────────┴────────┴──────┴──────────┘  │
└────────────────────────────────────────────────┘
```

**样式要点**：复用 AdminPage 的 StatCard 模式和表格样式。

### 4.4 ProjectDetailPage（项目详情）— 新建 `/projects/:id`

这是最复杂的新页面，需要展示集/镜头树形结构。

**布局建议**：
```
┌─ 项目标题栏 ───────────────────────────────────┐
│  ← 返回  项目名称（代号）          [编辑] [设置]  │
└────────────────────────────────────────────────┘

┌─ 集/镜头树 ────────────────────────────────────┐
│                                                 │
│  ▼ 第 1 集 - 标题                [+ 添加镜头]   │
│  ┌──────────────────────────────────────────┐   │
│  │ # │ 描述     │ 版本数 │ 操作              │   │
│  │ 1 │ 开场镜头  │ 3     │ [生成][版本][编辑][删除] │
│  │ 2 │ 对话特写  │ 1     │ [生成][版本][编辑][删除] │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ▶ 第 2 集 - 标题                [+ 添加镜头]   │
│                                                 │
│  [+ 添加新集]                                    │
└────────────────────────────────────────────────┘
```

**交互要点**：
- 集标题行可点击展开/折叠
- 每个集内的镜头列表使用简化表格
- 点击「生成」跳转到 `/?shot=123`，自动预选该镜头
- 点击「版本」展开该镜头的版本列表（卡片式，显示视频缩略图）
- 内联编辑（点击描述即可编辑）减少弹窗使用
- 使用现有的圆角卡片 + 表格样式

**样式**：
- 集标题行：`bg-[#1c1f2e] p-4 rounded-t-xl border border-gray-800 cursor-pointer`
- 镜头表格：嵌套在集卡片内，使用现有表格样式
- 展开/折叠使用 CSS transition

### 4.5 ShotSelector 组件 — 级联选择器

**使用场景**：SingleTaskPage 和 BatchManagement。

**建议结构**：
```
┌─ 关联镜头（可选）─── [展开/收起 ▼] ──────────┐
│                                               │
│  项目：[── 选择项目 ── ▼]                     │
│  集：  [── 选择集 ──── ▼]  (项目选中后可用)    │
│  镜头：[── 选择镜头 ── ▼]  (集选中后可用)      │
│         [+ 新建镜头]                           │
│                                               │
│  预计版本号：C                                 │
│  文件名预览：SN-1-1-C-WG.mp4                  │
└───────────────────────────────────────────────┘
```

**样式**：
- 可折叠区域用 `bg-[#1c1f2e] rounded-2xl p-4 border border-gray-800`（与 SingleTaskPage 其他 section 一致）
- 下拉选择用现有 `<select>` 样式或自定义下拉
- 文件名预览用 `text-xs text-gray-500 font-mono`
- 在 BatchManagement 中，简化为单个下拉选择（显示 `SN-1-1` 格式）

### 4.6 DownloadManagement 改造 — 增加文件名列

**改动较小**：在现有表格中新增一列「文件名」：
- 有规范文件名时显示完整文件名（`SN-1-1-C-WG.mp4`），`font-mono text-xs`
- 无规范文件名时显示降级文件名（灰色弱化）
- 下载按钮使用规范文件名作为 `download` 属性

---

## 五、UI 设计参考

### 5.1 AI 视频生成平台

- **Runway Gen-4**：左侧配置 + 右侧预览的双栏布局（与现有 SingleTaskPage 一致），高级相机控制面板。趋势是从批处理转向实时交互操作。
- **Pika Labs 2.5**：简洁的输入式界面，底部工具栏 + 画布预览。注意其反面教训：初始界面元素过多导致新用户困惑。

参考链接：
- [Sora vs Runway vs Pika 对比](https://pxz.ai/blog/sora-vs-runway-vs-pika-best-ai-video-generator-2026-comparison)
- [AI 视频生成完整指南](https://wavespeed.ai/blog/posts/complete-guide-ai-video-apis-2026/)

### 5.2 镜头管理工具

- **StudioBinder**：Shot Tagging 功能，剧本旁显示 shot list，点击台词自动添加镜头。拖放排序镜头顺序。分组管理（按灯光/机位设置分组）。
- **Boords**：拖放式故事板，实时协作编辑，简洁的卡片式镜头展示。
- **ShotGrid (Autodesk)**：可定制 UI，对不同角色展示不同视图（艺术家看媒体管理、协调员看任务调度）。

参考链接：
- [StudioBinder Shot List 工具](https://www.studiobinder.com/shot-list-storyboard/)
- [Boords 免费 Shot List 工具](https://boords.com/shot-list-software)
- [ShotGrid 在 LAIKA 的应用](https://www.autodesk.com/autodesk-university/article/Shotgun-Production-Management-LAIKAs-Animated-Features-2019)

### 5.3 管理面板模板

- **TailAdmin**：React + Tailwind 暗色主题管理模板，统计卡片 + 图表 + 数据表格布局，与现有 AdminPage 风格高度匹配。
- **Admin One**：React + Tailwind CSS 3 + TypeScript，深色模式、styled scrollbar、可复用组件。

参考链接：
- [TailAdmin 免费模板](https://tailadmin.com)
- [Admin One React Tailwind Dashboard](https://justboil.me/tailwind-admin-templates/free-react-dashboard/)
- [Top 7+ Free Tailwind React Admin Templates](https://dev.to/tailwindcss/top-7-free-tailwind-react-admin-dashboard-templates-for-2024-1gc9)

---

## 六、总结与建议

### 6.1 设计语言一致性

现有 UI 已形成较统一的暗色主题设计语言，新页面应严格遵循：
- 背景三层：`#0f111a`（页面）→ `#1c1f2e`（卡片）→ `#0f111a`（嵌套输入区）
- 强调色：`purple-500` 系渐变
- 圆角：卡片 `rounded-xl`/`rounded-2xl`，按钮 `rounded-lg`/`rounded-xl`
- 边框：`border-gray-800`（卡片）/ `border-gray-700`（输入框）

### 6.2 需要抽取的公共组件

建议在实施前先抽取以下公共组件，提升开发效率和一致性：

1. **Modal**：替代原生 `alert/confirm/prompt`，参考 AdminPage 已有的弹窗样式
2. **StatCard**：从 AdminPage 抽取，AdminDashboard 复用
3. **DataTable**：统一表格样式（表头、行悬浮、分页），AdminPage 和 DownloadManagement 可复用
4. **Badge**：统一状态标签样式

### 6.3 路由规划

```
现有路由：
  /login, /register, /, /batch, /download, /settings, /admin

新增路由：
  /profile                    — 个人设置（所有登录用户）
  /projects/:id               — 项目详情（集/镜头管理）

注：管理统计面板通过 AdminPage 内部 Tab 切换实现，不设独立路由。

侧边栏菜单调整：
  单任务生成 (/)
  批量管理 (/batch)
  下载管理 (/download)
  ──────────
  个人设置 (/profile)         ← 新增
  设置 (/settings)
  ──────────
  管理后台 (/admin)           [管理员]（内含统计面板 / 用户管理 / 邀请码管理 Tab）
```

### 6.4 Sidebar 改造要点

1. 底部用户信息区显示昵称（优先）或邮箱
2. 增加「个人设置」导航项（UserIcon，放在设置前面）
3. 管理后台内部通过 Tab 切换（统计面板 / 用户管理 / 邀请码管理），不增加独立子导航
4. 昵称未设置时，显示邮箱 + 提示气泡引导设置昵称
