import { pathToFileURL } from "node:url";

const DEFAULT_CHAIN_ID = 84532n;

export async function callRpc(rpcUrl, method, params = [], fetchImpl = fetch) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`.trim());
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("RPC returned invalid JSON");
  }

  if (payload.error) {
    throw new Error(`RPC error ${payload.error.code ?? "unknown"}: ${payload.error.message ?? "request failed"}`);
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new Error("RPC response is missing result");
  }

  return payload.result;
}

function parseQuantity(value, field) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`Invalid ${field} quantity returned by RPC`);
  }
  return BigInt(value);
}

function toGwei(value) {
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Build a read-only EIP-1559 fee quote for Base.
 * No wallet, signing key, or transaction submission is used.
 */
export async function getFeeQuote({
  rpcUrl,
  expectedChainId = DEFAULT_CHAIN_ID,
  fetchImpl = fetch,
} = {}) {
  if (!rpcUrl) throw new Error("Missing rpcUrl");

  const chainId = parseQuantity(
    await callRpc(rpcUrl, "eth_chainId", [], fetchImpl),
    "chain ID",
  );
  if (chainId !== BigInt(expectedChainId)) {
    throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${chainId}`);
  }

  const history = await callRpc(
    rpcUrl,
    "eth_feeHistory",
    ["0x5", "latest", [50]],
    fetchImpl,
  );

  if (!Array.isArray(history.baseFeePerGas) || history.baseFeePerGas.length === 0) {
    throw new Error("eth_feeHistory returned no base fee data");
  }

  const baseFeePerGas = parseQuantity(history.baseFeePerGas.at(-1), "base fee");
  let maxPriorityFeePerGas;

  const medianReward = history.reward?.at(-1)?.[0];
  if (medianReward !== undefined) {
    maxPriorityFeePerGas = parseQuantity(medianReward, "priority fee");
  } else {
    maxPriorityFeePerGas = parseQuantity(
      await callRpc(rpcUrl, "eth_maxPriorityFeePerGas", [], fetchImpl),
      "priority fee",
    );
  }

  const maxFeePerGas = baseFeePerGas * 2n + maxPriorityFeePerGas;

  return {
    chainId: chainId.toString(),
    baseFeePerGas: baseFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    baseFeeGwei: toGwei(baseFeePerGas),
    priorityFeeGwei: toGwei(maxPriorityFeePerGas),
    maxFeeGwei: toGwei(maxFeePerGas),
    source: "eth_feeHistory",
  };
}

async function main() {
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = process.env.BASE_CHAIN_ID
    ? BigInt(process.env.BASE_CHAIN_ID)
    : DEFAULT_CHAIN_ID;

  const quote = await getFeeQuote({ rpcUrl, expectedChainId: chainId });
  console.log(JSON.stringify(quote, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Fee quote failed: ${error.message}`);
    process.exitCode = 1;
  });
}
