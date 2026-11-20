import { BASE_NETWORKS, formatEther, getChainId, getNativeBalance } from "./rpc.js";

const rpcUrl = process.env.RPC_URL;
const address = process.env.WALLET_ADDRESS;
const networkName = process.env.BASE_NETWORK ?? "sepolia";
const network = BASE_NETWORKS[networkName];

if (!rpcUrl || !address || !network) {
  console.error("Set RPC_URL, WALLET_ADDRESS, and BASE_NETWORK=mainnet|sepolia.");
  process.exit(1);
}

try {
  const chainId = await getChainId(rpcUrl);
  if (chainId !== network.chainId) {
    throw new Error(`Wrong network: expected ${network.name} (${network.chainId}), received chain ID ${chainId}.`);
  }

  const balance = await getNativeBalance(rpcUrl, address);
  console.log(`${network.name} native ETH balance for ${address}: ${formatEther(balance)} ETH`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
