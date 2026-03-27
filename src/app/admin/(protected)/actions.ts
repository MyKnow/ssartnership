"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { clearAdminSession, requireAdmin } from "@/lib/auth";

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMultiLine(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const color = String(formData.get("color") || "").trim();

  if (!key || !label) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from("categories").insert({ key, label, description, color });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const key = String(formData.get("key") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const color = String(formData.get("color") || "").trim();

  if (!id || !key || !label) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase
    .from("categories")
    .update({ key, label, description, color })
    .eq("id", id);

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from("categories").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function createPartner(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const mapUrl = String(formData.get("mapUrl") || "").trim();
  const reservationLink = String(formData.get("reservationLink") || "").trim();
  const inquiryLink = String(formData.get("inquiryLink") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();
  const benefits = String(formData.get("benefits") || "").trim();
  const conditions = String(formData.get("conditions") || "").trim();
  const images = String(formData.get("images") || "").trim();
  const tags = String(formData.get("tags") || "").trim();

  if (!name || !categoryId || !location) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("partners").insert({
    name,
    category_id: categoryId,
    location,
    map_url: mapUrl || null,
    reservation_link: reservationLink || null,
    inquiry_link: inquiryLink || null,
    period_start: periodStart || null,
    period_end: periodEnd || null,
    benefits: parseList(benefits),
    conditions: parseList(conditions),
    images: parseMultiLine(images),
    tags: parseList(tags),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updatePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const mapUrl = String(formData.get("mapUrl") || "").trim();
  const reservationLink = String(formData.get("reservationLink") || "").trim();
  const inquiryLink = String(formData.get("inquiryLink") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();
  const benefits = String(formData.get("benefits") || "").trim();
  const conditions = String(formData.get("conditions") || "").trim();
  const images = String(formData.get("images") || "").trim();
  const tags = String(formData.get("tags") || "").trim();

  if (!id || !name || !categoryId || !location) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partners")
    .update({
      name,
      category_id: categoryId,
      location,
      map_url: mapUrl || null,
      reservation_link: reservationLink || null,
      inquiry_link: inquiryLink || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      benefits: parseList(benefits),
      conditions: parseList(conditions),
      images: parseMultiLine(images),
      tags: parseList(tags),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deletePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from("partners").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin/login");
}
