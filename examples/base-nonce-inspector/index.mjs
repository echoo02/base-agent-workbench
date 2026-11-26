import { pathToFileURL } from "node:url";

function validateAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) {
    throw new TypeError("address must be a 20-byte EVM address");
  }
  return value.toLowerCase();
}

function parseQuantity(value, label) {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value)) {
    throw new Error(`Invalid ${label} response: expected a canonical hex quantity`);
  }
  return BigInt(value);
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
 * Inspect an account's latest and pending transaction nonces on Base.
 * Read-only: this helper never signs or broadcasts a transaction.
 */
export async function inspectBaseNonce({
  rpcUrl,
  chainId,
  address,
  fetchImpl = fetch,
} = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("rpcUrl must be an HTTP(S) URL");
  }
  if (![8453, 84532].includes(Number(chainId))) {
    throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  }
  const account = validateAddress(address);
  const expectedChainId = `0x${Number(chainId).toString(16)}`;

  const actualChainId = await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], 1);
  if (String(actualChainId).toLowerCase() !== expectedChainId) {
    throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${actualChainId}`);
  }

  const [latestHex, pendingHex] = await Promise.all([
    rpcCall(fetchImpl, rpcUrl, "eth_getTransactionCount", [account, "latest"], 2),
    rpcCall(fetchImpl, rpcUrl, "eth_getTransactionCount", [account, "pending"], 3),
  ]);
  const latestNonce = parseQuantity(latestHex, "latest nonce");
  const pendingNonce = parseQuantity(pendingHex, "pending nonce");
  if (pendingNonce < latestNonce) {
    throw new Error("Invalid nonce response: pending nonce is lower than latest nonce");
  }

  return {
    chainId: Number(chainId),
    address: account,
    latestNonce: latestNonce.toString(),
    pendingNonce: pendingNonce.toString(),
    pendingTransactions: (pendingNonce - latestNonce).toString(),
  };
}

async function main() {
  const [address] = process.argv.slice(2);
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = Number(process.env.BASE_CHAIN_ID);

  if (!rpcUrl || !chainId || !address) {
    throw new Error(
      "Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <wallet-address>",
    );
  }

  const result = await inspectBaseNonce({ rpcUrl, chainId, address });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
