import type {
  IsolateD1Database,
  IsolateDatabase,
  IsolatePostgresDatabase,
} from "./isolate";
import type {
  ProcessD1Database,
  ProcessDatabase,
  ProcessPostgresDatabase,
} from "./process";

export * from "./shared";

export type Database = ProcessDatabase | IsolateDatabase;
export type PostgresDatabase =
  | ProcessPostgresDatabase
  | IsolatePostgresDatabase;
export type D1DatabaseClient = ProcessD1Database | IsolateD1Database;
