# Seedance Cookie Importer

Chrome 浏览器插件，用于从 Dreamina (capcut.com) 和即梦 (jimeng.jianying.com) 提取 SessionID 和 Cookies，一键导入到 Seedance 平台的 SessionID 账号管理中。

## 功能

- **自动检测** — 点击插件图标后自动提取当前浏览器的 Cookie，无需手动复制粘贴
- **国际版 (Dreamina)** — 提取完整 Cookie（JSON 格式，33+ 个），自动识别区域前缀（sg-/jp-/us- 等）
- **国内版 (即梦)** — 提取 sessionid Cookie
- **两种导入方式**：
  - **一键导入**（推荐）— 直接通过 API 导入到 Seedance 平台，无需切换页面
  - **复制 JSON** — 生成批量导入格式，粘贴到 Seedance 设置页的「批量导入」弹窗
- **平台设置持久化** — 平台地址、认证信息、代理地址保存在浏览器本地，下次无需重新填写

## 安装

### 前提条件

- Chrome 浏览器（版本 88+）
- Seedance 2.0 平台已启动（本地或远程）

### 安装步骤

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本插件所在目录（即包含 `manifest.json` 的 `plugin` 文件夹）
5. 安装完成后，浏览器右上角工具栏会出现紫色图标

> 如果图标未显示，点击工具栏右侧的拼图按钮，找到 "Seedance Cookie Importer" 并点击固定。

## 使用方法

> **重要**：插件有两个独立的操作步骤 —— **「保存设置」** 仅保存配置到浏览器本地，**「一键导入」** 才会将账号发送到 Seedance 平台。两者缺一不可。

### 方式一：一键导入（推荐）

#### 第 1 步：登录源平台

在 Chrome 中登录以下平台之一（或两个都登录）：

