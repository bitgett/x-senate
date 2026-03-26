/**
 * Deploy QToken (QTKN) to X Layer Mainnet
 *
 * Usage:
 *   cd deploy
 *   DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-qtoken.js
 */
import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");

const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

// Try compiled artifact first, then minimal bytecode
function loadArtifact() {
  const path = join(__dirname, "../artifacts/contracts/QToken.sol/QToken.json");
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  throw new Error("QToken artifact not found — run: cd deploy && npx hardhat compile");
}

async function main() {
  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("OKB balance:", ethers.formatEther(balance));

  if (balance === 0n) throw new Error("No OKB — fund your wallet first");

  const artifact = loadArtifact();
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 10M QTKN
  console.log("\nDeploying QToken (QTKN) — 10,000,000 supply...");

  const contract = await factory.deploy(INITIAL_SUPPLY);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log("\n========== QTOKEN DEPLOYED ==========");
  console.log("QToken (QTKN):", addr);
  console.log("Network: X Layer Mainnet (chainId 196)");
  console.log("Supply:  10,000,000 QTKN → deployer");
  console.log("======================================");
  console.log("\nAdd to frontend .env.local:");
  console.log(`NEXT_PUBLIC_QTKN_TOKEN_ADDRESS=${addr}`);
}

main().catch(err => { console.error(err); process.exit(1); });
