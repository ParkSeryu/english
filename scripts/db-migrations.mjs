#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const LEDGER_TABLE = "public.app_schema_migrations";
const ENVIRONMENTS = {
  dev: {
    envFile: ".env.local",
    projectRef: "uixpyibcpleuwsgemdno",
    production: false
  },
  main: {
    envFile: ".env.main.local",
    projectRef: "ccawzrrkxuirrwvaecvw",
    production: true
  }
};

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("-")) ?? "help";
const envName = valueAfter("--env") ?? "dev";
const showHelp = args.includes("--help") || args.includes("-h") || command === "help";
const confirmProduction = args.includes("--confirm-production");

if (showHelp) {
  printHelp();
  process.exit(0);
}

if (!["status", "migrate", "baseline", "validate"].includes(command)) {
  fail(`Unknown command: ${command}`);
}

const environment = ENVIRONMENTS[envName];
if (!environment) fail(`Unknown environment: ${envName}. Expected one of: ${Object.keys(ENVIRONMENTS).join(", ")}`);
if (environment.production && ["migrate", "baseline"].includes(command) && !confirmProduction) {
  fail(`Refusing to ${command} production/main without --confirm-production. Run status first, then re-run with explicit confirmation if intended.`);
}

const env = loadEnvFile(path.join(ROOT, environment.envFile));
const apiUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL", environment.envFile);
const apiProjectRef = projectRefFromUrl(apiUrl);
if (apiProjectRef !== environment.projectRef) {
  fail(`${environment.envFile} points to ${apiProjectRef}, expected ${environment.projectRef}. Aborting to avoid cross-environment migration.`);
}

const databaseUrl = databaseUrlFromEnv(env, environment.envFile);
const migrations = readMigrations();

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

async function main() {
  if (command === "status") {
    const applied = await readLedgerIfPresent();
    printStatus(applied, false);
    return;
  }

  if (command === "validate") {
    const applied = await readLedgerIfPresent();
    validateAppliedChecksums(applied);
    console.log(`Validated ${applied.size} applied migration record(s) for ${envName}.`);
    return;
  }

  ensureLedger();
  const applied = await readLedgerIfPresent();
  validateAppliedChecksums(applied);

  if (command === "baseline") {
    baseline(applied);
    const refreshed = await readLedgerIfPresent();
    printStatus(refreshed, true);
    return;
  }

  migrate(applied);
  const refreshed = await readLedgerIfPresent();
  printStatus(refreshed, true);
}

