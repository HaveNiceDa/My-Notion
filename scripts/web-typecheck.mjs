#!/usr/bin/env node
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cwd = process.cwd();
const staleNextDevTypes = join(cwd, ".next", "dev", "types");

// Next 16 会把 dev typegen 加入 tsconfig；类型检查前清理 stale dev validator，避免已删除路由残留引用。
rmSync(staleNextDevTypes, { recursive: true, force: true });

const result = spawnSync("tsc", ["--noEmit"], {
  cwd,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
