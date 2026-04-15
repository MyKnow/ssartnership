import { handleVerifyCodePost } from "../_shared/verify-code";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleVerifyCodePost(request);
}
