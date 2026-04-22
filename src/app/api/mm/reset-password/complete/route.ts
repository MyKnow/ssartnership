import { handleResetPasswordCompletePost } from "../../_shared/reset-password-complete";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleResetPasswordCompletePost(request);
}
