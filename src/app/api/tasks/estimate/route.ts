import { NextRequest }  from "next/server";
import { TASK_PRICING } from "@/types";
import type { TaskType } from "@/types";

export async function GET(req: NextRequest): Promise<Response> {
  const task_type = req.nextUrl.searchParams.get("task_type") as TaskType | null;
  if (!task_type || !TASK_PRICING[task_type]) {
    return Response.json({ error: "task_type required" }, { status: 400 });
  }

  const pricing = TASK_PRICING[task_type];
  const margin  = (pricing.price_usdc - pricing.estimated_cost_usdc) / pricing.price_usdc;

  return Response.json({
    task_type,
    price_usdc:              pricing.price_usdc,
    estimated_cost_usdc:     pricing.estimated_cost_usdc,
    estimated_margin:        Math.round(margin * 100),
    estimated_margin_pct:    `${(margin * 100).toFixed(1)}%`,
    payment_address:         process.env.SELLER_EOA_ADDRESS?.trim(),
    currency:                "USDC",
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return GET(req);
}
