import { pathToFileURL } from "node:url";

const ERC20_BALANCE_OF = "70a08231";
const ERC20_DECIMALS = "313ce567";

function validateAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) {
    throw new TypeError(`${label} must be a 20-byte EVM address`);
  }
  return value.toLowerCase();
}

function encodeAddressCall(selector, address) {
  return `0x${selector}${address.slice(2).padStart(64, "0")}`;
}

function decodeUint256(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`Invalid ${label} response: expected a 32-byte ABI uint256`);
  }
  return BigInt(value);
}

export function formatUnits(value, decimals) {
  if (typeof value !== "bigint" || value < 0n) {
    throw new TypeError("value must be a non-negative bigint");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new TypeError("decimals must be an integer from 0 to 255");
  }
  if (decimals === 0) return value.toString();

  const padded = value.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function rpcCall(fetchImpl, rpcUrl, method, params, id) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText ?? ""}`.trim());
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed (${payload.error.code}): ${payload.error.message}`);
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return payload.result;
}

/**
 * Read an ERC-20 token balance on Base without signing or broadcasting transactions.
 */
export async function readBaseTokenBalance({
  rpcUrl,
  chainId,
  tokenAddress,
  walletAddress,
  fetchImpl = fetch,
} = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("rpcUrl must be an HTTP(S) URL");
  }
  const token = validateAddress(tokenAddress, "tokenAddress");
  const wallet = validateAddress(walletAddress, "walletAddress");

  if (![8453, 84532].includes(Number(chainId))) {
    throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  }

  const expectedChainId = `0x${Number(chainId).toString(16)}`;
  const actualChainId = await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], 1);
  if (String(actualChainId).toLowerCase() !== expectedChainId) {
    throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${actualChainId}`);
  }

  const call = (data) => rpcCall(fetchImpl, rpcUrl, "eth_call", [
    { to: token, data }, "latest",
  ], data === encodeAddressCall(ERC20_BALANCE_OF, wallet) ? 2 : 3);

  const [rawBalance, rawDecimals] = await Promise.all([
    call(encodeAddressCall(ERC20_BALANCE_OF, wallet)),
    call(`0x${ERC20_DECIMALS}`),
  ]);

  const balance = decodeUint256(rawBalance, "balanceOf");
  const decimalsValue = decodeUint256(rawDecimals, "decimals");
  if (decimalsValue > 255n) {
    throw new Error("Invalid decimals response: value exceeds uint8 range");
  }
  const decimals = Number(decimalsValue);

  return {
    chainId: Number(chainId),
    tokenAddress: token,
    walletAddress: wallet,
    rawBalance: balance.toString(),
    decimals,
    formattedBalance: formatUnits(balance, decimals),
  };
}

async function main() {
  const [tokenAddress, walletAddress] = process.argv.slice(2);
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = Number(process.env.BASE_CHAIN_ID);

  if (!rpcUrl || !chainId || !tokenAddress || !walletAddress) {
    throw new Error(
      "Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <token-address> <wallet-address>",
    );
  }

  const result = await readBaseTokenBalance({
    rpcUrl, chainId, tokenAddress, walletAddress,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
