# CLI 授权链路加固与配置写入修复

## 背景

本地真实测试已走通 `my-notion auth login --profile local` 和文档创建链路，但暴露出三个后续问题：

- 授权 URL 同时携带 `user_code` 和 `device_code`，其中 `device_code` 是临时敏感凭据，不应进入浏览器 URL。
- 未登录用户打开 CLI 授权页时，需要更自然地先登录再回到授权页。
- 默认 `~/.my-notion/config.json` 在本机出现 `EPERM`，需要比临时 HOME 更可靠的持久化与诊断能力。

## 本次改动

- 授权链接改为只包含 `user_code`，`device_code` 只由 CLI 本地持有并用于轮询。
- 新增 CLI 授权会话查询 API，授权页展示 machine、profile、scopes、过期时间等安全元信息。
- Web proxy 保护 `/cli/auth` 和 `/:locale/cli/auth`，未登录用户先走 Clerk 登录，登录后回到原授权页。
- Convex Device Flow 会话增加 decision attempt 记录和轻量限流，降低短码重复提交风险。
- CLI 配置写入改为动态路径、`MY_NOTION_CONFIG_PATH` override、`0700` 目录、`0600` 文件、原子写入和 `EPERM` 修复提示。
- 默认配置路径从 `~/.my-notion/config.json` 调整到沙箱更友好的 `~/.local/share/my-notion/config.json`；旧路径兼容逻辑已移除。
- 补充 CLI 配置写入和 Device Flow 输出相关单测。

## 安全结论

- `user_code` 是给用户核对的短码，不用于最终换取 token。
- `device_code` 是一次性临时凭据，授权页和浏览器历史中不再出现它。
- 长期 CLI token 仍只在 poll 成功后返回给 CLI 并保存到本机配置；服务端仅保存 token hash。

## 后续验证

- 需要运行 CLI/Web typecheck、test、build、lint。
- 需要重新跑一次本地真实 Device Flow，确认未登录回跳和默认配置写入都符合预期。
