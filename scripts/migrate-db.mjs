import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { createClient } from "@libsql/client";

try { loadEnvFile(".env.local"); } catch { /* 本番CIは環境変数を直接渡す */ }
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL と TURSO_AUTH_TOKEN が必要です。");

const client = createClient({ url, authToken });
const hasMigrationTable = (await client.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1")).rows.length > 0;
const applied = hasMigrationTable ? await client.execute("SELECT id FROM schema_migrations") : { rows: [] };
const appliedIds = new Set(applied.rows.map((row) => String(row.id)));
const migrationDir = resolve(process.cwd(), "db/migrations");
const files = (await readdir(migrationDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const columnExists = async (table, column) => {
  const result = await client.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  return result.rows.some((row) => String(row.name) === column);
};

for (const file of files) {
  const id = file.replace(/\.sql$/, "");
  if (appliedIds.has(id)) continue;
  // 初期構築時の旧ID（0001_initial_domain_manager）も既適用として扱う。
  if (id.startsWith("0001_") && (await client.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'domains' LIMIT 1")).rows.length > 0) {
    await client.execute({ sql: "INSERT INTO schema_migrations (id) VALUES (?)", args: [id] });
    console.log(`既適用として記録: ${id}`);
    continue;
  }
  // DDL適用後に履歴記録だけが失敗して再実行されても復旧できるよう、
  // 0002は追加済みの列を検出して履歴だけを記録する。
  if (id === "0002_add_delete_at" && await columnExists("domains", "delete_at")) {
    await client.execute({ sql: "INSERT INTO schema_migrations (id) VALUES (?)", args: [id] });
    console.log(`既適用として記録: ${id}`);
    continue;
  }
  const sql = await readFile(join(migrationDir, file), "utf8");
  await client.executeMultiple(sql);
  await client.execute({ sql: "INSERT INTO schema_migrations (id) VALUES (?)", args: [id] });
  console.log(`適用完了: ${id}`);
}

console.log("データベースのマイグレーション確認完了");
