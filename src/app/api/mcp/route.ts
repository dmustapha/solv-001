import { NextRequest }        from "next/server";
import { Server }             from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TASK_PRICING }       from "@/types";
import type { TaskType }      from "@/types";

// ─── MCP tool definitions ─────────────────────────────────────────────────────

const tools = [
  {
    name:        "run_task",
    description: "Submit a task to solv-001 and receive reasoning + result",
    inputSchema: {
      type:     "object",
      required: ["task_type", "task_description", "payer_wallet"],
      properties: {
        task_type:        { type: "string", enum: Object.keys(TASK_PRICING) },
        task_description: { type: "string" },
        payer_wallet:     { type: "string" },
        max_cost_usdc:    { type: "number" },
      },
    },
  },
  {
    name:        "get_treasury_status",
    description: "Get live treasury state: USDC balance, USYC position, pending income",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name:        "estimate_task",
    description: "Get price and margin estimate for a task type before committing",
    inputSchema: {
      type:     "object",
      required: ["task_type"],
      properties: {
        task_type: { type: "string", enum: Object.keys(TASK_PRICING) },
      },
    },
  },
];

// ─── Create MCP server ────────────────────────────────────────────────────────

function createMcpServer(): Server {
  const server = new Server(
    { name: "solv-001", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    switch (name) {
      case "get_treasury_status": {
        const res  = await fetch(`${appUrl}/api/treasury`);
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "estimate_task": {
        const task_type = (args as Record<string, string>).task_type as TaskType;
        const pricing   = TASK_PRICING[task_type];
        if (!pricing) {
          return { content: [{ type: "text", text: `Unknown task_type: ${task_type}` }], isError: true };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({
            task_type,
            price_usdc:          pricing.price_usdc,
            estimated_cost_usdc: pricing.estimated_cost_usdc,
            margin_pct:          `${(((pricing.price_usdc - pricing.estimated_cost_usdc) / pricing.price_usdc) * 100).toFixed(1)}%`,
          }) }],
        };
      }

      case "run_task": {
        const a = args as Record<string, unknown>;
        if (!a.payment_authorization) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error:   "payment_required",
              message: "payment_authorization (EIP-3009 signed auth) is required. Call /api/tasks without it first to receive payment details.",
            }) }],
            isError: true,
          };
        }
        const res = await fetch(`${appUrl}/api/tasks`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            task:                  a.task_description,
            task_type:             a.task_type,
            payer_wallet:          a.payer_wallet,
            payment_authorization: a.payment_authorization,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { content: [{ type: "text", text: JSON.stringify(body) }], isError: true };
        }

        // Collect SSE stream to text
        const reader  = res.body!.getReader();
        const decoder = new TextDecoder();
        let   output  = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "complete")  output = `Task complete. Result: ${evt.data.result}. Net: $${evt.data.net_usdc} USDC.`;
                if (evt.type === "deferred")  output = `Task deferred: ${evt.data.reason}`;
                if (evt.type === "rejected")  output = `Task rejected: ${evt.data.reason}`;
              } catch { /* skip malformed SSE */ }
            }
          }
        }

        return { content: [{ type: "text", text: output || "Task processing complete." }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  });

  return server;
}

// ─── Route handlers ───────────────────────────────────────────────────────────
// Uses WebStandardStreamableHTTPServerTransport (stateless, one per request).
// Handles GET (SSE streaming) and POST (JSON tool calls) per MCP Streamable HTTP spec.

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  const server = createMcpServer();
  await server.connect(transport);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return transport.handleRequest(req as any);
}

export async function GET(req: NextRequest):    Promise<Response> { return handleMcpRequest(req); }
export async function POST(req: NextRequest):   Promise<Response> { return handleMcpRequest(req); }
export async function DELETE(req: NextRequest): Promise<Response> { return handleMcpRequest(req); }
