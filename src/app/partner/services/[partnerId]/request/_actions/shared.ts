import { revalidatePath, revalidateTag } from "next/cache";

export function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export function getReturnUrl(partnerId: string) {
  return `/partner/services/${encodeURIComponent(partnerId)}`;
}

export function revalidatePartnerServicePaths(partnerId: string) {
  revalidateTag("partners", "max");
  revalidatePath("/partner");
  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  revalidatePath("/partners/[id]", "page");
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}`);
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}/request`);
}
