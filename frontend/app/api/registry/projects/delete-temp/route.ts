import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function DELETE(req: NextRequest) {
  const { project_id } = await req.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM projects_meta WHERE project_id = ${project_id.toUpperCase()}`;
  return NextResponse.json({ deleted: project_id.toUpperCase() });
}
