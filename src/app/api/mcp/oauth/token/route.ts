import { getMcpRuntime } from "@/lib/mcp/runtime.server";
export const runtime = "nodejs";
export async function POST(request:Request) { return getMcpRuntime().http.token(request); }
