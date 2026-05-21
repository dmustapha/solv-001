import { spawn } from "child_process";

// ─── Core CLI caller ──────────────────────────────────────────────────────────

async function arcRPC(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const args = ["rpc", method];
    if (params !== undefined) {
      args.push(typeof params === "string" ? params : JSON.stringify(params));
    }

    const proc = spawn("arc-canteen", args, { env: process.env });
    let stdout  = "";
    let stderr  = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`arc-canteen rpc ${method} failed (exit ${code}): ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve(stdout.trim());
      }
    });
    proc.on("error", err => reject(new Error(`arc-canteen not found: ${err.message}`)));
  });
}

// ─── Fallback: direct Arc RPC call (for Vercel serverless) ───────────────────
// Used when arc-canteen CLI is unavailable (e.g. Vercel serverless environment).

async function arcRPCDirect(method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = process.env.ARC_RPC_URL;
  if (!rpcUrl) throw new Error("ARC_RPC_URL not set — cannot use direct RPC fallback");

  const response = await fetch(rpcUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) throw new Error(`Arc RPC ${method} failed: ${response.status}`);
  const body = await response.json() as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(`Arc RPC error: ${body.error.message}`);
  return body.result;
}

// ─── Adapter: try CLI, fall back to direct RPC ───────────────────────────────

async function callArc(method: string, params: unknown[], cliParams?: string): Promise<unknown> {
  try {
    return await arcRPC(method, cliParams ?? params[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("arc-canteen not found")) {
      return arcRPCDirect(method, params);
    }
    throw err;
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function getTransactionCount(address: `0x${string}`): Promise<number> {
  const result = await callArc("eth_getTransactionCount", [address, "latest"], address);
  return parseInt(result as string, 16);
}

export async function getNativeBalance(address: `0x${string}`): Promise<bigint> {
  const result = await callArc("eth_getBalance", [address, "latest"], address);
  return BigInt(result as string);
}

export async function getCode(address: `0x${string}`): Promise<string> {
  const result = await callArc("eth_getCode", [address, "latest"], address);
  return result as string;
}

export async function getLogs(filter: {
  fromBlock?: string;
  toBlock?:   string;
  address?:   string;
  topics?:    (string | null)[];
}): Promise<unknown[]> {
  const result = await callArc("eth_getLogs", [filter], JSON.stringify(filter));
  return result as unknown[];
}

export async function ethCall(params: {
  to:   string;
  data: string;
}): Promise<string> {
  const result = await callArc("eth_call", [params, "latest"], JSON.stringify(params));
  return result as string;
}

export async function checkChainLive(): Promise<{ blockNumber: number }> {
  const result = await callArc("eth_blockNumber", [], "");
  return { blockNumber: parseInt(result as string, 16) };
}

// ─── Arc Explorer URL builder ─────────────────────────────────────────────────

export function arcExplorerTxUrl(txHash: string): string {
  return `${process.env.ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz"}/tx/${txHash}`;
}

export function arcExplorerAddressUrl(address: string): string {
  return `${process.env.ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz"}/address/${address}`;
}
