# CHANGELOG

## 0.2.1 — 2026-10-30

- **连通性保障**：fetch 被端点 CORS 拦截时（如 open.bigmodel.cn `/chat/completions` 预检不带 `Access-Control-Allow-*` 头）自动降级 Obsidian `requestUrl`（主进程发起，无 CORS）；HTTP 错误不降级、流式已输出不重试
- **联通测试**：模型面板「⚡ 测试当前模型联通」按钮——用当前厂商 + 具体模型 id（不回退内置列表）+ 当前 Key 发最小 ping，内联显示 ✓ 耗时 / ✗ 服务端真实错误；设置页「测试连接」复用同一实现
- **在线模型列表**：模型选择旁「↻ 获取模型列表」从各家 `/models` 接口拉取该 Key 实际可用模型（`customModels` 覆盖内置列表，可一键「重置」恢复）
- **侧边栏内联 API Key**：面板内直接填写当前厂商 Key（密码型/明文切换/即时保存/已配置徽标）；模型栏在 Key 为空时显示「未配置 Key」警示
- **运维**：新增命令「重启插件（加载最新代码）」；模型面板显示运行版本号；修复部署管道掩盖构建失败的问题
- 修复：非流式多轮工具文本覆盖；推理模型空回复被误判为联通失败

## 0.2.0 — 2026-10-29

- **Agent 化重构**：OpenAI 兼容 function calling 工具循环（`agent/AgentRunner` + `ToolExecutor`），插件升级为 Obsidian 内的工作 Agent 助理
- **六个笔记库工具**：`search_notes`（全文检索排序）/ `read_note`（路径·标题智能解析+截断）/ `list_recent_notes` / `create_note` / `append_note` / `replace_note_content`
- **写入权限三档**：只读 / 每次确认（默认，含内容预览）/ 自动写入
- **结构优化**：统一 SSE 聚合器（delta/cumulative 正文 + tool_calls 分片拼装，合并两处重复解析）；UI 逻辑抽为 `useChatController` / `useConversationHistory` hooks；抽出 `ModelPanel` 组件
- **UI**：工具调用步骤块（可折叠）、阶段状态（思考中→检索→撰写）、快捷指令、@当前笔记 按对话芯片、历史删除（系统废纸篓）、「总结当前笔记（Agent）」命令
- **迁移**：新插件 id `copilot-agent-cn` 与旧版并存；首次启用自动从旧版 `copilot-cn/data.json` 导入设置与 API Key（只读），设置页可手动重导
- 测试体系：sse / agent-runner / vault-tools / migrate / models-list / model-panel / apikey-field / connection 等套件

## 0.1.1 及更早（旧版 Copilot CN）

见旧仓库 `ROCKCHENWEI/Copilot-CN`：MiniMax/Kimi/GLM 三厂商侧栏聊天插件，React + esbuild + vitest。
