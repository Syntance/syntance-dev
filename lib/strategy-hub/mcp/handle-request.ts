import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createStrategyHubMcpServer } from "@/lib/strategy-hub/mcp/server";

function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

function isAuthorized(request: Request): boolean {
  const token = process.env.MCP_TOKEN;

  if (!token) {
    // Lokalnie bez tokenu — wygodne dev; na produkcji wymagaj MCP_TOKEN
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

/**
 * Obsługuje MCP Streamable HTTP (GET/POST/DELETE) — kompatybilne z Notion Custom Agents.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createStrategyHubMcpServer();
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
