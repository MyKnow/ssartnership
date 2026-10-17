import { getMcpRuntime } from "@/lib/mcp/runtime.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request:Request) { return getMcpRuntime().http.mcp(request); }
export async function GET(request:Request) { return getMcpRuntime().http.mcp(request); }
export async function DELETE(request:Request) { return getMcpRuntime().http.mcp(request); }
