import { handleResetPasswordPost } from "../_shared/reset-password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleResetPasswordPost(request);
}
