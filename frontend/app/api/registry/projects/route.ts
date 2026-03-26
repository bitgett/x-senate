import { NextRequest, NextResponse } from "next/server";
import { getRegistryProjects } from "@/lib/contract";
import { dbUpsertProjectMeta, dbListProjectsMeta, initSchema } from "@/lib/db";

const XSEN_PROJECT = {
  project_id: "XSEN",
  name: "X-Senate",
  description: "The native X-Senate governance token and DAO platform on X Layer.",
  token_address: process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b",
  staking_contract: process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502",
  registrant: "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2",
  registered_at: 0,
  active: true,
  twitter: "https://twitter.com/xsenate",
  discord: null,
  telegram: null,
};

export async function GET() {
  try {
    await initSchema().catch(() => {});

    // Merge on-chain projects with DB social meta
    const [onchain, metaRows] = await Promise.all([
      getRegistryProjects().catch(() => []),
      dbListProjectsMeta().catch(() => []),
    ]);

    const metaMap = Object.fromEntries(metaRows.map(m => [m.project_id, m]));

    let projects: any[] = onchain.length > 0
      ? onchain.map((p: any) => ({ ...p, ...(metaMap[p.project_id] ?? {}) }))
      : [XSEN_PROJECT];

    // Merge in any DB-only projects (registered via UI but maybe not yet indexed on-chain)
    for (const meta of metaRows) {
      if (!projects.find(p => p.project_id === meta.project_id)) {
        projects.push({
          project_id:      meta.project_id,
          name:            meta.name,
          description:     meta.description,
          token_address:   meta.token_address,
          staking_contract: process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502",
          registrant:      meta.registrant,
          registered_at:   Math.floor(new Date(meta.created_at).getTime() / 1000),
          active:          true,
          twitter:         meta.twitter,
          discord:         meta.discord,
          telegram:        meta.telegram,
          tx_hash:         meta.tx_hash,
        });
      }
    }

    return NextResponse.json({ projects, count: projects.length, platform: "X-Senate AI Governance Platform" });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initSchema().catch(() => {});
    const body = await req.json();
    const { project_id, name, description, token_address, twitter, discord, telegram, registrant, tx_hash } = body;

    if (!project_id?.trim()) return NextResponse.json({ detail: "project_id required" }, { status: 400 });
    if (!name?.trim())       return NextResponse.json({ detail: "name required" }, { status: 400 });
    if (!token_address?.startsWith("0x") || token_address.length !== 42) {
      return NextResponse.json({ detail: "Invalid token_address" }, { status: 400 });
    }

    const pid = project_id.trim().toUpperCase();

    await dbUpsertProjectMeta({
      project_id:    pid,
      name:          name.trim(),
      description:   description?.trim() || null,
      token_address: token_address.trim(),
      twitter:       twitter?.trim() || null,
      discord:       discord?.trim() || null,
      telegram:      telegram?.trim() || null,
      registrant:    registrant?.trim() || null,
      tx_hash:       tx_hash?.trim() || null,
    });

    return NextResponse.json({
      success: true,
      project_id: pid,
      name: name.trim(),
      token_address,
      message: `Project ${pid} registered! Governance page: /projects/${pid}`,
    });
  } catch (e: any) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
