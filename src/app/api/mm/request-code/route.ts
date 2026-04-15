import { handleRequestCodePost } from "../_shared/request-code";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRequestCodePost(request);
}
