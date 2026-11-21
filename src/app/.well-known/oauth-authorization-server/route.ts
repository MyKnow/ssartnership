import { getMcpConfig } from "@/lib/mcp/config";
import { mcpMetadata } from "@/lib/mcp/http";
export const dynamic = "force-dynamic";
export function GET() { return mcpMetadata(getMcpConfig()); }
