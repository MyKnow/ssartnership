#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const RESOURCES = [
  "members",
  "reviews",
  "logs",
  "brands",
  "companies",
  "notifications",
  "home_ads",
  "events",
  "cycles",
  "admin_management",
];
const ACTIONS = ["create", "read", "update", "delete"];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ssartnership.vercel.app").replace(/\/$/, "");
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
    },
  },
);

const loginId = requiredEnv("ADMIN_BOOTSTRAP_LOGIN_ID");
const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || loginId;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || null;
const token = randomBytes(32).toString("hex");
const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

const { data: account, error: accountError } = await supabase
  .from("admin_accounts")
  .upsert(
    {
      login_id: loginId,
      display_name: displayName,
      email,
      is_active: true,
      must_change_password: true,
      initial_setup_token_hash: hashOpaqueToken(token),
      initial_setup_expires_at: expiresAt,
    },
    { onConflict: "login_id" },
  )
  .select("id,login_id")
  .single();

if (accountError) {
  throw new Error(accountError.message);
}

const rows = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => ({
    admin_id: account.id,
    resource,
    action,
    granted: resource === "logs" ? action === "read" : true,
  })),
);

const { error: permissionError } = await supabase
  .from("admin_permissions")
  .upsert(rows, { onConflict: "admin_id,resource,action" });

if (permissionError) {
  throw new Error(permissionError.message);
}

const setupUrl = `${siteUrl()}/admin/setup/${encodeURIComponent(token)}`;
console.log(`Created/updated super admin: ${account.login_id}`);
console.log(`Initial setup URL: ${setupUrl}`);
console.log(`Expires at: ${expiresAt}`);
