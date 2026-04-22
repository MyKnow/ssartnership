import { handleResetPasswordVerifyPost } from "../../_shared/reset-password-verify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleResetPasswordVerifyPost(request);
}
