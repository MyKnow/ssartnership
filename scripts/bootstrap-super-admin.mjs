#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
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

const username = process.env.ADMIN_BOOTSTRAP_LOGIN_ID?.trim() || "myknow";
if (username !== "myknow") {
  throw new Error("Only the myknow member can be bootstrapped as super_admin.");
}

const { data: member, error: lookupError } = await supabase
  .from("members")
  .select("id,mm_username,admin_permission_id")
  .eq("mm_username", username)
  .maybeSingle();

if (lookupError) {
  throw new Error(lookupError.message);
}
if (!member) {
  throw new Error("myknow member was not found. Create the member before bootstrapping admin access.");
}

const { data: updatedMember, error: updateError } = await supabase
  .from("members")
  .update({ admin_permission_id: "super_admin" })
  .eq("id", member.id)
  .select("id,mm_username,admin_permission_id")
  .single();

if (updateError) {
  throw new Error(updateError.message);
}

console.log(`Promoted member super admin: ${updatedMember.mm_username}`);
