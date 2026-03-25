import { ethers } from "ethers";
import { readFileSync } from "fs";
import { createRequire } from "module";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Load compiled contract artifacts
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
  console.log("Deploying with:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) throw new Error("No ETH balance — fund your wallet first");

  const XToken    = loadArtifact("XToken");
  const Staking   = loadArtifact("XSenateStaking");
  const Governor  = loadArtifact("XSenateGovernor");
  const Registry  = loadArtifact("XSenateRegistry");

  // 1. XToken
  console.log("\n[1/4] Deploying XToken (XSEN)...");
  const xToken = await deploy(XToken, ethers.parseEther("100000000"));
  const xTokenAddr = await xToken.getAddress();
  console.log("XToken:", xTokenAddr);

  // 2. Staking
  console.log("\n[2/4] Deploying XSenateStaking...");
  const staking = await deploy(Staking, xTokenAddr);
  const stakingAddr = await staking.getAddress();
  console.log("XSenateStaking:", stakingAddr);

  // 3. Governor
  console.log("\n[3/4] Deploying XSenateGovernor...");
  const governor = await deploy(Governor, ethers.ZeroAddress);
  const governorAddr = await governor.getAddress();
  console.log("XSenateGovernor:", governorAddr);

  // 4. Registry
  console.log("\n[4/4] Deploying XSenateRegistry...");
  const registry = await deploy(Registry, governorAddr, xTokenAddr, stakingAddr);
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
    console.log(" ", name);
  }

  console.log("Registering Genesis 5 on Staking...");
  for (const name of GENESIS) {
    await (await staking.registerGenesisAgent(name)).wait();
    console.log(" ", name);
  }

  console.log("Registering XSEN native project...");
  await (await registry.registerNativeProject("XSEN", "X-Senate DAO", xTokenAddr, stakingAddr)).wait();

  console.log("Funding reward pool (1M XSEN)...");
  const fundAmount = ethers.parseEther("1000000");
  await (await xToken.approve(stakingAddr, fundAmount)).wait();
  await (await staking.fundRewardPool(fundAmount)).wait();

  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("XToken (XSEN):   ", xTokenAddr);
  console.log("XSenateStaking:  ", stakingAddr);
  console.log("XSenateGovernor: ", governorAddr);
  console.log("XSenateRegistry: ", registryAddr);
  console.log("=========================================");
  console.log("Deployer:", wallet.address);
  console.log("Network: X Layer mainnet (chainId 196)");
}

main().catch((err) => { console.error(err); process.exit(1); });
