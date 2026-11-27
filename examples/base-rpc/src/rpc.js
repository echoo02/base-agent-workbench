const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const BASE_NETWORKS = Object.freeze({
  mainnet: { chainId: 8453, name: "Base Mainnet" },
  sepolia: { chainId: 84532, name: "Base Sepolia" }
});

export function assertAddress(address) {
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
    throw new TypeError("Expected a 20-byte 0x-prefixed EVM address.");
  }
  return address;
}

export async function rpcRequest(rpcUrl, method, params = [], fetchImpl = fetch) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("RPC_URL must be a valid HTTP(S) URL.");
  }

  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC error ${payload.error.code}: ${payload.error.message}`);
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new Error("Malformed JSON-RPC response: missing result.");
  }
  return payload.result;
}

export async function getChainId(rpcUrl, fetchImpl) {
  const hex = await rpcRequest(rpcUrl, "eth_chainId", [], fetchImpl);
  return Number(BigInt(hex));
}

export async function getNativeBalance(rpcUrl, address, fetchImpl) {
  assertAddress(address);
  const hex = await rpcRequest(rpcUrl, "eth_getBalance", [address, "latest"], fetchImpl);
  return BigInt(hex);
}

export function formatEther(wei) {
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
