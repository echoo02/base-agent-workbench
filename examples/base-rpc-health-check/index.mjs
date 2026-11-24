const NETWORKS = {
  base: { chainId: 8453, name: "Base Mainnet" },
  "base-sepolia": { chainId: 84532, name: "Base Sepolia" },
};

function rpcError(message, code) {
  const error = new Error(message);
  if (code !== undefined) error.code = code;
  return error;
}

async function rpcRequest(fetchImpl, rpcUrl, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
      signal: controller.signal,
    });
    if (!response || response.ok !== true) {
      throw rpcError(`RPC HTTP request failed${response?.status ? ` (HTTP ${response.status})` : ""}`);
    }
    const payload = await response.json();
    if (!payload || payload.jsonrpc !== "2.0" || payload.id !== 1) {
      throw rpcError("RPC returned an invalid JSON-RPC response");
    }
    if (payload.error) {
      throw rpcError(payload.error.message || "RPC returned an error", payload.error.code);
    }
    if (typeof payload.result !== "string") {
      throw rpcError("RPC response is missing a string result");
    }
    return payload.result;
  } catch (error) {
    if (error.name === "AbortError") throw rpcError(`RPC request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check that an RPC endpoint is reachable and serves the expected Base chain.
 * This function is read-only: it only calls eth_chainId and eth_blockNumber.
 */
export async function checkBaseRpc({
  rpcUrl,
  network = "base",
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const target = NETWORKS[network];
  if (!target) throw new TypeError('network must be "base" or "base-sepolia"');
  if (typeof rpcUrl !== "string" || !["http:", "https:"].includes(new URL(rpcUrl).protocol)) {
    throw new TypeError("rpcUrl must be a valid HTTP or HTTPS URL");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError("timeoutMs must be a positive integer");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  const chainIdHex = await rpcRequest(fetchImpl, rpcUrl, "eth_chainId", timeoutMs);
  if (!/^0x[0-9a-f]+$/i.test(chainIdHex)) throw rpcError("RPC returned an invalid chain ID");
  const chainId = Number(BigInt(chainIdHex));
  if (chainId !== target.chainId) {
    throw rpcError(`Wrong network: expected ${target.name} (chain ID ${target.chainId}), received ${chainId}`);
  }

  const blockHex = await rpcRequest(fetchImpl, rpcUrl, "eth_blockNumber", timeoutMs);
  if (!/^0x[0-9a-f]+$/i.test(blockHex)) throw rpcError("RPC returned an invalid block number");

  return {
    ok: true,
    network,
    chainId,
    latestBlock: BigInt(blockHex).toString(),
  };
}

export { NETWORKS };
