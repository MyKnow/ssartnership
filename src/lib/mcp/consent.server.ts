import "server-only";
import { getAdminSession } from "@/lib/auth";
import { getAdminAccountByIdUncached } from "@/lib/admin-accounts";
import { readSessionSecret } from "@/lib/session-secrets";
import { createMcpConsentToken } from "./oauth/csrf";
import { isUsableAdmin } from "./oauth/service";
export async function getMcpAdmin() {
  const session=await getAdminSession();
  if(!session) return null;
  const account=await getAdminAccountByIdUncached(session.adminId);
  return isUsableAdmin(account,session.permissionVersion)?account:null;
}
export function mcpConsent(adminId:string,purpose:string,binding:string) {
  return createMcpConsentToken(readSessionSecret("admin-session"),adminId,purpose,binding);
}
