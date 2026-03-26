/**
 * post-setup.js
 * Run this after deploy-upgrade.js if the post-setup step failed due to nonce issues.
 * Uses the already-deployed contract addresses.
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXISTING_XSEN   = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const STAKING_ADDR    = "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const GOVERNOR_ADDR   = "0xeD57C957D9f1F4CBF39155303B7143B605ff3546";
const REGISTRY_ADDR   = "0x111bC1681fc34EAcab66f75D8273C4ECD49b13e5";

const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

function loadArtifact(name) {
  const path = join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

async function send(contract, method, args = []) {
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  const tx = await contract[method](...args, { nonce });
  console.log(`  TX: ${tx.hash}`);
  await tx.wait();
  console.log(`  ✓ ${method}`);
}

async function main() {
  console.log("Deployer:", wallet.address);
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("Current nonce:", nonce);

  const stakingABI  = loadArtifact("XSenateStaking").abi;
  const governorABI = loadArtifact("XSenateGovernor").abi;
  const xsenABI     = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];

  const staking  = new ethers.Contract(STAKING_ADDR,  stakingABI,  wallet);
  const governor = new ethers.Contract(GOVERNOR_ADDR, governorABI, wallet);
  const xsen     = new ethers.Contract(EXISTING_XSEN, xsenABI,     wallet);

  // Check if already set up by testing a view call
  try {
    const registryOnGov = await governor.registry();
    console.log("Governor.registry() =", registryOnGov);
    if (registryOnGov.toLowerCase() !== REGISTRY_ADDR.toLowerCase()) {
      console.log("Setting registry on Governor...");
      await send(governor, "setRegistry", [REGISTRY_ADDR]);
    } else {
      console.log("✓ Registry already set on Governor");
    }
  } catch (e) {
    console.log("Setting registry on Governor...");
    await send(governor, "setRegistry", [REGISTRY_ADDR]);
  }

  try {
    const govOnStaking = await staking.governor();
    console.log("Staking.governor() =", govOnStaking);
    if (govOnStaking.toLowerCase() !== GOVERNOR_ADDR.toLowerCase()) {
      console.log("Setting governor on Staking...");
      await send(staking, "setGovernor", [GOVERNOR_ADDR]);
    } else {
      console.log("✓ Governor already set on Staking");
    }
  } catch (e) {
    console.log("Setting governor on Staking...");
    await send(staking, "setGovernor", [GOVERNOR_ADDR]);
  }

  const GENESIS = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"];

  console.log("\nRegistering Genesis 5 on Governor...");
  for (const name of GENESIS) {
    try {
      const existing = await governor.agentAddresses(name);
      if (existing !== ethers.ZeroAddress) {
        console.log(`  ✓ ${name} already registered`);
        continue;
      }
    } catch {}
    await send(governor, "registerAgent", [name, wallet.address]);
    console.log(`  ${name} → ${wallet.address}`);
  }

  console.log("\nRegistering Genesis 5 on Staking...");
  for (const name of GENESIS) {
    try {
      await send(staking, "registerGenesisAgent", [name]);
    } catch (e) {
      if (e.message?.includes("already")) {
        console.log(`  ✓ ${name} already registered`);
      } else {
        console.error(`  ✗ ${name}:`, e.shortMessage ?? e.message);
      }
    }
  }

  console.log("\nRegistering XSEN native project...");
  try {
    await send(staking.connect(wallet), "registerGenesisAgent", ["XSEN"]).catch(() => {});
    const registryContract = new ethers.Contract(REGISTRY_ADDR, loadArtifact("XSenateRegistry").abi, wallet);
    await send(registryContract, "registerNativeProject", ["XSEN", "X-Senate DAO", EXISTING_XSEN, STAKING_ADDR]);
  } catch (e) {
    console.log("  (may already be registered):", e.shortMessage ?? e.message);
  }

  console.log("\nFunding reward pool (1M XSEN)...");
  const xsenBal = await xsen.balanceOf(wallet.address);
  const FUND = ethers.parseEther("1000000");
  if (xsenBal >= FUND) {
    await send(xsen, "approve", [STAKING_ADDR, FUND]);
    await send(staking, "fundRewardPool", [FUND]);
    console.log("  ✓ Reward pool funded with 1M XSEN");
  } else {
    console.log(`  ⚠️  XSEN balance ${ethers.formatEther(xsenBal)} < 1M, skipping`);
  }

  console.log("\n========== SETUP COMPLETE ==========");
  console.log("XToken (XSEN)   [unchanged]:", EXISTING_XSEN);
  console.log("XSenateStaking  [NEW]:      ", STAKING_ADDR);
  console.log("XSenateGovernor [NEW]:      ", GOVERNOR_ADDR);
  console.log("XSenateRegistry [NEW]:      ", REGISTRY_ADDR);
  console.log("=====================================");
  console.log("\nUpdate Vercel env vars:");
  console.log(`  NEXT_PUBLIC_XSEN_STAKING_ADDRESS=${STAKING_ADDR}`);
  console.log(`  NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS=${REGISTRY_ADDR}`);
  console.log(`  XSEN_STAKING_ADDRESS=${STAKING_ADDR}`);
  console.log(`  XSEN_REGISTRY_ADDRESS=${REGISTRY_ADDR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