function printHelp() {
  console.log(`Usage: node scripts/db-migrations.mjs <command> --env <dev|main> [--confirm-production]

Flyway-style migration runner for supabase/migrations/*.sql.

Commands:
  status     Show local files, DB ledger rows, pending migrations, and checksum mismatches. Does not write.
  validate   Fail if an applied migration checksum differs from the local file.
  baseline   Create the ledger and mark current local files as already applied without executing SQL.
  migrate    Execute pending migrations in filename order and record checksums.

Environment mapping:
  dev  -> .env.local      -> project ${ENVIRONMENTS.dev.projectRef}
  main -> .env.main.local -> project ${ENVIRONMENTS.main.projectRef}

Required DB URL in the selected env file:
  SUPABASE_DB_URL, SUPABASE_DIRECT_URL, DATABASE_URL, or POSTGRES_URL

Production safety:
  baseline/migrate with --env main requires --confirm-production.`);
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing env file: ${path.relative(ROOT, filePath)}`);
  const values = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function requiredEnv(values, key, source) {
  const value = values[key];
  if (!value) fail(`${source} is missing ${key}`);
  return value;
}

function databaseUrlFromEnv(values, source) {
  const key = ["SUPABASE_DB_URL", "SUPABASE_DIRECT_URL", "DATABASE_URL", "POSTGRES_URL"].find((candidate) => values[candidate] || process.env[candidate]);
  if (!key) fail(`${source} or the shell environment must define SUPABASE_DB_URL, SUPABASE_DIRECT_URL, DATABASE_URL, or POSTGRES_URL for psql migrations.`);
  return values[key] || process.env[key];
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fail(`Missing migrations directory: ${path.relative(ROOT, MIGRATIONS_DIR)}`);
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return files.map((file) => {
    const match = /^(\d{14})_(.+)\.sql$/.exec(file);
    if (!match) fail(`Migration filename must match <14-digit-version>_<name>.sql: ${file}`);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf8");
    return {
      version: match[1],
      name: match[2],
      file,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex")
    };
  });
}

function runPsql(sql, options = {}) {
  const result = spawnSync("psql", [databaseUrl, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--no-align", "--tuples-only", "--command", sql], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
  });

  if (result.error) {
    if (result.error.code === "ENOENT") fail("psql was not found. Install PostgreSQL client tools before running DB migrations.");
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    fail([stderr, stdout].filter(Boolean).join("\n") || `psql exited with status ${result.status}`);
  }

  return result.stdout ?? "";
}

function ledgerExists() {
  return runPsql(`select to_regclass('${LEDGER_TABLE}') is not null;`).trim() === "t";
}

async function readLedgerIfPresent() {
  if (!ledgerExists()) return new Map();
  const raw = runPsql(`select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select version, name, checksum, baseline, installed_at from ${LEDGER_TABLE} order by version) t;`).trim();
  const rows = JSON.parse(raw || "[]");
  return new Map(rows.map((row) => [row.version, row]));
}

function ensureLedger() {
  runPsql(`create table if not exists ${LEDGER_TABLE} (
  version text primary key,
  name text not null,
  checksum text not null,
  installed_by text not null default current_user,
  installed_at timestamptz not null default now(),
  execution_ms integer,
  success boolean not null default true,
  baseline boolean not null default false
);`);
}

function validateAppliedChecksums(applied) {
  const localByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const mismatches = [];
  for (const [version, row] of applied) {
    const local = localByVersion.get(version);
    if (local && local.checksum !== row.checksum) mismatches.push(`${version}_${local.name}.sql`);
  }
  if (mismatches.length) fail(`Applied migration checksum mismatch: ${mismatches.join(", ")}. Create a new migration instead of editing applied SQL.`);
}

function baseline(applied) {
  const pending = migrations.filter((migration) => !applied.has(migration.version));
  if (!pending.length) {
    console.log("No migrations to baseline.");
    return;
  }

  const values = pending.map((migration) => `(${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)}, 0, true)`).join(",\n");
  runPsql(`insert into ${LEDGER_TABLE} (version, name, checksum, execution_ms, baseline)
values ${values}
on conflict (version) do nothing;`);
  console.log(`Baselined ${pending.length} migration(s) for ${envName}.`);
}

function migrate(applied) {
  const pending = migrations.filter((migration) => !applied.has(migration.version));
  if (!pending.length) {
    console.log("No pending migrations.");
    return;
  }

  for (const migration of pending) {
    const startedAt = Date.now();
    console.log(`Applying ${migration.file} to ${envName}...`);
    const executionSql = migration.sql.includes("migrate: no-transaction")
      ? `${migration.sql}\ninsert into ${LEDGER_TABLE} (version, name, checksum, execution_ms, baseline) values (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)}, ${Date.now() - startedAt}, false);`
      : `begin;\n${migration.sql}\ninsert into ${LEDGER_TABLE} (version, name, checksum, execution_ms, baseline) values (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)}, ${Date.now() - startedAt}, false);\ncommit;`;
    runPsql(executionSql, { inherit: true });
  }
}

function printStatus(applied, ledgerWasEnsured) {
  const rows = migrations.map((migration) => {
    const row = applied.get(migration.version);
    const state = row ? row.checksum === migration.checksum ? row.baseline ? "baseline" : "applied" : "checksum-mismatch" : "pending";
    return { version: migration.version, file: migration.file, state, installedAt: row?.installed_at ?? null };
  });
  const pendingCount = rows.filter((row) => row.state === "pending").length;
  const mismatchCount = rows.filter((row) => row.state === "checksum-mismatch").length;
  console.log(JSON.stringify({
    environment: envName,
    projectRef: environment.projectRef,
    envFile: environment.envFile,
    ledgerTable: LEDGER_TABLE,
    ledgerPresent: ledgerWasEnsured || applied.size > 0 || ledgerExists(),
    migrationCount: migrations.length,
    pendingCount,
    mismatchCount,
    rows
  }, null, 2));
  if (mismatchCount > 0) process.exitCode = 1;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
