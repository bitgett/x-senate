/**
 * deploy-upgrade.js
 *
 * Redeploys XSenateStaking, XSenateGovernor, XSenateRegistry
 * with the EXISTING XToken (XSEN) — preserving token balances and LP pool.
 *
 * Security fixes applied:
 *   SEC-01: castSenateVote() now checks agentAddresses[agentName]
 *   SEC-05: staking reward payout no longer mints — requires funded pool
 *
 * Usage:
 *   cd deploy
 *   npx hardhat compile
 *   node scripts/deploy-upgrade.js
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

// Existing XToken — DO NOT redeploy (has LP pool + OKX price feed)
const EXISTING_XSEN = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";

const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

function loadArtifact(name) {
  const path = join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

async function deploy(artifact, ...args) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("OKB balance:", ethers.formatEther(balance));
  if (balance === 0n) throw new Error("No OKB for gas — fund your wallet first");

  const xsenAbi = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
  const xsen = new ethers.Contract(EXISTING_XSEN, xsenAbi, wallet);
  const xsenBal = await xsen.balanceOf(wallet.address);
  console.log("XSEN balance:", ethers.formatEther(xsenBal));

  const Staking   = loadArtifact("XSenateStaking");
  const Governor  = loadArtifact("XSenateGovernor");
  const Registry  = loadArtifact("XSenateRegistry");

  // 1. Staking (SEC-05 fix: no mint fallback)
  console.log("\n[1/3] Deploying XSenateStaking...");
  const staking = await deploy(Staking, EXISTING_XSEN);
  const stakingAddr = await staking.getAddress();
  console.log("XSenateStaking:", stakingAddr);

  // 2. Governor (SEC-01 fix: castSenateVote caller check)
  console.log("\n[2/3] Deploying XSenateGovernor...");
  const governor = await deploy(Governor, ethers.ZeroAddress);
  const governorAddr = await governor.getAddress();
  console.log("XSenateGovernor:", governorAddr);

  // 3. Registry
  console.log("\n[3/3] Deploying XSenateRegistry...");
  const registry = await deploy(Registry, governorAddr, EXISTING_XSEN, stakingAddr);
  const registryAddr = await registry.getAddress();
  console.log("XSenateRegistry:", registryAddr);

  // Post-deploy setup
  console.log("\n--- Post-deploy setup ---");

  console.log("Setting registry on Governor...");
  await (await governor.setRegistry(registryAddr)).wait();

  console.log("Setting governor on Staking...");
  await (await staking.setGovernor(governorAddr)).wait();

  const GENESIS = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"];

  console.log("Registering Genesis 5 on Governor...");
  for (const name of GENESIS) {
    await (await governor.registerAgent(name, wallet.address)).wait();
    console.log(" ", name, "→", wallet.address);
  }

  console.log("Registering Genesis 5 on Staking...");
  for (const name of GENESIS) {
    await (await staking.registerGenesisAgent(name)).wait();
    console.log(" ", name);
  }

  console.log("Registering XSEN native project...");
  await (await registry.registerNativeProject("XSEN", "X-Senate DAO", EXISTING_XSEN, stakingAddr)).wait();

  // Fund reward pool if deployer has enough XSEN
  const FUND_AMOUNT = ethers.parseEther("1000000");
  if (xsenBal >= FUND_AMOUNT) {
    console.log("Funding reward pool (1M XSEN)...");
    await (await xsen.approve(stakingAddr, FUND_AMOUNT)).wait();
    await (await staking.fundRewardPool(FUND_AMOUNT)).wait();
    console.log("Reward pool funded.");
  } else {
    console.log(`⚠️  XSEN balance (${ethers.formatEther(xsenBal)}) < 1M — skipping reward pool funding.`);
    console.log("   Fund manually: xsen.approve(stakingAddr, amount) + staking.fundRewardPool(amount)");
  }

  console.log("\n========== UPGRADE COMPLETE ==========");
  console.log("XToken (XSEN)   [unchanged]:", EXISTING_XSEN);
  console.log("XSenateStaking  [NEW]:      ", stakingAddr);
  console.log("XSenateGovernor [NEW]:      ", governorAddr);
  console.log("XSenateRegistry [NEW]:      ", registryAddr);
  console.log("======================================");
  console.log("\nUpdate these Vercel env vars:");
  console.log(`  NEXT_PUBLIC_XSEN_STAKING_ADDRESS=${stakingAddr}`);
  console.log(`  NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`  XSEN_STAKING_ADDRESS=${stakingAddr}`);
  console.log(`  XSEN_REGISTRY_ADDRESS=${registryAddr}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
