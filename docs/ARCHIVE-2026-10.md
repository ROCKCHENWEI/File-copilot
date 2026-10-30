# 开发归档 — Copilot CN Agent v0.2.1（2026-10-29 ～ 2026-10-30）

本目录保存本轮开发的完整归档记录。代码与测试以仓库为准，本文汇总过程、决策与遗留事项。

## 1. 项目定位

Obsidian 内的**工作 Agent 助理**：对话之外，模型可通过工具检索、阅读、创建与整理笔记库。
三厂商 MiniMax / Kimi / GLM，全部走官方 OpenAI 兼容端点。基于旧版 Copilot CN v0.1.1（纯聊天插件）重构。

- 开发目录：`~/Documents/VibeCoding/Copilot_CN-261029`（即本仓库）
- 插件 id：`copilot-agent-cn`（与旧版 `copilot-cn` 并存，可灰度试用）
- 部署位置：`main-vault/.obsidian/plugins/copilot-agent-cn/`（已写入 `community-plugins.json` 启用）

## 2. 里程碑时间线

| 时间 | 事项 |
|------|------|
| 10-29 晚 | 基线确认：Cursor/260306 与 VibeCoding/Copilot_CN 两份 v0.1.1 源码逐字节一致（diff 为空），以基线 commit 导入新仓库 |
| 10-29 晚 | v0.2.0 Agent 重构：`agent/` 层（Runner/Executor/6 工具）、统一 SSE 聚合器、UI hooks 化、写入权限三档；75 测试全绿，构建部署 |
| 10-29 深夜 | 侧边栏内联 API Key 输入 + 模型栏未配置警示；修复 settingsRef 过期隐患；79 测试 |
| 10-30 凌晨 | 在线模型列表（`/models` 拉取 + `customModels` 覆盖内置 + ModelPanel 组件化：刷新/重置/API 徽标）；91 测试 |
| 10-30 下午 | 「⚡ 测试当前模型联通」（精确模型 id ping）；100 测试 |
| 10-30 下午 | **CORS 诊断与修复**：实测 open.bigmodel.cn `/chat/completions` 预检不带 CORS 头（`/models` 却带）→ 渲染进程 fetch 被拦报 `Failed to fetch`。实现 fetch TypeError 自动降级 requestUrl（未输出内容时才降级，HTTP 错误/流式中断不重试）；104 测试 |
| 10-30 下午 | **重载缺失修复**：磁盘文件已最新但内存运行旧代码（插件无重载命令）→ 新增「重启插件（加载最新代码）」命令 + 面板版本号 v0.2.1 |
| 10-30 下午 | Key 层问题定位：新填 GLM Key 两端点均 `401 身份验证失败`（无效）；旧 Key 鉴权通过，已引导换回 |
| 10-30 下午 | 归档：清理旧版遗留文档、压缩 git 历史、建 GitHub 仓库 `Copilot-CN-Agent` 并推送 |

## 3. 架构与关键决策

```
src/
├── main.ts                    入口：视图/命令（打开·新建·选中文本·总结笔记·重启插件）/设置/旧版迁移
├── agent/
│   ├── AgentRunner.ts         工具循环：LLM↔工具直到无 tool_calls；超 maxToolRounds 强制无工具收尾
│   ├── prompts.ts             系统提示词 = 用户提示词 + 工具使用规范（双链引用/不编造/拒绝后不重试）
│   └── tools/                 ToolExecutor（只读门禁/参数解析/错误兜底）+ 6 个 vault 工具
├── llm/
│   ├── ChatService.ts         complete(tools)+testConnection+listAvailableModels；fetch↔requestUrl 双通道与自动降级
│   └── sse.ts                 SseAggregator：delta/cumulative 正文 + tool_calls 分片按 index 拼装
├── settings/                  model（sanitize+customModels）/ migrate（旧版只读导入）/ SettingsTab
├── ui/                        AgentView(ItemView) → ChatView → ModelPanel/ApiKeyField/MessageList/ToolSteps/…；状态机在 useChatController
└── utils/                     storage / markdown / vault-path / active-note-context / export
```

关键决策：
- **传输双通道**：Kimi 走 `requestUrl`（绕 CORS）；MiniMax/GLM 走 fetch（真流式），TypeError 且未输出时自动降级 `requestUrl`——对服务商 CORS 策略变化免疫
- **写入审批**：`readonly / confirm(默认,window.confirm+内容预览) / auto(仅Notice)`；被拒后提示模型改为在回复中给内容
- **上下文经济**：工具结果截断 6000 字符、read_note 20000、历史仅回传 user/assistant 文本（工具明细留在当轮）
- **Key 安全**：默认不落盘（会话内有效）；`persistApiKeysLocally` 显式确认后明文保存；迁移只读旧插件数据
- **精确联通测试**：`testConnection` 直传用户选定模型 id（不回退内置列表），HTTP 200 即链路通（推理模型空正文不算失败）

## 4. 测试与验证状态（归档时点）

- `npx tsc --noEmit` 通过；`npm test` **104/104 通过（16 个文件）**
- 覆盖：SSE 聚合、ChatService（流式/非流式/双通道/降级四场景/错误透传）、AgentRunner（循环/上限收尾/错误步骤）、6 个 vault 工具（检索排序/路径解析/写入门禁）、migrate、settings sanitize、ModelPanel/ApiKeyField 交互（jsdom）、联通测试
- 生产构建：`tsc --noEmit && esbuild production`，main.js ≈ 375KB（React 打包）
- 部署核验：vault 三文件与构建产物 `cmp` 逐字节一致；插件已在 `community-plugins.json` 启用

## 5. 实测诊断记录（保留备查）

- open.bigmodel.cn `/models` 预检：**返回** `access-control-allow-origin: app://obsidian.md` 等完整头 → 在线拉模型列表可用
- open.bigmodel.cn `/chat/completions` 预检：HTTP 200 但**无任何** `Access-Control-Allow-*` 头 → 渲染进程 POST 被拦（`Failed to fetch`）
- GLM Key 鉴权（curl 直连，等价主进程）：新 Key `dd392407…` 在 coding/普通两端点均 `1000 身份验证失败`；旧 Key `77697fca…` Coding Plan 端点鉴权通过
- 结论链：`Failed to fetch`（CORS）掩盖了真实错误（401 Key 无效）→ 双修复（降级通道 + 换回有效 Key）后联通正常

## 6. 遗留事项与后续建议

- [ ] **旧 GitHub 仓库 `ROCKCHENWEI/Copilot-CN`**（v0.1.1，public）本轮未做任何改动；如需下线/归档请单独确认（不可逆操作）
- [ ] 本地旧开发副本（`~/Documents/Cursor/260306` 内插件文件、`~/Documents/VibeCoding/Copilot_CN`）保留未删：vault 旧插件 `copilot-cn` 的三个文件仍是**软链指向 Cursor/260306**，删除会直接弄坏旧插件；确认弃用旧插件后再清理
- [ ] vault 内旧插件 `copilot-cn` 仍启用中（两个机器人图标并存）；新插件稳定后建议在设置中停用旧版
- [ ] 如需上架 Obsidian 社区市场：fork `obsidianmd/obsidian-releases` 提 PR（旧版当年因 gh token 缺跨仓库权限未能自动开 PR，需手动）
- [ ] Kimi 通道 `requestUrl` 不支持中止：生成中点「停止」无法中断当次 Kimi 请求（沿袭 v0.1 限制）
- [ ] `docs/` 旧版开发上下文文档 `copilot-cn-plugin.md` 已删除（内容过时且与新架构不符）
