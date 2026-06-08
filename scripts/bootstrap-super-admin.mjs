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

const loginId = process.env.ADMIN_BOOTSTRAP_LOGIN_ID?.trim() || "myknow00";
const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || "myknow00";
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || "myknow00@naver.com";

const { data: existingAccount, error: lookupError } = await supabase
  .from("admin_accounts")
  .select("id,login_id,initial_setup_completed_at")
  .eq("login_id", loginId)
  .maybeSingle();

if (lookupError) {
  throw new Error(lookupError.message);
}

let account = existingAccount;
let setupUrl = null;
let expiresAt = null;

if (account) {
  const { data: updatedAccount, error: updateError } = await supabase
    .from("admin_accounts")
    .update({
      display_name: displayName,
      email,
      is_active: true,
    })
    .eq("id", account.id)
    .select("id,login_id,initial_setup_completed_at")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }
  account = updatedAccount;
} else {
  const token = randomBytes(32).toString("hex");
  expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const { data: createdAccount, error: createError } = await supabase
    .from("admin_accounts")
    .insert({
      login_id: loginId,
      display_name: displayName,
      email,
      is_active: true,
      must_change_password: true,
      initial_setup_token_hash: hashOpaqueToken(token),
      initial_setup_expires_at: expiresAt,
    })
    .select("id,login_id,initial_setup_completed_at")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }
  account = createdAccount;
  setupUrl = `${siteUrl()}/admin/setup/${encodeURIComponent(token)}`;
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

console.log(`Promoted super admin: ${account.login_id}`);
if (setupUrl) {
  console.log(`Initial setup URL: ${setupUrl}`);
  console.log(`Expires at: ${expiresAt}`);
} else {
  console.log("Existing account password/setup state was preserved.");
}
