import { NextRequest }               from "next/server";
import { getTask, getTraceEvents }   from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  const trace = await getTraceEvents(id);
  return Response.json({ ...task, trace });
}
