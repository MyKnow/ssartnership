import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminMemberMockPreviewPage() {
  await requireAdminPermission("cycles", "read", { path: "/admin/cycle" });
  redirect("/admin/cycle#card-preview");
}
