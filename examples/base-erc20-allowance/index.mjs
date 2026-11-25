const BASE_CHAIN_IDS = new Set([8453, 84532]);
const ALLOWANCE_SELECTOR = "dd62ed3e";
const DEFAULT_TIMEOUT_MS = 10_000;

function validateAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a 20-byte EVM address`);
  }
  return value.toLowerCase();
}

function encodeAddress(value) {
  return value.slice(2).padStart(64, "0");
}

function parseChainId(value) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error("RPC returned an invalid chain ID");
  }
  return Number(BigInt(value));
}

async function rpcCall(fetchImpl, rpcUrl, method, params, timeoutMs) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText ?? ""}`.trim());
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`RPC ${method} failed (${payload.error.code}): ${payload.error.message}`);
  }
  if (!payload || !Object.hasOwn(payload, "result")) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return payload.result;
}

/**
 * Read an ERC-20 allowance on Base using eth_call.
 * This helper never requests accounts, signs, or broadcasts transactions.
 */
export async function getBaseTokenAllowance({
  rpcUrl,
  chainId,
  tokenAddress,
  ownerAddress,
  spenderAddress,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("rpcUrl must be an HTTP(S) URL");
  }
  if (!Number.isSafeInteger(chainId) || !BASE_CHAIN_IDS.has(chainId)) {
    throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive safe integer");
  }

  const token = validateAddress(tokenAddress, "tokenAddress");
  const owner = validateAddress(ownerAddress, "ownerAddress");
  const spender = validateAddress(spenderAddress, "spenderAddress");

  const actualChainId = parseChainId(
    await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], timeoutMs),
  );
  if (actualChainId !== chainId) {
    throw new Error(`Wrong network: expected chain ID ${chainId}, received ${actualChainId}`);
  }

  const data = `0x${ALLOWANCE_SELECTOR}${encodeAddress(owner)}${encodeAddress(spender)}`;
  const result = await rpcCall(
    fetchImpl,
    rpcUrl,
    "eth_call",
    [{ to: token, data }, "latest"],
    timeoutMs,
  );

  if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
    throw new Error("eth_call returned an invalid uint256 allowance");
  }

  return {
    chainId: actualChainId,
    tokenAddress: token,
    ownerAddress: owner,
    spenderAddress: spender,
    allowance: BigInt(result).toString(),
  };
}
