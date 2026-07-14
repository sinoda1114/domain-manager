import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { getServerEnv } from "@/lib/env";

let client: Client | undefined;
let database: LibSQLDatabase | undefined;

/** Vercelのビルド時には接続せず、最初のDB操作時にだけ初期化する。 */
export function getDatabase(): LibSQLDatabase {
  if (!database) {
    const env = getServerEnv();
    client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    database = drizzle(client);
  }

  return database;
}

export function getDatabaseClient(): Client {
  getDatabase();
  if (!client) throw new Error("Database client was not initialized.");
  return client;
}
