# 前端 UI 详细设计方案

> 日期：2026-04-16
> 基于：[分析-现有前端架构与UI模式.md](./分析-现有前端架构与UI模式.md)、[调研-社区项目深度分析.md](./调研-社区项目深度分析.md)

---

## 设计原则

1. **一致性**：所有新页面严格遵循现有暗色主题设计语言（`#0f111a` / `#1c1f2e` / `purple-500`）
2. **渐进增强**：新功能（镜头关联）默认可选，不破坏现有使用流程
3. **最少 UI 变更**：复用现有组件样式，只在必要时新增组件
4. **参考行业**：借鉴 Kitsu 的"My Tasks 首页"理念和 StudioBinder 的镜头列表交互

---

## 0. 公共组件（需先行抽取）

### 0.1 Modal 组件

替代全部 `alert()` / `confirm()` / `prompt()` 调用。

```
文件：src/components/Modal.tsx
Props：
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'       // sm=max-w-sm, md=max-w-md, lg=max-w-lg
  footer?: ReactNode                // 底部按钮区

结构：
┌─ 遮罩层 fixed inset-0 bg-black/50 z-50 ─────────────────┐
│  ┌─ 弹窗 bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6 ┐
│  │  标题：text-xl font-semibold text-white mb-4               │
│  │  内容：{children}                                          │
│  │  ─────────────────────────────────                         │
│  │  底部：{footer} flex gap-3                                  │
│  └─────────────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────┘
```

### 0.2 ConfirmDialog 组件

基于 Modal 的确认对话框快捷封装。

```
文件：src/components/ConfirmDialog.tsx
Props：
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmText?: string             // 默认 "确定"
  confirmVariant?: 'primary' | 'danger'  // danger 时按钮为红色
```

### 0.3 Toast / 通知组件

替代 `alert()` 做成功/错误反馈。

```
文件：src/components/Toast.tsx

位置：fixed top-4 right-4 z-[60]
类型：success / error / warning / info
自动消失：3 秒

结构：
┌─ bg-[#1c1f2e] border-l-4 border-{color} rounded-lg p-4 shadow-2xl ─┐
│  [Icon] 消息文字                                         [x 关闭]   │
└─────────────────────────────────────────────────────────────────────┘

使用方式：通过 ToastProvider + useToast() hook
```

### 0.4 EmptyState 组件

统一空状态展示。

```
文件：src/components/EmptyState.tsx
Props：
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }

结构：
┌─ py-16 text-center ─────────────────────────────┐
│  [Icon] w-12 h-12 text-gray-600 mx-auto mb-4    │
│  标题 text-lg font-medium text-gray-400          │
│  描述 text-sm text-gray-500 mt-2                 │
│  [操作按钮] mt-4 主按钮样式                       │
└──────────────────────────────────────────────────┘
```

---

## 0.5 RegisterPage 改造（邀请码注册）

**路由**：`/register`（不变）
**保护级别**：公开（未登录用户）
**改动范围**：表单增加邀请码输入框

### 0.5.1 页面结构

在现有注册表单的**最顶部**（邮箱字段之前）增加邀请码输入框：

```
┌─ 注册页面 ──────────────────────────────────────────────────┐
│  bg-[#0f111a] min-h-screen flex items-center justify-center │
│                                                              │
│  ┌─ 注册卡片 bg-[#1c1f2e] rounded-2xl p-8 max-w-md ──────┐ │
│  │                                                          │ │
│  │  [Logo + 标题]                                           │ │
│  │                                                          │ │
│  │  邀请码 *                                                │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ [输入框] placeholder="请输入邀请码"                │    │ │
│  │  │ bg-[#0f111a] border border-gray-700 rounded-lg   │    │ │
│  │  │ focus:border-purple-500                           │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │  请向管理员获取邀请码                                     │ │
│  │  text-xs text-gray-500 mt-1                              │ │
│  │  （校验失败时：text-red-400 + 错误信息）                   │ │
│  │                                                          │ │
│  │  邮箱 *                                                  │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ [输入框] （现有，不变）                             │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                          │ │
│  │  验证码 *  [发送验证码]                                   │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ [输入框] （现有，不变）                             │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                          │ │
│  │  密码 *                                                  │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ [输入框] （现有，不变）                             │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                          │ │
│  │  确认密码 *                                              │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ [输入框] （现有，不变）                             │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                          │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │  注册    bg-gradient-to-r from-purple-600 ...    │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                          │ │
│  │  已有账号？点此登录                                       │ │
│  │  text-sm text-gray-400, "点此登录" text-purple-400       │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 0.5.2 交互逻辑

1. **邀请码格式校验**：输入时实时校验 `/^[A-Z0-9]{8}$/`（8 位大写字母+数字），不匹配时输入框边框变红 + 提示"邀请码格式应为 8 位大写字母和数字"
2. **提交时后端校验**：后端返回的错误信息直接展示在邀请码输入框下方，text-red-400
3. **错误提示区分**：
   - 邀请码不存在："邀请码无效"
   - 邀请码已过期："邀请码已过期"
   - 邀请码已用完："邀请码使用次数已达上限"
   - 邀请码已停用："邀请码已停用"
4. **URL 参数支持**：支持 `/register?code=XXXXXXXX`，页面加载时自动填充邀请码输入框
5. **表单状态**：邀请码为必填字段，未填写时注册按钮 disabled

### 0.5.3 状态管理

```typescript
// RegisterPage 新增本地状态
const [invitationCode, setInvitationCode] = useState('');
const [invitationError, setInvitationError] = useState('');

