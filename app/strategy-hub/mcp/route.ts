import { NextRequest } from "next/server";
import { handleMcpRequest } from "@/lib/strategy-hub/mcp/handle-request";
import { MCP_TOOL_NAMES } from "@/lib/strategy-hub/mcp/server";

export const runtime = "nodejs";

/** Publiczny endpoint MCP dla Notion AI: /strategy-hub/mcp */
export async function GET(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function POST(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET, POST, DELETE, OPTIONS" },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "X-MCP-Tools": MCP_TOOL_NAMES.join(",") },
  });
}