- **国际版**：[Dreamina](https://dreamina.capcut.com)
- **国内版**：[即梦](https://jimeng.jianying.com)

#### 第 2 步：配置平台设置（首次使用）

1. 点击浏览器工具栏的插件图标
2. 展开底部的 **「平台设置」**
3. 填写以下配置：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| 平台地址 | Seedance Web 访问地址 | `http://163.7.12.189:5173` |
| 认证 Session ID | Seedance 平台登录凭证 | 在 Seedance 页面按 F12 → Application → Local Storage → `seedance_session_id` |
| 代理地址 | 国际版账号默认代理（可选） | `socks5://user:pass@host:port` |

4. 点击 **「保存设置」**，出现「已保存」提示即配置完成

> **注意**：「保存设置」只会将配置保存在浏览器中，**不会导入账号**。面板顶部有黄色提示说明这一点。

#### 第 3 步：一键导入账号

1. 关闭「平台设置」面板，回到上方账号区域
2. 插件已自动检测到已登录平台的 Cookie，显示 SessionID 和统计信息
3. 可选修改账号名称
4. 点击对应区域的 **「一键导入」** 按钮（紫色火箭按钮）
5. 提示「导入成功」即完成

### 方式二：复制 JSON + 批量导入

适用于无法直连 Seedance 平台的场景。

1. 登录 Dreamina 或即梦，点击插件图标
2. 点击 **「复制 JSON」**（或国内版的「复制」）
3. 打开 Seedance 平台 → **设置** 页面 → 点击 **「批量导入」** 按钮
4. 在弹窗中粘贴 JSON 内容
5. 预览确认后点击 **「确认导入」**

**复制的 JSON 格式示例（国际版）：**

```json
[
  {
    "sessionId": "sg-abc123def456",
    "cookies": "[{\"name\":\"sessionid\",\"value\":\"sg-abc123...\",\"domain\":\".capcut.com\",...}]",
    "versionType": "international",
    "region": "SG",
    "proxyUrl": "socks5://user:pass@host:port",
    "name": "Dreamina SG"
  }
]
```

**复制的 JSON 格式示例（国内版）：**

```json
[
  {
    "sessionId": "domestic_session_id_here",
    "versionType": "domestic",
    "name": "即梦账号"
  }
]
```

## 界面说明

```
┌─────────────────────────────────────┐
│  🍪 Seedance Cookie Importer v1.0.0 │
├─────────────────────────────────────┤
│                                     │
│  🌐 国际版 (Dreamina)              │
│     International   SG              │
│                                     │
│  SessionID  sg-abc123...def456      │
│  Cookies    35 个                    │
│  域名分布   .capcut.com: 28、       │
│             dreamina.capcut.com: 7  │
│                                     │
│  账号名称:  [Dreamina SG         ]  │
│                                     │
│  [📋 复制 JSON]  [🚀 一键导入]     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  🇨🇳 国内版 (即梦)                  │
│     Domestic                        │
│                                     │
│  SessionID  xxxxxxx...xxxxxxx       │
│                                     │
│  账号名称:  [即梦账号            ]  │
│                                     │
│  [📋 复制]      [🚀 一键导入]      │
│                                     │
├─────────────────────────────────────┤
│  ▶ ⚙️ 平台设置                      │
│                                     │
│  （展开后显示）                      │
│  ⚠️ 此处配置仅保存插件设置，         │
│     不会导入账号。保存后请点击        │
│     上方「🚀 一键导入」按钮。        │
│                                     │
│  平台地址:    [http://...        ]  │
│  认证Session: [xxxxxxxxxxxxxxxxx ]  │
│  代理地址:    [socks5://...      ]  │
│                                     │
│  [💾 保存设置]                      │
│  ✅ 设置已保存！请关闭此面板，       │
│     然后点击上方「🚀 一键导入」      │
│     按钮将账号导入到平台。           │
└─────────────────────────────────────┘
```

## Cookie 格式说明

插件导出的 Cookie 采用 Cookie Editor JSON 格式，与 Seedance 平台的 `parseJsonCookiesToPlaywrightCookies()` 完全兼容：

- 自动过滤仅保留 `capcut.com` 相关域名的 Cookie
- 包含 `domain`、`hostOnly`、`sameSite` 等关键字段
- 国际版 Cookie 覆盖 `.capcut.com` 和 `dreamina.capcut.com` 两个域名，满足 shark 反爬绕过要求
- SameSite 自动映射：Chrome API 值（`no_restriction`/`lax`/`strict`）→ Cookie Editor 格式（`None`/`Lax`/`Strict`）

## 常见问题

### 点击插件显示「未检测到 Dreamina 会话」

- 确认已在 Chrome 中登录 [dreamina.capcut.com](https://dreamina.capcut.com) 或 [jimeng.jianying.com](https://jimeng.jianying.com)
- 如果已登录但仍无法检测，尝试刷新对应页面后重新点击插件

### 点击「保存设置」后平台没有收到账号

- **这是正常的**。「保存设置」只保存插件配置到浏览器本地，**不会向平台发送数据**
- 正确操作：保存设置后，回到上方账号区域点击 **「一键导入」** 按钮
- 设置面板中有黄色提示和保存成功后的绿色提示，指引你完成导入

### 一键导入提示「连接失败」

- 检查 Seedance 平台是否已启动
- 检查「平台设置」中的平台地址是否正确（需含端口号，如 `http://163.7.12.189:5173`）
- 如果 Seedance 部署在远程服务器，确保网络可达

### 一键导入提示「请先在"平台设置"中配置认证 Session ID」

- 打开 Seedance 平台并登录
- 按 F12 打开开发者工具 → Application → Local Storage → 找到 `seedance_session_id` 的值
- 将该值填入插件「平台设置」的「认证 Session ID」输入框并保存

### 导入的国际版账号没有配置 Cookie

- 确认登录 Dreamina 时浏览器已接收到完整 Cookie（33+ 个）
- 尝试在 Dreamina 页面刷新后再点击插件提取

### 修改插件代码后如何生效

1. 打开 `chrome://extensions/`
2. 找到 Seedance Cookie Importer，点击刷新按钮（圆形箭头图标）
3. 重新点击浏览器工具栏的插件图标即可看到更新

## 文件结构

```
plugin/
├── manifest.json     # Chrome 扩展清单（Manifest V3）
├── popup.html        # 弹窗界面（暗色主题）
├── popup.js          # Cookie 提取与导入逻辑
├── icons/
│   ├── icon16.png    # 16x16 图标
│   ├── icon48.png    # 48x48 图标
│   └── icon128.png   # 128x128 图标
└── README.md         # 本文档
```

## 技术实现

| 模块 | 说明 |
|------|------|
| Cookie 提取 | `chrome.cookies.getAll()` 从 `capcut.com` + `dreamina.capcut.com` 两个域名读取，合并去重 |
| Cookie 格式化 | 按 Cookie Editor JSON 格式输出，自动映射 SameSite 枚举值 |
| 一键导入 | `POST {platformUrl}/api/settings/session-accounts`，`X-Session-ID` 认证 |
| 复制 JSON | 生成 Seedance 批量导入格式的 JSON 数组，兼容设置页「批量导入」弹窗 |
| 设置持久化 | `chrome.storage.local` 存储 platformUrl / authToken / proxyUrl |
| 国际版识别 | SessionID 前缀匹配 `/^([a-z]{2})-/`，自动提取 region（如 SG/JP/US） |