// URL 参数自动填充
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) setInvitationCode(code.toUpperCase());
}, []);
```

### 0.5.4 样式要点

- 邀请码输入框使用与其他输入框完全一致的样式（`bg-[#0f111a] border border-gray-700 rounded-lg`）
- 邀请码图标：使用 `SparkleIcon` 或 `KeyIcon`（需在 Icons.tsx 新增 KeyIcon）
- 提示文字"请向管理员获取邀请码"使用 `text-xs text-gray-500`

---

## 0.6 AdminPage 邀请码管理 Tab

**位置**：AdminPage 内部 Tab（与统计面板、用户管理并列）
**保护级别**：仅管理员（继承 AdminPage 的路由守卫）

### 0.6.1 Tab 内容结构

```
┌─ 邀请码管理 Tab ──────────────────────────────────────────────┐
│                                                                │
│  ┌─ 标题栏 flex justify-between items-center mb-6 ──────────┐ │
│  │  邀请码管理                                                │ │
│  │  text-xl font-bold text-white                              │ │
│  │                                                [+ 生成邀请码]│ │
│  │  bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ 邀请码列表表格 ──────────────────────────────────────────┐ │
│  │  bg-[#1c1f2e] border border-gray-800 rounded-2xl          │ │
│  │                                                            │ │
│  │  ┌──────────┬──────┬──────┬──────┬──────────┬────────┐    │ │
│  │  │ 邀请码    │ 备注  │ 用量 │ 状态  │ 创建时间   │ 操作    │    │ │
│  │  ├──────────┼──────┼──────┼──────┼──────────┼────────┤    │ │
│  │  │ SD2X7KM9 │ 给张三│ 0/1  │[有效] │ 04-16    │[停用][删除]│  │ │
│  │  │ font-mono│      │      │green │          │        │    │ │
│  │  │ A3BN2PQR │ 给李四│ 1/1  │[已满] │ 04-15    │[删除]  │    │ │
│  │  │          │      │      │gray  │          │        │    │ │
│  │  │ K9M2XZAB │ 通用  │ 3/10 │[有效] │ 04-14    │[停用][删除]│  │ │
│  │  │ EXPIRED1 │ 测试  │ 0/5  │[过期] │ 04-10    │[删除]  │    │ │
│  │  │          │      │      │red   │          │        │    │ │
│  │  └──────────┴──────┴──────┴──────┴──────────┴────────┘    │ │
│  │                                                            │ │
│  │  状态 Badge：                                              │ │
│  │    有效 → bg-green-500/20 text-green-400                   │ │
│  │    已满 → bg-gray-500/20 text-gray-400                     │ │
│  │    过期 → bg-red-500/20 text-red-400                       │ │
│  │    已停用 → bg-yellow-500/20 text-yellow-400               │ │
│  │                                                            │ │
│  │  空状态：EmptyState "暂无邀请码，点击上方按钮生成"           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ 使用记录（展开行，点击邀请码行展开）──────────────────────┐ │
│  │  bg-[#161824] rounded-lg p-4                               │ │
│  │  使用记录：                                                │ │
│  │  · user1@example.com — 2026-04-16 14:30                    │ │
│  │  · user2@example.com — 2026-04-16 15:00                    │ │
│  │  text-xs text-gray-400                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 0.6.2 生成邀请码弹窗

```
┌─ Modal: 生成邀请码 ──────────────────────────────────────────┐
│  bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6        │
│  max-w-md                                                     │
│                                                               │
│  生成邀请码                                                    │
│  text-xl font-semibold text-white mb-4                        │
│                                                               │
│  备注                                                         │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ [输入框] placeholder="给谁使用的？（可选）"            │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                               │
│  最大使用次数                                                  │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ [数字输入] 默认值 1，最小 0（0=无限）                   │     │
│  └──────────────────────────────────────────────────────┘     │
│  text-xs text-gray-500: 0 表示不限次数                         │
│                                                               │
│  有效期                                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ [下拉] 永不过期 / 7天 / 30天 / 90天 / 自定义日期   ▼ │     │
│  └──────────────────────────────────────────────────────┘     │
│  （选择"自定义日期"时显示日期选择器）                           │
│                                                               │
│  ──────────── border-t border-gray-800 mt-4 pt-4 ──────       │
│                                                               │
│                          [取消]  [生成]                        │
│                          gray    purple gradient               │
└───────────────────────────────────────────────────────────────┘
```

生成成功后显示 Toast 成功提示 + 新邀请码高亮闪烁效果。

### 0.6.3 数据获取

```typescript
// src/services/adminService.ts 新增
export async function getInvitationCodes() {
  return fetchApi('/api/admin/invitation-codes');
}

export async function createInvitationCode(data: {
  note?: string;
  max_uses?: number;
  expires_at?: string;
}) {
  return fetchApi('/api/admin/invitation-codes', { method: 'POST', body: data });
}

export async function updateInvitationCode(id: number, data: { is_active?: boolean; note?: string }) {
  return fetchApi(`/api/admin/invitation-codes/${id}`, { method: 'PUT', body: data });
}

export async function deleteInvitationCode(id: number) {
  return fetchApi(`/api/admin/invitation-codes/${id}`, { method: 'DELETE' });
}
```

### 0.6.4 组件拆分

```
src/pages/AdminPage.tsx                    — 页面容器（三个 Tab）
  ├── (内联) AdminTabBar                   — Tab 导航（统计面板 / 用户管理 / 邀请码管理）
  ├── src/components/admin/DashboardTab.tsx — 统计面板 Tab
  ├── (现有) UserManagementTab             — 用户管理 Tab（现有代码提取）
  └── src/components/admin/InvitationCodeTab.tsx — 邀请码管理 Tab
      ├── (内联) InvitationCodeTable       — 邀请码列表
      └── (内联) CreateInvitationModal     — 生成弹窗（基于 Modal）
```

---

## 1. ProfilePage（个人设置页）

**路由**：`/profile`
**保护级别**：所有登录用户
**布局**：`max-w-2xl mx-auto p-6`（比 Settings 窄，内容简单无需 4xl）

### 1.1 页面结构

```
┌─ 页面标题 ─────────────────────────────────────────────────┐
│  个人设置                                                   │
│  text-2xl font-bold text-white mb-6                        │
└────────────────────────────────────────────────────────────┘

┌─ 头像 + 基本信息卡片 ──────────────────────────────────────┐
│  bg-[#1c1f2e] rounded-xl p-6 border border-gray-800       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [头像]  w-16 h-16 rounded-full                      │  │
│  │  bg-gradient-to-br from-purple-500 to-pink-500       │  │
│  │  显示昵称首字母（大写），无昵称显示 "?"                 │  │
│  │  text-2xl font-bold text-white                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  昵称                                                       │
│  ┌──────────────────────────────┐  ┌────────┐              │
│  │ [输入框] placeholder="设置昵称" │  │  保存  │              │
│  └──────────────────────────────┘  └────────┘              │
│  规则：2-10位字母或数字                                      │
│  text-xs text-gray-500 mt-1                                │
│  （校验失败时 text-red-400）                                 │
│                                                             │
│  ──────────── 分隔线 border-t border-gray-800 my-4 ──────  │
│                                                             │
│  邮箱    admin@seedance.com      text-gray-400              │
│  角色    [管理员] Badge           amber Badge               │
│  注册    2026-04-10              text-gray-500              │
│  积分    100                     text-white                 │
└────────────────────────────────────────────────────────────┘

┌─ 即梦账号状态卡片 ─────────────────────────────────────────┐
│  bg-[#1c1f2e] rounded-xl p-6 border border-gray-800       │
│                                                             │
│  即梦账号状态                                               │
│  text-lg font-bold mb-4                                    │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ 总账号  5   │ │ 可用   3   │ │ 不可用 2   │             │
│  │ text-3xl   │ │ green      │ │ red        │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│  (三个小 StatCard 横排，bg-[#0f111a] rounded-lg p-4)       │
│                                                             │
│  [管理员可见] → 前往账号管理 (link to /settings)            │
│  text-sm text-purple-400 hover:underline                   │
└────────────────────────────────────────────────────────────┘
```

### 1.2 交互逻辑

1. 页面加载时调用 `GET /api/user/profile` 获取用户信息
2. 管理员和普通用户都调用 `GET /api/settings/session-accounts`，后端按角色返回完整列表或摘要
3. 昵称输入实时校验格式 `/^[A-Za-z0-9]{2,10}$/`，不匹配时输入框边框变红 + 错误提示
4. 点击保存：
   - 格式校验通过 → 调用 `PUT /api/user/profile`
   - 成功 → Toast 成功提示 + 刷新全局 currentUser（通过 AppContext 或重新 fetch）
   - 失败（昵称重复）→ Toast 错误提示
5. 头像区域展示昵称首字母；昵称变更后头像实时更新

### 1.3 状态管理

```typescript
// 本地状态
const [nickname, setNickname] = useState(currentUser?.nickname || '');
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
const [accountSummary, setAccountSummary] = useState({ total: 0, available: 0, unavailable: 0 });
```

不需要修改 AppContext，但保存成功后需要刷新 `currentUser`。建议在 `App.tsx` 中提供一个 `refreshUser` 回调。

---

## 2. Settings 页改造（按角色条件渲染）

**路由**：`/settings`（不变）
**改动范围**：仅 SessionID 账号管理区域

### 2.1 改造方案

```typescript
// Settings.tsx 中
const { currentUser } = useApp();
const isAdmin = currentUser?.role === 'admin';

return (
  <div className="h-screen overflow-y-auto bg-[#0f111a] text-white">
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">全局设置</h1>

      {/* ===== 区域 1：默认生成参数 — 所有用户可见可编辑 ===== */}
      <DefaultParamsSection />

      {/* ===== 区域 2：SessionID 账号管理 — 按角色区分 ===== */}
      {isAdmin ? (
        <SessionAccountManagement />   // 现有完整管理 UI（不变）
      ) : (
        <SessionAccountSummary />       // 新增：只读摘要
      )}
    </div>
  </div>
);
```

### 2.2 普通用户看到的 SessionAccountSummary

```
┌─ 即梦账号状态 ──────────────────────────────────────────────┐
│  bg-[#1c1f2e] rounded-xl p-6 border border-gray-800        │
│                                                              │
│  [SparkleIcon] SessionID 账号状态                            │
│                                                              │
│  系统当前配置了 5 个即梦账号，其中 3 个可用。                    │
│  text-sm text-gray-400                                       │
│                                                              │
│  如需管理账号，请联系管理员。                                   │
│  text-xs text-gray-500                                       │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 数据获取变更

普通用户调用 `GET /api/settings/session-accounts` 时，后端返回：
```json
{ "summary": { "total": 5, "available": 3, "unavailable": 2 } }
```

前端服务层需要处理两种响应格式：
```typescript
// settingsService.ts
export async function getSessionAccounts() {
  const res = await fetch('/api/settings/session-accounts', { headers });
  const data = await res.json();
  if (data.summary) {
    return { type: 'summary' as const, summary: data.summary };
  }
  return { type: 'full' as const, accounts: data.accounts || [] };
}
```

---

## 3. AdminDashboard（管理统计面板）

**路由**：无独立路由，通过 AdminPage 内部 Tab 切换实现
**保护级别**：仅管理员（继承 AdminPage 的路由守卫）
**布局**：`max-w-7xl mx-auto p-6`（与 AdminPage 一致）

### 3.1 路由集成

不新增独立路由。统计面板作为 AdminPage 内部的一个 Tab。

**Tab 切换方案**（避免路由和侧边栏复杂度增加）：

```
┌─ 管理后台 ──────────────────────────────────────────────────┐
│                                                              │
│  [统计面板]  [用户管理]  [邀请码管理]                          │
│  ─────────────────── Tab 切换 ──────────────────────         │
│                                                              │
│  (Tab 内容区)                                                │
└──────────────────────────────────────────────────────────────┘
```

Tab 样式：
```
选中：text-purple-400 border-b-2 border-purple-400 pb-2
未选中：text-gray-400 hover:text-white pb-2
```

### 3.2 统计面板 Tab 内容

```
┌─ 概览统计卡片 ──────────────────────────────────────────────┐
│  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6      │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 总用户    │ │ 活跃用户  │ │ 总任务数  │ │ 本周生成  │      │
│  │ 12       │ │ 8        │ │ 456      │ │ 89       │      │
│  │ blue     │ │ green    │ │ amber    │ │ purple   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  (复用 AdminPage 的 StatCard 模式)                           │
└──────────────────────────────────────────────────────────────┘

┌─ 成员活动统计 ──────────────────────────────────────────────┐
│  bg-[#1c1f2e] border border-gray-800 rounded-2xl            │
│                                                              │
│  ┌─ 标题栏 p-6 border-b border-gray-800 ──────────────────┐ │
│  │  成员活动                    时间范围：[7天 ▼] [30天 ▼]  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 表格 ─────────────────────────────────────────────────┐  │
│  │ 头像 │ 昵称/邮箱  │ 角色    │ 生成视频数 │ 最后活跃     │  │
│  ├──────┼──────────┼────────┼──────────┼─────────────┤  │
│  │ [ZS] │ ZS       │ [用户]  │ 23       │ 2 小时前    │  │
│  │      │ zs@xx.com│        │          │             │  │
│  │ [AD] │ ADM      │ [管理员]│ 45       │ 刚刚        │  │
│  └──────┴──────────┴────────┴──────────┴─────────────┘  │
│                                                              │
│  头像列：w-8 h-8 rounded-full bg-gradient-to-br             │
│         from-purple-500 to-pink-500，显示昵称首字母           │
│  昵称+邮箱：昵称 text-white，邮箱 text-xs text-gray-500      │
│  角色：Badge（同 AdminPage）                                  │
│  最后活跃：相对时间（x 分钟前 / x 小时前 / x 天前）           │
└──────────────────────────────────────────────────────────────┘

┌─ 最近生成记录 ──────────────────────────────────────────────┐
│  bg-[#1c1f2e] border border-gray-800 rounded-2xl            │
│                                                              │
│  ┌─ 标题栏 ────────────────────────────────────────────────┐ │
│  │  最近生成记录                              [查看更多 →]  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 表格 ─────────────────────────────────────────────────┐  │
│  │ ID   │ 用户    │ 项目    │ 模型      │ 状态  │ 时间     │  │
│  ├──────┼────────┼────────┼──────────┼──────┼─────────┤  │
│  │ #101 │ ZS     │ 十年    │ Fast VIP │ [完成]│ 14:30   │  │
│  │ #100 │ WG     │ 短片A   │ 2.0      │ [失败]│ 14:25   │  │
│  └──────┴────────┴────────┴──────────┴──────┴─────────┘  │
│                                                              │
│  状态 Badge：                                                │
│    done → bg-green-500/20 text-green-400 "完成"              │
│    error → bg-red-500/20 text-red-400 "失败"                 │
│    generating → bg-blue-500/20 text-blue-400 "生成中"         │
│  默认展示最近 20 条                                           │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 数据获取

```typescript
// src/services/adminService.ts（新建）
export async function getMembers(range: '7d' | '30d' = '7d') {
  return fetchApi(`/api/admin/members?range=${range}`);
}

export async function getRecentTasks(limit: number = 20) {
  return fetchApi(`/api/admin/recent-tasks?limit=${limit}`);
}
```

---

## 4. ProjectDetailPage（项目详情 — 集/镜头管理）

**路由**：`/projects/:id`
**保护级别**：登录用户可查看；增删改操作仅管理员
**布局**：`max-w-5xl mx-auto p-6`

### 4.1 入口

从 BatchManagement 页面的项目列表中增加「详情」链接：

```
项目列表中每个项目名旁增加 [📋 详情] 链接
→ 点击跳转到 /projects/:id
```

### 4.2 页面结构

```
┌─ 顶部导航栏 ──────────────────────────────────────────────────┐
│  flex items-center justify-between mb-6                       │
│                                                                │
│  ← 返回批量管理    项目名称                                     │
│  (link)            text-2xl font-bold text-white               │
│                                                                │
│  项目代号：┌──────────┐ [保存]                                  │
│           │ SN       │ (inline edit)                           │
│           └──────────┘                                         │
│  代号用于文件命名，2-6位大写字母，保存后不建议修改                  │
│  text-xs text-gray-500                                         │
└────────────────────────────────────────────────────────────────┘

┌─ 集/镜头树 ──────────────────────────────────────────────────┐
│                                                               │
│  ┌─ 第 1 集 ─────────────────────────── [+ 添加镜头] ──────┐ │
│  │  bg-[#1c1f2e] rounded-t-xl border border-gray-800        │ │
│  │  flex items-center justify-between px-5 py-3              │ │
│  │  cursor-pointer hover:bg-[#252838]                        │ │
│  │                                                           │ │
│  │  左侧：▼ 图标 + "第 1 集" + 标题（可选）                   │ │
│  │        text-white font-medium                              │ │
│  │        (标题) text-gray-400 text-sm ml-2                   │ │
│  │                                                           │ │
│  │  右侧：镜头数 Badge + [编辑][删除][+ 添加镜头]              │ │
│  │        操作按钮默认隐藏，hover 时显示                        │ │
│  │        ⚠️ [编辑][删除][+ 添加镜头] 仅管理员可见              │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌─ 镜头列表（展开时） ─────────────────────────────────────┐ │
│  │  bg-[#0f111a] rounded-b-xl border-x border-b border-gray-800 │
│  │  p-4                                                      │ │
│  │                                                           │ │
│  │  ┌─ 表格 ──────────────────────────────────────────────┐  │ │
│  │  │ #  │ 描述        │ Prompt 预设 │ 版本数 │ 操作       │  │ │
│  │  ├────┼────────────┼───────────┼───────┼────────────┤  │ │
│  │  │ 1  │ 开场全景    │ 有 ✓      │ 3     │ [▶][📋][✏][🗑] │ │
│  │  │ 2  │ 对话特写    │ —         │ 1     │ [▶][📋][✏][🗑] │ │
│  │  │ 3  │ 远景过渡    │ 有 ✓      │ 0     │ [▶][✏][🗑]     │ │
│  │  └────┴────────────┴───────────┴───────┴────────────┘  │ │
│  │                                                           │ │
│  │  操作按钮说明：                                            │ │
│  │  [▶ 生成] → 跳转 /?shot={id}，预选此镜头                   │ │
│  │  [📋 版本] → 展开版本列表（下方插入行）                      │ │
│  │  [✏ 编辑] → 内联编辑或弹窗编辑                              │ │
│  │  [🗑 删除] → ConfirmDialog 确认                             │ │
│  │                                                           │ │
│  │  按钮样式：                                                │ │
│  │  px-2 py-1 rounded text-xs font-medium                    │ │
│  │  生成：bg-purple-500/20 text-purple-400                    │ │
│  │  版本：bg-blue-500/20 text-blue-400                        │ │
│  │  编辑：bg-gray-700 text-gray-300                           │ │
│  │  删除：bg-red-500/20 text-red-400                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ 第 2 集（折叠态）──────────────────── [+ 添加镜头] ──┐    │
│  │  ▶ 第 2 集 - 追逐戏           3 个镜头                │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  [+ 添加新集]  ⚠️ 仅管理员可见                                  │
│  bg-[#1c1f2e] border border-dashed border-gray-700            │
│  rounded-xl p-4 text-center                                   │
│  text-gray-400 hover:text-purple-400 hover:border-purple-500  │
│  cursor-pointer transition-all                                │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 版本列表展开（镜头内嵌）

点击镜头行的 [版本] 按钮后，在该行下方展开版本卡片列表：

```
┌─ 镜头 1 的版本列表 ─────────────────────────────────────────┐
│  bg-[#161824] rounded-lg p-4 mt-2 mb-2                       │
│                                                               │
│  grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3        │
│                                                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ [视频缩略图] │ │ [视频缩略图] │ │ [视频缩略图] │               │
│  │ 16:9 比例    │ │            │ │            │               │
│  │ rounded-lg   │ │            │ │            │               │
│  │              │ │            │ │            │               │
│  │ 版本 A       │ │ 版本 B     │ │ 版本 C     │               │
│  │ 用户: ZS     │ │ 用户: WG   │ │ 用户: ZS   │               │
│  │ 4/16 14:30  │ │ 4/16 15:00 │ │ 4/16 16:00 │               │
│  │ text-xs     │ │            │ │            │               │
│  │ text-gray-500│ │            │ │            │               │
│  │              │ │            │ │            │               │
│  │ [▶ 播放] [⬇ 下载]│          │ │            │               │
│  └────────────┘ └────────────┘ └────────────┘               │
│                                                               │
│  无版本时：EmptyState "该镜头暂无版本，点击生成创建第一个版本"    │
└───────────────────────────────────────────────────────────────┘
```

### 4.4 新建/编辑镜头弹窗

```
┌─ Modal: 编辑镜头 ──────────────────────────────────────────┐
│                                                             │
│  镜头编号    [自动分配，只读]                                 │
│                                                             │
│  描述                                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [输入框] placeholder="镜头描述，如：开场全景"           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  预设 Prompt（可选）                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [textarea] min-h-[80px]                              │   │
│  │ placeholder="选择此镜头时自动填充到生成页的提示词"       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  预设参考图（可选）                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [上传区域] 或 [已上传图片缩略图]                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  推荐模型（可选）                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [下拉] 不指定 / Seedance 2.0 / 2.0 VIP / Fast / Fast VIP │
│  └──────────────────────────────────────────────────────┘   │
│  选择镜头时自动预选此模型                                      │
│                                                             │
│                               [取消]  [保存]                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 新建集（内联）

点击「+ 添加新集」后，在列表底部出现内联编辑行：

```
┌─ 新建集（内联） ───────────────────────────────────────────┐
│  bg-[#1c1f2e] rounded-xl border border-purple-500/50 p-4  │
│                                                             │
│  集编号：[自动] 标题：[输入框 placeholder="可选"]            │
│                                                             │
│  [取消] [创建]                                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 数据流

```typescript
// src/services/projectService.ts（扩展）
export async function getProjectDetail(id: number) { ... }
export async function updateProjectCode(id: number, code: string) { ... }
export async function getEpisodes(projectId: number) { ... }
export async function createEpisode(projectId: number, data: { title?: string }) { ... }
export async function updateEpisode(id: number, data: Partial<Episode>) { ... }
export async function deleteEpisode(id: number) { ... }
export async function getShots(episodeId: number) { ... }
export async function createShot(episodeId: number, data: Partial<Shot>) { ... }
export async function updateShot(id: number, data: Partial<Shot>) { ... }
export async function deleteShot(id: number) { ... }
export async function getShotVersions(shotId: number) { ... }
export async function getShotTree(projectId: number) { ... }
```

---

## 5. ShotSelector 组件（级联镜头选择器）

**文件**：`src/components/ShotSelector.tsx`
**使用位置**：SingleTaskPage、BatchManagement

### 5.1 SingleTaskPage 中的完整版

```
┌─ 关联镜头（可选）──────────────── [展开 ▼ / 收起 ▲] ──────┐
│  bg-[#1c1f2e] rounded-2xl border border-gray-800           │
│  （默认收起，只显示标题行）                                   │
│                                                             │
│  展开后：p-4                                                │
│                                                             │
│  项目    ┌─────────────────────────────────┐                │
│          │ 选择项目...                 ▼   │                │
│          └─────────────────────────────────┘                │
│          bg-[#0f111a] border border-gray-700 rounded-lg     │
│          text-sm                                            │
│                                                             │
│  集      ┌─────────────────────────────────┐                │
│          │ 选择集...                   ▼   │  (disabled     │
│          └─────────────────────────────────┘   until 项目)  │
│                                                             │
│  镜头    ┌─────────────────────────────────┐  [+ 新建]      │
│          │ 选择镜头...                 ▼   │  (disabled     │
│          └─────────────────────────────────┘   until 集)    │
│          ⚠️ [+ 新建] 仅管理员可见                            │
│                                                             │
│  ── 预览信息 ──────────────────────────────────────────      │
│  预计版本号：C                                               │
│  文件名预览：SN-1-1-C-ZS.mp4                                │
│  text-xs text-gray-500 font-mono                            │
│  bg-[#0f111a] rounded-lg p-3 mt-3                           │
│                                                             │
│  ── Prompt 预填提示 ──────────────────────────────────       │
│  (如果镜头有预设 prompt 且当前输入框为空)                      │
│  该镜头预设了提示词，是否填充？ [填充]                          │
│  text-xs text-purple-400                                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 下拉选项格式

```
项目下拉：
  十年 (SN)          // name (code)
  短片A              // 无代号时只显示 name

集下拉：
  第 1 集             // episode_number
  第 2 集 - 追逐戏    // episode_number - title

镜头下拉：
  镜头 1 - 开场全景   // shot_number - description
  镜头 2 - 对话特写   // shot_number - description
  ── 新建镜头 ──      // 分割线 + 新建入口
```

### 5.3 BatchManagement 中的精简版

在 draft 行的表格中新增一列「镜头」：

```
┌──────────────────┐
│ SN-1-1 ▼         │   // 已选择：显示 "{code}-{ep}-{shot}" 缩写
│ 未选择  ▼         │   // 未选择：灰色文字
└──────────────────┘
```

点击后弹出完整的三级选择弹窗（复用 ShotSelector 逻辑，以 Modal 形式展示）。

### 5.4 组件 Props

```typescript
interface ShotSelectorProps {
  // 当前选中值
  value: {
    projectId?: number;
    episodeId?: number;
    shotId?: number;
  } | null;

  // 选中回调
  onChange: (value: { projectId: number; episodeId: number; shotId: number } | null) => void;

  // 显示模式
  mode: 'inline' | 'compact';   // inline=SingleTaskPage, compact=BatchManagement

  // 是否默认展开（从项目详情页跳转时为 true）
  defaultExpanded?: boolean;

  // 用于文件名预览的用户昵称
  userNickname?: string;
}
```

### 5.5 数据获取策略

使用 `GET /api/projects/:projectId/shot-tree` 一次性获取完整的集→镜头树，避免级联请求：

```json
{
  "episodes": [
    {
      "id": 1,
      "episode_number": 1,
      "title": null,
      "shots": [
        { "id": 1, "shot_number": 1, "description": "开场全景", "versionCount": 3 },
        { "id": 2, "shot_number": 2, "description": "对话特写", "versionCount": 1 }
      ]
    }
  ]
}
```

选择项目时加载 shot-tree，缓存在本地状态中。

---

## 6. DownloadManagement 改造（增加文件名列）

**改动范围**：表格新增一列

### 6.1 表格列调整

现有列（推测）：选择框、状态、预览/Prompt、操作
新增列：「文件名」，位于「状态」列之后

```
┌──────┬──────┬──────────────────┬──────────┬──────┬──────┐
│ ☐    │ 状态  │ 提示词            │ 文件名    │ 时间  │ 操作  │
├──────┼──────┼──────────────────┼──────────┼──────┼──────┤
│ ☐    │ [完成]│ 开场全景镜头...    │ SN-1-1-C │ 14:30│ [⬇][▶]│
│      │      │                  │ -ZS.mp4  │      │      │
│      │      │                  │ font-mono│      │      │
│      │      │                  │ text-xs  │      │      │
├──────┼──────┼──────────────────┼──────────┼──────┼──────┤
│ ☐    │ [完成]│ 远景过渡...       │ video_100│ 14:25│ [⬇][▶]│
│      │      │                  │ _xxx.mp4 │      │      │
│      │      │                  │ gray-500 │      │      │
└──────┴──────┴──────────────────┴──────────┴──────┴──────┘
```

### 6.2 文件名显示规则

```typescript
// 有规范文件名（关联了镜头）
<span className="font-mono text-xs text-purple-400">{standardFilename}</span>

// 降级文件名（未关联镜头）
<span className="font-mono text-xs text-gray-500">{fallbackFilename}</span>

// 生成中（暂无文件名）
<span className="text-xs text-gray-600">—</span>
```

### 6.3 下载按钮变更

下载时使用规范文件名作为保存文件名：

```typescript
// downloadService.ts 修改
export function triggerBrowserDownload(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '';  // 传入规范文件名
  a.click();
}
```

### 6.4 后端配合

下载任务列表 API 需要返回 `filename` 字段（动态拼接）：

```json
{
  "tasks": [
    {
      "id": 101,
      "filename": "SN-1-1-C-ZS.mp4",
      ...
    }
  ]
}
```

---

## 7. Sidebar 改造

### 7.1 菜单项变更

```typescript
const menuItems: MenuItem[] = [
  { id: 'SINGLE_TASK', label: '单任务生成', path: '/', icon: FilmIcon },
  { id: 'BATCH', label: '批量管理', path: '/batch', icon: PackageIcon },
  { id: 'DOWNLOAD', label: '下载管理', path: '/download', icon: DownloadIcon },
  // ── 分隔线 ──
  { id: 'PROFILE', label: '个人设置', path: '/profile', icon: UserIcon },      // 新增
  { id: 'SETTINGS', label: '系统设置', path: '/settings', icon: SettingsIcon },
  // ── 分隔线 ──
  { id: 'ADMIN', label: '管理后台', path: '/admin', icon: ShieldIcon, adminOnly: true },
];
```

分隔线实现：
```html
<div className="border-t border-gray-800 my-2" />
```

### 7.2 底部用户信息变更

```
现有：
  [头像] admin@seedance.com
         管理员

改为：
  [头像，显示昵称首字母] ZS (昵称)
                        admin@seedance.com

  无昵称时：
  [头像，显示 ?] admin@seedance.com
                 点击设置昵称 → /profile
```

头像首字母显示逻辑：
```typescript
const initial = currentUser?.nickname
  ? currentUser.nickname[0].toUpperCase()
  : '?';
```

### 7.3 昵称未设置提示

首次登录且昵称为空时，在侧边栏底部用户信息区显示一个小提示：

```
┌─ bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 mb-2 ─┐
│  设置昵称以获得更好的文件命名体验                                      │
│  text-xs text-purple-400                                             │
│  → 前往设置 (link to /profile)                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. 类型定义变更

### 8.0 字段命名约定

> **约定**：前端类型定义中的字段名直接映射后端 API 返回的字段名，不做 camelCase 转换。
> - 现有 `User` 类型使用 camelCase（`createdAt` 等），这是历史遗留，保持不变。
> - 新增的业务类型（Episode、Shot、InvitationCode 等）统一使用 snake_case，与后端 API 和数据库字段名一致。
> - `User` 类型的新增字段 `nickname` 不涉及 case 问题（单词无需分隔）。

### 8.1 src/types/index.ts 新增

```typescript
// User 类型扩展（保持现有 camelCase 风格不变）
export interface User {
  id: number;
  email: string;
  nickname?: string;             // 新增
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  credits: number;
  createdAt?: string;
  updatedAt?: string;
  lastCheckInAt?: string;
}

// RegisterCredentials 扩展（M0 邀请码）
export interface RegisterCredentials {
  email: string;
  password: string;
  emailCode: string;
  invitation_code: string;       // 新增：邀请码
}

// 集
export interface Episode {
  id: number;
  project_id: number;
  episode_number: number;
  title?: string;
  description?: string;
  shot_count?: number;           // 查询时聚合
  created_at: string;
  updated_at: string;
}

// 镜头
export interface Shot {
  id: number;
  episode_id: number;
  shot_number: number;
  description?: string;
  prompt?: string;
  reference_image_url?: string;
  preferred_model?: string;      // 推荐模型（如 dreamina_seedance_40_pro）
  status: 'active' | 'archived';
  version_count?: number;        // 查询时聚合
  created_at: string;
  updated_at: string;
}

// 镜头树（用于 ShotSelector）
export interface ShotTreeEpisode {
  id: number;
  episode_number: number;
  title?: string;
  shots: ShotTreeShot[];
}

export interface ShotTreeShot {
  id: number;
  shot_number: number;
  description?: string;
  versionCount: number;
}

// Project 类型扩展
export interface Project {
  // ... 现有字段 ...
  code?: string;                 // 新增：项目代号
}

// Task 类型扩展
export interface Task {
  // ... 现有字段 ...
  shot_id?: number;              // 新增
  version_label?: string;        // 新增
}

// 即梦账号摘要（普通用户）
export interface SessionAccountSummary {
  total: number;
  available: number;
  unavailable: number;
}

// 邀请码（M0 管理端）
export interface InvitationCode {
  id: number;
  code: string;
  note?: string;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usedBy: InvitationUsage[];
}

export interface InvitationUsage {
  user_id: number;
  email: string;
  used_at: string;
}

// 管理员统计面板类型（M5）
export interface MemberActivity {
  id: number;
  email: string;
  nickname?: string;
  role: 'user' | 'admin';
  videoCount: number;
  lastActiveAt?: string;
}

export interface RecentTask {
  id: number;
  userNickname?: string;
  userEmail: string;
  projectName?: string;
  modelType?: string;
  status: string;
  created_at: string;
}
```

---

## 9. 路由变更汇总

### App.tsx 新增路由

```tsx
// 新增 import
import ProfilePage from './pages/ProfilePage';
import ProjectDetailPage from './pages/ProjectDetailPage';

// 新增路由（在现有受保护路由之后）
<Route
  path="/profile"
  element={
    <ProtectedRoute currentUser={currentUser}>
      <MainLayout currentUser={currentUser} onLogout={handleLogout}>
        <ProfilePage />
      </MainLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/projects/:id"
  element={
    <ProtectedRoute currentUser={currentUser}>
      <MainLayout currentUser={currentUser} onLogout={handleLogout}>
        <ProjectDetailPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

AdminDashboard 不需要独立路由——通过 AdminPage 内部 Tab 切换实现。

---

## 10. 文件清单汇总

### 新建文件

| 文件 | 说明 |
|------|------|
| `src/components/Modal.tsx` | 通用弹窗组件 |
| `src/components/ConfirmDialog.tsx` | 确认对话框 |
| `src/components/Toast.tsx` + `ToastProvider` | 通知系统 |
| `src/components/EmptyState.tsx` | 空状态组件 |
| `src/components/ShotSelector.tsx` | 级联镜头选择器 |
| `src/pages/ProfilePage.tsx` | 个人设置页 |
| `src/pages/ProjectDetailPage.tsx` | 项目详情页（集/镜头管理） |
| `src/services/userService.ts` | 用户 profile API |
| `src/services/adminService.ts` | 管理统计 API + 邀请码管理 API |
| `src/components/admin/InvitationCodeTab.tsx` | 邀请码管理 Tab |
| `src/components/admin/DashboardTab.tsx` | 统计面板 Tab |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | User 增加 nickname、RegisterCredentials 增加 invitation_code、新增 Episode/Shot/ShotTree/InvitationCode/MemberActivity/RecentTask 类型、Project 增加 code、Task 增加 shot_id/version_label |
| `src/pages/RegisterPage.tsx` | 增加邀请码输入框、URL 参数自动填充 |
| `src/services/authService.ts` | register() 增加 invitation_code 参数 |
| `src/App.tsx` | 新增 /profile、/projects/:id 路由 |
| `src/components/Sidebar.tsx` | 新增个人设置菜单项、底部显示昵称、昵称未设置提示 |
| `src/pages/Settings.tsx` | SessionID 区域按角色条件渲染 |
| `src/pages/AdminPage.tsx` | 新增 Tab 切换（统计面板 / 用户管理 / 邀请码管理） |
| `src/pages/SingleTaskPage.tsx` | 集成 ShotSelector 组件 |
| `src/pages/BatchManagement.tsx` | draft 行增加镜头选择列 |
| `src/pages/DownloadManagement.tsx` | 表格增加文件名列 |
| `src/services/projectService.ts` | 新增 episodes/shots CRUD + shot-tree API |
| `src/services/settingsService.ts` | 处理两种响应格式（完整列表 / 摘要） |
| `src/services/downloadService.ts` | triggerBrowserDownload 支持自定义文件名 |

---

## 11. 实施优先级

```
第零批（安全，最高优先级 M0）：
  0a. 类型定义：RegisterCredentials 增加 invitation_code、新增 InvitationCode 类型
  0b. RegisterPage 改造：增加邀请码输入框 + URL 参数支持
  0c. authService 改造：register() 增加 invitation_code 参数
  0d. AdminPage 邀请码管理 Tab：InvitationCodeTab + adminService 邀请码 API

第一批（基础，阻塞后续）：
  1. 公共组件：Modal + ConfirmDialog + Toast + EmptyState
  2. 类型定义变更：src/types/index.ts（Episode/Shot/MemberActivity/RecentTask 等）
  3. ProfilePage + userService
  4. Sidebar 改造
  5. Settings 条件渲染

第二批（核心功能）：
  6. ProjectDetailPage + projectService 扩展
  7. ShotSelector 组件
  8. SingleTaskPage 集成 ShotSelector
  9. BatchManagement 集成 ShotSelector

第三批（完善）：
  10. AdminPage 统计面板 Tab + adminService 统计 API
  11. DownloadManagement 文件名列
```

---

## 附录 A：响应式适配要点

### A.1 断点策略

沿用现有 Tailwind 默认断点，与 Sidebar 的 `lg:` 断点保持一致：

| 断点 | 宽度 | 场景 |
|------|------|------|
| 默认 | <768px | 手机竖屏 |
| `md:` | >=768px | 平板 / 手机横屏 |
| `lg:` | >=1024px | 桌面（侧边栏展开） |

### A.2 各页面响应式方案

**ProfilePage**：
- 移动端：`max-w-2xl` 自然收窄，即梦账号摘要三卡片改为 `grid-cols-1`
- 桌面端：三卡片 `grid-cols-3`

**AdminDashboard**：
- 移动端：StatCard `grid-cols-1`，表格横向滚动 `overflow-x-auto`
- 平板：StatCard `grid-cols-2`
- 桌面：StatCard `grid-cols-4`

**ProjectDetailPage**：
- 移动端：集标题栏操作按钮收入 `...` 菜单（DropdownMenu），镜头表格简化为卡片列表
- 桌面：完整表格 + hover 显示操作按钮
- 版本网格：移动端 `grid-cols-2`，平板 `grid-cols-3`，桌面 `grid-cols-4`

**ShotSelector**：
- `inline` 模式：移动端三个下拉纵向排列（默认），桌面可横向排列
- `compact` 模式：无变化（始终单下拉）

**DownloadManagement**：
- 移动端：文件名列隐藏（`hidden md:table-cell`），下载时仍使用规范文件名
- 桌面：正常显示

### A.3 移动端特殊处理

侧边栏在移动端为抽屉模式（现有逻辑），新增的个人设置入口在移动端顶部 header 增加用户头像按钮，点击跳转 `/profile`。

---

## 附录 B：组件拆分详细方案

### B.1 ProfilePage 拆分

```
src/pages/ProfilePage.tsx              — 页面容器
  ├── src/components/AvatarCircle.tsx   — 可复用头像组件（昵称首字母 + 渐变背景）
  │   Props: nickname?: string, size: 'sm'|'md'|'lg'
  │   复用于：Sidebar 底部、AdminDashboard 成员表、ProjectDetailPage 版本卡片
  └── (内联) NicknameForm               — 昵称编辑表单（局部状态，不需要独立文件）
```

### B.2 AdminDashboard 拆分

```
src/pages/AdminPage.tsx                — 页面容器（三个 Tab 切换）
  ├── (内联) AdminTabBar               — Tab 导航（统计面板 / 用户管理 / 邀请码管理）
  ├── (现有) UserManagementTab         — 用户管理（现有代码提取为函数组件）
  └── src/components/admin/
      ├── DashboardTab.tsx             — 统计面板 Tab
      ├── InvitationCodeTab.tsx        — 邀请码管理 Tab（M0）
      │   ├── (内联) InvitationCodeTable    — 邀请码列表 + 展开使用记录
      │   └── (内联) CreateInvitationModal  — 生成邀请码弹窗（基于 Modal）
      ├── StatCard.tsx                 — 统计卡片（从 AdminPage 提取）
      │   Props: title, value, icon, color
      │   复用于：ProfilePage 即梦账号摘要
      ├── MemberActivityTable.tsx      — 成员活动表格
      └── RecentTasksTable.tsx         — 最近生成记录表格
```

### B.3 ProjectDetailPage 拆分

```
src/pages/ProjectDetailPage.tsx        — 页面容器 + 数据加载
  ├── (内联) ProjectHeader             — 项目标题 + 代号编辑
  ├── src/components/project/
  │   ├── EpisodeAccordion.tsx         — 可折叠集组件
  │   │   Props: episode, shots, onCreateShot, onEditEpisode, onDeleteEpisode
  │   ├── ShotTable.tsx                — 镜头表格
  │   │   Props: shots, onGenerate, onViewVersions, onEdit, onDelete
  │   ├── ShotVersionGrid.tsx          — 版本卡片网格
  │   │   Props: versions, shotId
  │   ├── ShotEditModal.tsx            — 镜头编辑弹窗（基于 Modal）
  │   │   Props: shot?, episodeId, onSave, onCancel
  │   └── EpisodeCreateInline.tsx      — 内联新建集
  │       Props: projectId, nextNumber, onCreate, onCancel
  └── src/components/AvatarCircle.tsx  — 复用
```

### B.4 ShotSelector 拆分

```
src/components/ShotSelector.tsx        — 主组件，处理两种 mode
  ├── (内联) ShotSelectorInline        — inline 模式（三级下拉 + 预览）
  ├── (内联) ShotSelectorCompact       — compact 模式（单按钮 + Modal）
  └── (内联) FilenamePreview           — 文件名预览区
```

不需要进一步拆分，单文件约 200-300 行可控。

---

## 附录 C：行业设计借鉴对照

| 我们的设计 | 借鉴来源 | 具体借鉴点 |
|-----------|---------|-----------|
| ProjectDetailPage 的集/镜头树 | **Kitsu** 镜头列表页 | Kitsu 用表格视图展示镜头，每行显示缩略图 + 各任务类型状态色块。我们简化为：每行显示编号、描述、版本数、操作按钮。省略了 Kitsu 的多任务类型列（因为我们只有"视频生成"一种任务类型）。 |
| 版本卡片网格 | **Kitsu** 预览文件历史 | Kitsu 的任务详情面板中有预览文件列表（revision 递增）。我们用卡片网格展示，每张卡片包含视频缩略图 + 版本号 + 用户 + 时间，更适合视觉对比。 |
| AdminDashboard 表格式管理 | **ShotGrid** 详情页 | ShotGrid 以类电子表格的列表视图著称，支持内联编辑和列排序。我们的成员活动表和最近任务表采用类似的表格布局，但不做内联编辑（保持简洁）。 |
| Settings 按角色渲染 | **Figma** 权限 UI | Figma 的权限界面以简洁著称——不同角色看到不同的设置选项，无需复杂的权限矩阵。我们的 admin 看完整管理 / user 看摘要，同样追求简洁。 |
| 文件名列显示格式 | **Netflix VFX** 命名规范 | Netflix 使用 `{showID}_{episode}_{shot}_{version}` 格式。我们在下载管理页的文件名列以 `font-mono` 等宽字体展示 `SN-1-1-C-ZS.mp4`，各段对齐，视觉上接近 Netflix 的规范化风格。规范文件名用紫色强调，降级文件名用灰色弱化，让用户直观区分。 |
| ShotSelector 级联选择 | **StudioBinder** Shot Tagging | StudioBinder 允许在剧本旁快速创建镜头。我们的 ShotSelector 在生成页以可折叠区域嵌入，选中镜头后自动填充预设 prompt，类似 StudioBinder 的"点击台词自动添加镜头"的快捷交互。 |
| 权限模型简洁性 | **RBAC 最佳实践** | 行业建议"初期从 2-3 个角色开始"。我们的 admin/user 二元角色 + 前端条件渲染，避免了角色爆炸，符合 Oso 等权限框架推荐的最佳实践。 |

---

## 附录 D：状态管理详细方案

### D.1 全局状态变更（AppContext）

**不需要大幅修改 AppContext**。仅需：

1. `User` 类型新增 `nickname` 字段（类型定义层面）
2. 新增 `refreshUser` 方法供 ProfilePage 昵称更新后刷新全局用户状态

```typescript
// App.tsx 中新增
const refreshUser = useCallback(async () => {
  try {
    const user = await getCurrentUser();
    setCurrentUser(user);
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
}, []);

// 通过 props 传递给 ProfilePage
<ProfilePage onNicknameUpdated={refreshUser} />
```

### D.2 各页面本地状态

**ProfilePage**：
```typescript
const [nickname, setNickname] = useState(currentUser?.nickname || '');
const [saving, setSaving] = useState(false);
const [validationError, setValidationError] = useState('');
const [accountSummary, setAccountSummary] = useState<SessionAccountSummary | null>(null);
```

**AdminDashboard（Tab 内）**：
```typescript
const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');
const [members, setMembers] = useState<MemberActivity[]>([]);
const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
const [dashboardLoading, setDashboardLoading] = useState(true);
```

**ProjectDetailPage**：
```typescript
const [project, setProject] = useState<Project | null>(null);
const [episodes, setEpisodes] = useState<EpisodeWithShots[]>([]);
const [expandedEpisodeIds, setExpandedEpisodeIds] = useState<Set<number>>(new Set());
const [expandedShotVersions, setExpandedShotVersions] = useState<number | null>(null);
const [editingShot, setEditingShot] = useState<Shot | null>(null);
const [showShotModal, setShowShotModal] = useState(false);
const [creatingEpisode, setCreatingEpisode] = useState(false);
const [projectCode, setProjectCode] = useState('');
const [codeEditing, setCodeEditing] = useState(false);
```

**ShotSelector**：
```typescript
const [expanded, setExpanded] = useState(defaultExpanded || false);
const [projects, setProjects] = useState<Project[]>([]);
const [shotTree, setShotTree] = useState<ShotTreeEpisode[]>([]);
const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(value?.projectId);
const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | undefined>(value?.episodeId);
const [selectedShotId, setSelectedShotId] = useState<number | undefined>(value?.shotId);
const [estimatedVersion, setEstimatedVersion] = useState<string>('');
```

### D.3 数据获取时机

| 组件 | 触发时机 | API 调用 |
|------|---------|---------|
| ProfilePage | mount | `GET /api/user/profile` + `GET /api/settings/session-accounts` |
| AdminDashboard | Tab 切换到 dashboard | `GET /api/admin/members` + `GET /api/admin/recent-tasks` |
| AdminDashboard | timeRange 变更 | `GET /api/admin/members?range={range}` |
| ProjectDetailPage | mount (from URL params) | `GET /api/projects/:id` + `GET /api/projects/:id/episodes`（含镜头） |
| ProjectDetailPage | 展开版本 | `GET /api/shots/:id/versions` |
| ShotSelector | 用户选择项目 | `GET /api/projects/:id/shot-tree` |
| ShotSelector | 用户选择镜头 | 本地计算版本号预估（从 shot-tree 的 versionCount） |
