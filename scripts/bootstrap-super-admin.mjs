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

const { data: directory, error: directoryLookupError } = await supabase
  .from("mm_user_directory")
  .select("id,mm_username")
  .eq("mm_username", username)
  .maybeSingle();

if (directoryLookupError) {
  throw new Error(directoryLookupError.message);
}
if (!directory) {
  throw new Error("myknow Mattermost directory entry was not found. Sync the member before bootstrapping admin access.");
}

const { data: member, error: memberLookupError } = await supabase
  .from("members")
  .select("id")
  .eq("mattermost_account_id", directory.id)
  .is("deleted_at", null)
  .maybeSingle();

if (memberLookupError) {
  throw new Error(memberLookupError.message);
}
if (!member) {
  throw new Error("myknow member was not found. Create the member before bootstrapping admin access.");
}

const { data: existingProfile, error: profileLookupError } = await supabase
  .from("admin_profiles")
  .select("id")
  .eq("member_id", member.id)
  .maybeSingle();

if (profileLookupError) {
  throw new Error(profileLookupError.message);
}

let updatedProfile;
let updateError;
if (existingProfile) {
  ({ data: updatedProfile, error: updateError } = await supabase
    .from("admin_profiles")
    .update({ permission_template_key: "super_admin", is_active: true })
    .eq("id", existingProfile.id)
    .select("member_id,permission_template_key")
    .single());
} else {
  ({ data: updatedProfile, error: updateError } = await supabase
    .from("admin_profiles")
    .insert({
      member_id: member.id,
      permission_template_key: "super_admin",
      managed_campus_slugs: [],
      is_active: true,
    })
    .select("member_id,permission_template_key")
    .single());
}

if (updateError) {
  throw new Error(updateError.message);
}

console.log(`Promoted member super admin: ${directory.mm_username} (${updatedProfile.member_id})`);
