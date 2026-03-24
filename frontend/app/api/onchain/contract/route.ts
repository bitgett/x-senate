import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const deploymentPath = join(process.cwd(), "..", "backend", "contract_deployment.json");
    const raw = await readFile(deploymentPath, "utf-8");
    const info = JSON.parse(raw);
    return NextResponse.json({ deployed: true, ...info });
  } catch {
    return NextResponse.json({
      deployed: false,
      message: "Run: python backend/scripts/deploy_contract.py",
    });
  }
}
