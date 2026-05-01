#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const MAIN_ENV_PATH = path.join(ROOT, ".env.main.local");
const DEV_ENV_PATH = path.join(ROOT, ".env.local");
const PAGE_SIZE = 1000;

const CONTENT_TABLES = [
  "content_groups",
  "content_folders",
  "content_folder_permissions",
  "expression_days",
  "expressions",
  "expression_examples"
];

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const showHelp = args.has("--help") || args.has("-h");

if (showHelp) {
  console.log(`Usage: npm run sync:main-to-dev -- [--apply]\n\nCopies shared learning content from .env.main.local to .env.local.\n\nDefault mode is dry-run. Add --apply to write to the dev database.\nMain is always read-only. User progress, auth users, question notes, and ingestion runs are not copied.`);
  process.exit(0);
}

function loadEnvFile(filePath) {
  const values = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function requiredEnv(env, key, source) {
  const value = env[key];
  if (!value) throw new Error(`${source} is missing ${key}`);
  return value;
}

function maskProjectRef(url) {
  try {
    const ref = new URL(url).hostname.split(".")[0] ?? "unknown";
    return ref.length > 8 ? `${ref.slice(0, 4)}…${ref.slice(-4)}` : ref;
  } catch {
    return "unknown";
  }
}

function serviceClient(env, source) {
  return createClient(requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL", source), requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY", source), {
    auth: { persistSession: false }
  });
}

function pick(row, columns) {
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
}

async function fetchAll(client, table, columns, orderColumn = null) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select(columns.join(",")).range(from, from + PAGE_SIZE - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function upsertRows(client, table, rows, options = {}) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, options);
  if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
}

function sortFolders(folders) {
  return [...folders].sort((a, b) => {
    const aDepth = Array.isArray(a.path_ids) ? a.path_ids.length : a.parent_id ? 2 : 1;
    const bDepth = Array.isArray(b.path_ids) ? b.path_ids.length : b.parent_id ? 2 : 1;
    return aDepth - bDepth || a.sort_order - b.sort_order || a.slug.localeCompare(b.slug);
  });
}

function remapOwner(row, ownerId) {
  return { ...row, owner_id: ownerId };
}

function resetLegacyProgress(row) {
  return {
    ...row,
    user_memo: null,
    known_count: 0,
    unknown_count: 0,
    review_count: 0,
    last_result: null,
    last_reviewed_at: null
  };
}

function summarizePlan(data, targetOwnerId) {
  return {
    mode: apply ? "apply" : "dry-run",
    targetOwnerId: `${targetOwnerId.slice(0, 8)}…`,
    copiedTables: Object.fromEntries(CONTENT_TABLES.map((table) => [table, data[table].length])),
    excludedTables: ["auth.users", "expression_progress", "question_notes", "ingestion_runs", "content_group_memberships"],
    note: apply ? "Will write to dev only; main remains read-only." : "No writes performed. Re-run with --apply to write to dev."
  };
}

async function main() {
  const mainEnv = loadEnvFile(MAIN_ENV_PATH);
  const devEnv = loadEnvFile(DEV_ENV_PATH);
  const targetOwnerId = devEnv.DEV_SYNC_OWNER_ID || devEnv.INGESTION_OWNER_ID;
  if (!targetOwnerId) throw new Error(".env.local must define INGESTION_OWNER_ID or DEV_SYNC_OWNER_ID for owner_id remapping");

  const mainClient = serviceClient(mainEnv, ".env.main.local");
  const devClient = serviceClient(devEnv, ".env.local");

  const data = {};
  data.content_groups = await fetchAll(mainClient, "content_groups", ["id", "slug", "name", "created_at"], "slug");
  data.content_folders = sortFolders(await fetchAll(mainClient, "content_folders", ["id", "parent_id", "name", "slug", "sort_order", "path_ids", "path_names", "created_at", "updated_at"], "sort_order"));
  data.content_folder_permissions = await fetchAll(mainClient, "content_folder_permissions", ["folder_id", "group_id", "permission", "created_at"]);
  data.expression_days = (await fetchAll(mainClient, "expression_days", ["id", "owner_id", "title", "raw_input", "source_note", "day_date", "folder_id", "created_by", "created_at", "updated_at"], "created_at")).map((row) => remapOwner(row, targetOwnerId));
  data.expressions = (await fetchAll(mainClient, "expressions", ["id", "expression_day_id", "owner_id", "english", "korean_prompt", "nuance_note", "structure_note", "grammar_note", "user_memo", "source_order", "known_count", "unknown_count", "review_count", "last_result", "last_reviewed_at", "created_at", "updated_at"], "source_order"))
    .map((row) => resetLegacyProgress(remapOwner(row, targetOwnerId)));
  data.expression_examples = await fetchAll(mainClient, "expression_examples", ["id", "expression_id", "example_text", "meaning_ko", "source", "sort_order", "created_at"], "sort_order");

  console.log(JSON.stringify({
    mainProject: maskProjectRef(requiredEnv(mainEnv, "NEXT_PUBLIC_SUPABASE_URL", ".env.main.local")),
    devProject: maskProjectRef(requiredEnv(devEnv, "NEXT_PUBLIC_SUPABASE_URL", ".env.local")),
    ...summarizePlan(data, targetOwnerId)
  }, null, 2));

  if (!apply) return;

  await upsertRows(devClient, "content_groups", data.content_groups, { onConflict: "id" });
  await upsertRows(devClient, "content_folders", data.content_folders.map((row) => pick(row, ["id", "parent_id", "name", "slug", "sort_order", "created_at", "updated_at"])), { onConflict: "id" });
  await upsertRows(devClient, "content_folder_permissions", data.content_folder_permissions, { onConflict: "folder_id,group_id,permission" });
  await upsertRows(devClient, "expression_days", data.expression_days, { onConflict: "id" });
  await upsertRows(devClient, "expressions", data.expressions, { onConflict: "id" });
  await upsertRows(devClient, "expression_examples", data.expression_examples, { onConflict: "id" });

  console.log("Synced main content into dev successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
