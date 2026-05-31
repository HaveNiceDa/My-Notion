# 2026-05-31 CLI npm beta 发布准备

## 背景

用户希望参考飞书 CLI 的发布方式，把 My-Notion CLI 发布为 npm 包，并让 Skills 能够在线安装。目标包名确定为 `@mynotion/cli`，bin 保持 `my-notion`，首版走 beta。

## 改动

- 将 `packages/my-notion-cli` 包名改为 `@mynotion/cli`，版本设为 `0.1.0-beta.0`。
- 增加 `publishConfig.access = "public"`、`engines.node = ">=20"`、repository/homepage/bugs/keywords。
- 增加发布脚本：
  - `prepack`
  - `pack:dry-run`
  - `release:beta`
  - `release:latest`
  - `sync:skills`
- 新增根脚本 `pnpm sync:skills:package`，将 `packages/my-notion-skills` 同步到 `packages/my-notion-cli/skills`，使 Skills 随 npm 包发布。
- 新增 `my-notion install` 命令：
  - `my-notion install --check`
  - `my-notion install --skills`
  - 输出 CLI 安装、Skills 安装、Human 登录和 Agent 登录命令。
- 新增 `install-command.test.ts` 覆盖安装引导输出。
- 新增根 `LICENSE`、包内 `LICENSE`、包内 `CHANGELOG.md`。
- 更新 README、usage、Skills 文档、release checklist、E2E 脚本中的包名和验证命令。
- 将发布清单补充为必须确认官方 npm registry：`https://registry.npmjs.org/`，避免使用公司内部源发布。

## 验证

- `npm config get registry`：`https://registry.npmjs.org/`。
- `pnpm config get registry`：`https://registry.npmjs.org/`。
- 项目 `.npmrc` 显式配置 `registry=https://registry.npmjs.org/`。
- `pnpm --filter @mynotion/cli typecheck`：通过。
- `pnpm --filter @mynotion/cli test`：通过，6 个测试文件、28 个测试通过。
- `pnpm --filter @mynotion/cli build`：通过。
- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm sync:skills`：通过。
- `pnpm sync:skills:package`：通过。
- `pnpm sync:skills:check`：通过。
- `node scripts/sync-my-notion-package-skills.mjs --check`：通过。
- `npm pack --dry-run`：通过，tarball 包含 `dist`、`README.md`、`docs`、`skills`、`LICENSE`、`CHANGELOG.md` 和 `package.json`。
- tarball 临时安装验证：通过，`my-notion --help`、`my-notion install --check --format json` 正常，`skillsBundled: true`。
- `pnpm e2e:cli`：通过。
- `pnpm e2e:cli:errors`：通过。
- `pnpm e2e:mcp`：通过。

## 待用户手动完成

- npm beta 已发布成功：

```bash
@mynotion/cli@0.1.0-beta.0
```

- 发布后验证已通过：

```bash
npm view @mynotion/cli@beta version bin dist-tags
npx @mynotion/cli@beta --help
npx @mynotion/cli@beta install --check --format json
```

## 注意

- 本轮曾生成本地验证 tarball：`packages/my-notion-cli/mynotion-cli-0.1.0-beta.0.tgz`，后续已按用户要求删除，避免误提交。
- 本地发布 token 配置写在 `packages/my-notion-cli/.npmrc.publish`，该文件已被 `.gitignore` 忽略，不应提交。
- 因为 `0.1.0-beta.0` 是首个 npm 版本，npm registry 自动把 `latest` 也指向该版本；尝试删除唯一版本的 `latest` tag 返回 400。后续发布稳定版 `0.1.0` 后，应将 `latest` 指向稳定版。
