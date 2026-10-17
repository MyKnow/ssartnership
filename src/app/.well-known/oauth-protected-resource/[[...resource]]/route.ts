import { getMcpConfig } from "@/lib/mcp/config";
import { mcpMetadata, mcpJson } from "@/lib/mcp/http";
export const dynamic = "force-dynamic";
export function GET(request:Request) {
  return ["/.well-known/oauth-protected-resource","/.well-known/oauth-protected-resource/api/mcp"].includes(new URL(request.url).pathname)
    ? mcpMetadata(getMcpConfig(),true) : mcpJson({error:"not_found"},404);
}
