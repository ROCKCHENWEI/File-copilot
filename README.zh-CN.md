# File-copilot

中文 | **[English](README.md)**

> 「Obsidian 侧边栏里的中文 AI 助手 —— MiniMax / Kimi / GLM，开箱即用。」

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-7C3AED.svg)](https://obsidian.md)
[![Models](https://img.shields.io/badge/Models-MiniMax%20%7C%20Kimi%20%7C%20GLM-blueviolet)](#支持的模型与服务商)

**File-copilot** 是一个 Obsidian 社区插件，把国内主流大模型（MiniMax、Kimi、GLM/智谱）装进 Obsidian 右侧栏。不用切换窗口、不用复制粘贴，直接在笔记旁边对话——总结、润色、生成大纲、就着当前笔记提问。

- 🇨🇳 **面向中文用户**：默认中文、中文系统提示词、中文界面。
- 🔌 **三家服务商、一个界面**：MiniMax / Kimi / GLM，OpenAI 兼容协议，模型随时切换。
- 🎨 **Obsidian 原生 UI**：精炼的页头 / 模型栏 / 消息流 / 输入框，跟随 Obsidian 明暗主题。
- 🔒 **隐私优先**：API Key 默认不落盘；对话默认不自动保存；附带笔记内容前会明确提示。
- ⚡ **流式输出 + Markdown**：逐字显示，支持代码块、表格、引用、链接。

---

## 目录

- [产品介绍](#产品介绍)
- [核心特性](#核心特性)
- [支持的模型与服务商](#支持的模型与服务商)
- [安装](#安装)
- [配置](#配置)
- [使用](#使用)
- [隐私与安全](#隐私与安全)
- [常见问题](#常见问题)
- [开发者 / 从源码构建](#开发者--从源码构建)
- [发布到 Obsidian 社区市场](#发布到-obsidian-社区市场)
- [许可证](#许可证)

---

## 产品介绍

在 Obsidian 里写笔记时，常常需要 AI 帮忙：把一段草稿润色成正式文、把零散要点扩成大纲、解释一段代码、就着当前笔记问个问题。File Copilot 把这件事留在了 Obsidian 内部——点一下左侧栏的机器人图标，右侧就弹出对话面板，选好服务商和模型，直接开聊。

它不绑定某一家模型：MiniMax、Kimi、GLM（智谱）三家随时可切，谁的回答好就用谁。所有交互都通过各家官方的 OpenAI 兼容接口完成，不经过任何第三方中转。

**File-copilot**（原名 Copilot CN Agent）——Obsidian 内的工作 Agent 助理：模型可通过工具检索、读取、新建、追加与整理你的笔记——总结当前笔记、跨库找资料、起草并创建新笔记，全过程在侧边栏可视化展示，写入操作按权限档位受控执行。

界面遵循 Obsidian 的设计语言：紧凑的页头放置「最近对话 / 新对话 / 更多操作」，一条常驻的模型栏显示当前服务商与模型，点开即切换；消息流带头像与时间戳，代码块带语言标签和一键复制；底部是统一的输入框，回车发送、Shift+回车换行。

## 核心特性

| 能力 | 说明 |
|------|------|
| 多服务商 | MiniMax、Kimi、GLM（智谱）三家，OpenAI 兼容，模型下拉即时切换 |
| **Agent 工具** | 模型可调用 `search_notes` / `read_note` / `list_recent_notes` 检索阅读笔记库；`create_note` / `append_note` / `replace_note_content` 写入笔记（受权限档位管控） |
| 写入权限三档 | **只读**（禁止写入）/ **每次确认**（默认，弹窗预览内容）/ **自动写入**（仅 Notice 提示） |
| 工具过程可视化 | 回复前的工具调用以可折叠步骤块展示：工具名、参数、状态、结果摘录 |
| 快捷指令 | 空对话时一键填入：总结当前笔记 / 查找相关笔记 / 起草新笔记 / 润色文字 |
| @当前笔记 芯片 | 输入框旁按对话临时开关「附带当前活动笔记」，不必进设置 |
| 流式输出 | 逐字显示模型回复（可在设置中关闭） |
| Markdown 渲染 | 代码块（带复制）、表格、引用、链接自动在新标签打开 |
| 附带当前笔记 | 可选：发送时自动把当前活动笔记的正文摘录随问题一起发给模型 |
| 选中文本提问 | 选中笔记里的文字 → 命令「将选中文本添加到 Agent 对话」→ 直接带入输入框 |
| 对话历史 | 一键「明文保存对话」为 JSON，或「导出 Markdown」到 vault 指定目录 |
| Obsidian 原生 UI | 全部颜色 / 字号 / 圆角走 Obsidian 主题变量，明暗主题自适应 |
| 隐私默认 | API Key 默认仅会话内有效、不写盘；对话默认不自动保存 |

## 支持的模型与服务商

| 服务商 | 模型 | API 端点 | 申请 Key |
|--------|------|----------|----------|
| **MiniMax** | `MiniMax-M2.7` · `MiniMax-M2.5` · `MiniMax-M2.1` · `MiniMax-M2.5-highspeed` | `https://api.minimax.io/v1` | [MiniMax 开放平台](https://platform.minimaxi.com/) |
| **Kimi** | `kimi-for-coding` · `kimi-k2.5` · `kimi-k2-0905-preview` · `kimi-k2-turbo-preview` | `https://api.kimi.com/coding/v1` | [Kimi](https://kimi.com/) |
| **GLM（智谱）** | `glm-5.2` · `glm-5.1` · `glm-4.7` · `glm-5-turbo` · `glm-4.5-air` | `https://open.bigmodel.cn/api/coding/paas/v4` | [智谱 BigModel](https://open.bigmodel.cn/) |

> 模型列表见 [`src/constants.ts`](src/constants.ts) 中的 `PROVIDERS`；新增模型只需改这一处。
> GLM 与 Kimi 走各自的 Coding Plan 端点，请用对应套餐的 Key。

---

## 安装

> 📦 三种安装方式见下；上架 Obsidian 社区市场的发布步骤见文末 [发布到 Obsidian 社区市场](#发布到-obsidian-社区市场)。

### 方式一：Obsidian 官方社区市场（上架后）

（插件提交并通过 Obsidian 审核后可用）

1. Obsidian → **设置 → 社区插件 → 浏览**。
2. 搜索 **“File-copilot”**。
3. 点击安装 → 启用。

### 方式二：BRAT（推荐，上架前最方便）

[BRAT（Beta Reviewers Auto-update Tool）](https://github.com/TfTHacker/obsidian42-brat) 可以从任意 GitHub 仓库安装尚未上架的插件，并自动跟随 Release 更新。

1. 先在 Obsidian 社区插件市场安装并启用 **BRAT**。
2. 打开 BRAT 设置 → **Add Beta plugin**。
3. 填入仓库地址：`ROCKCHENWEI/File-copilot`（替换为你的实际地址）。
4. 点击 **Add Plugin** → 回到 **设置 → 社区插件** 启用 **File-copilot**。

### 方式三：手动安装

从 [Releases](../../releases) 下载最新版的三个文件：

- `main.js`
- `manifest.json`
- `styles.css`

放到你的 vault：

```
<vault>/.obsidian/plugins/copilot-cn/
```

然后 Obsidian → **设置 → 社区插件** → 关闭「安全模式」（如未关）→ 找到 **File-copilot** → 启用。

---

## 配置

启用插件后：**设置 → File Copilot**。

1. **API Key**：在「API Key 配置」里填入你使用的服务商 Key（MiniMax / Kimi / GLM 各一个输入框，密码型）。
   - 默认 Key **不会写入本地**，重启 Obsidian 后需要重新输入。
   - 若想本地保存（明文），打开「本地保存 API Key（明文）」开关——会弹出确认。
2. **默认服务商 / 默认模型**：选新对话默认使用哪家、哪个模型。
3. **聊天参数**：温度、最大输出 Token、是否流式输出、系统提示词等。
4. **附带当前活动笔记**：开启后，每次发送会自动把当前活动笔记的正文摘录附在问题后（摘录长度可设上限）。
5. **Agent 工具与权限**：开关「启用笔记库工具」；选择写入权限档位（只读 / 每次确认 / 自动写入）；设置最大工具轮数（默认 6）与 `read_note` 截断上限。
6. **Vault 存储路径**：对话 JSON 与导出 Markdown 的存放目录（相对库根，默认 `file-copilot/conversations` 与 `file-copilot/exports`）。
7. **测试连接**：每个服务商 Key 旁有「测试连接」按钮，用最小请求验证 Key 与模型是否可用。

> 🔄 **从旧版 Copilot CN (v0.1.x) 升级**：插件 id 为 `copilot-agent-cn`，可与旧版并存。首次启用时若本插件尚无数据，会自动从旧版 `copilot-cn/data.json` 导入设置与 API Key（只读旧数据）；也可在设置底部「从旧版 Copilot CN 导入配置」手动重导。

## 使用

- **打开侧边栏**：点左侧栏的 **机器人图标**，或命令面板（`Ctrl/Cmd + P`）搜 **“打开 File Copilot 侧边栏”**。面板出现在右侧栏。
- **切换模型**：点页头下方的 **模型栏**（显示「服务商 · 模型」）→ 展开下拉，选择服务商与模型。
- **发送消息**：在底部输入框输入 → `Enter` 发送、`Shift + Enter` 换行；生成中可点 **停止**。
- **就着笔记提问**：在笔记中选中一段文字 → 命令面板搜 **“将选中文本添加到 Agent 对话”** → 文本自动带入输入框（可继续补充问题后发送）。若开启了「附带当前活动笔记」，发送时还会附上整篇笔记的摘录。
- **最近对话**：页头 **时钟图标** → 展开最近对话列表，点击即可载入。
- **更多操作**：页头 **⋮ 图标** → 「明文保存对话」/「导出 Markdown」/ 新对话也可用 **+ 图标**。
- **复制**：每条消息悬停显示 **复制** 图标；代码块右上角有 **复制代码**。
- **让 Agent 干活**：直接下指令，如「总结一下我这周写的周报」「找一下和 4DGS 相关的笔记并列个清单」「把今天的会议要点整理成新笔记《会议纪要-1015》」。模型会先调用工具（回复上方出现可折叠的工具步骤块），确认写入类操作后再落盘。
- **快捷指令**：空对话时输入框上方有四个快捷按钮；「总结当前笔记」也会自动开启 @当前笔记。
- **总结当前笔记命令**：命令面板搜 **“总结当前笔记（Agent）”**，一键填好提示词并附上当前笔记。
- **删除历史对话**：最近对话列表中，悬停条目右侧出现 **垃圾桶图标**，点击移入系统废纸篓。

> GLM 的 `glm-5.2` 等是**推理模型**，会先「思考」再给出答案，因此首字可能稍慢；插件只展示最终回答，不展示思考过程。

## 隐私与安全

- **API Key 默认仅会话内有效**：不开启「本地保存」时，Key 不写入插件数据；若历史数据里残留明文 Key，加载时会自动清除。
- **对话默认不自动保存**：只有你主动点「明文保存对话」或「导出 Markdown」时，内容才会写入 vault（会弹确认或明确告知落盘路径）。
- **附带笔记内容**：开启「附带当前活动笔记」后，笔记正文摘录会随提问发送给你选定的服务商。若笔记含敏感信息，请勿开启。
- **请求直连官方**：所有请求直连各家官方 OpenAI 兼容端点，不经过任何第三方中转。

## 常见问题

- **发消息报“请先配置 API Key”**：到设置里给当前选中的服务商填入 Key。
- **报 401 / 鉴权失败**：Key 拼错、过期，或用了与端点不匹配的套餐（如 GLM 用了非 Coding Plan 的 Key）。
- **GLM 回复为空 / 很慢**：推理模型会先思考，请调大「最大输出 Token」（默认 4096，建议保持或更高）。
- **改了模型列表不生效**：模型下拉来自 `src/constants.ts` 的 `PROVIDERS`，改完需重新 `npm run build` 并更新 vault 里的 `main.js`。
- **Kimi 报 CORS**：本插件对 Kimi 走 Obsidian 的 `requestUrl`（规避浏览器 CORS），GLM / MiniMax 走 `fetch`；若仍有网络问题，检查代理 / 网络。

---

## 开发者 / 从源码构建

```bash
git clone https://github.com/ROCKCHENWEI/File-copilot.git
cd obsidian-copilot-cn
npm install          # 安装依赖
npm run dev          # esbuild watch：改源码自动重建 main.js
npm run build        # 生产构建（tsc 类型检查 + esbuild 压缩，产出 main.js）
npm test             # Vitest 单元测试
```

**部署到本地 vault 调试**：把构建产物放进 vault 的插件目录（不要覆盖 `data.json`，那里存着用户的 Key / 设置）：

```bash
cp main.js styles.css manifest.json <vault>/.obsidian/plugins/copilot-cn/
```

更省事的做法是把这三个文件软链到本仓库，`npm run dev` 即时生效：

```bash
ln -sf "$PWD/main.js"      <vault>/.obsidian/plugins/copilot-cn/main.js
ln -sf "$PWD/styles.css"   <vault>/.obsidian/plugins/copilot-cn/styles.css
ln -sf "$PWD/manifest.json" <vault>/.obsidian/plugins/copilot-cn/manifest.json
```

改完后在 Obsidian 里 `Ctrl/Cmd + P` → **Reload app without saving** 重载即可。

目录职责、数据流、扩展指引见 [docs/copilot-cn-plugin.md](docs/copilot-cn-plugin.md)。

## 发布到 Obsidian 社区市场

发布流程（GitHub Release 驱动）：

1. **发布前核对**（均已填好，再确认一次即可）：
   - [`manifest.json`](manifest.json) 的 `author` / `authorUrl`。
   - 仓库地址：`ROCKCHENWEI/File-copilot`。
   - [`LICENSE`](LICENSE) 版权署名。
2. **确认 `manifest.json` 的 `version`**（如 `0.1.1`）与 [`versions.json`](versions.json) 中的映射一致。
3. **打 tag 并推送**：`git tag 0.1.1 && git push origin 0.1.1`。
4. GitHub Actions（[`.github/workflows/release.yml`](.github/workflows/release.yml)）会自动 `npm ci && npm run build`，并把 `main.js`、`manifest.json`、`styles.css` 附到该 tag 的 Release 上——这正是 BRAT 与 Obsidian 市场所需的产物。
5. **提交到社区市场**：按 [Obsidian 插件提交指南](https://docs.obsidian.md/Plugins/Releasing/Submit+a+plugin) 向 [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases) 提 PR，等待审核。

> 安装该插件需要三个文件：`main.js`、`manifest.json`、`styles.css`——与本仓库 Release 产物一致。

## 许可证

[MIT](LICENSE)。
