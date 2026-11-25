const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function toQuantity(value, label) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return `0x${value.toString(16)}`;
  }

  if (typeof value === "string" && /^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) {
    return value.startsWith("0x") ? value.toLowerCase() : `0x${BigInt(value).toString(16)}`;
  }

  throw new TypeError(`${label} must be a non-negative integer or hex quantity`);
}

async function rpcCall(fetchImpl, rpcUrl, method, params, requestId) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
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
 * Wait for a transaction to be mined and reach the requested confirmation depth.
 * This helper is read-only: it never signs or broadcasts transactions.
 */
export async function waitForBaseReceipt({
  rpcUrl,
  txHash,
  chainId,
  confirmations = 1,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowFn = () => Date.now(),
} = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("rpcUrl must be an HTTP(S) URL");
  }
  if (typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    throw new TypeError("txHash must be a 32-byte transaction hash");
  }
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) {
    throw new TypeError("confirmations must be a positive integer");
  }
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0) {
    throw new TypeError("pollIntervalMs must be a non-negative integer");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    throw new TypeError("timeoutMs must be a non-negative integer");
  }

  const expectedChainId = toQuantity(chainId, "chainId");
  const actualChainId = await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], 1);
  if (String(actualChainId).toLowerCase() !== expectedChainId) {
    throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${actualChainId}`);
  }

  const deadline = nowFn() + timeoutMs;
  let requestId = 2;

  while (true) {
    const receipt = await rpcCall(fetchImpl, rpcUrl, "eth_getTransactionReceipt", [txHash], requestId++);
    if (receipt) {
      if (receipt.status === "0x0" || receipt.status === "0x00") {
        throw new Error(`Transaction reverted: ${txHash}`);
      }

      const receiptBlock = BigInt(receipt.blockNumber);
      const headHex = await rpcCall(fetchImpl, rpcUrl, "eth_blockNumber", [], requestId++);
      const head = BigInt(headHex);
      const depth = head >= receiptBlock ? Number(head - receiptBlock + 1n) : 0;

      if (depth >= confirmations) {
        return { ...receipt, confirmations: depth, chainId: expectedChainId };
      }
    }

    const remaining = deadline - nowFn();
    if (remaining <= 0) {
      throw new Error(`Timed out waiting for ${txHash} to reach ${confirmations} confirmation(s)`);
    }
    await sleepFn(Math.min(pollIntervalMs, remaining));
  }
}

async function main() {
  const [txHash, requestedConfirmations = "1"] = process.argv.slice(2);
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = process.env.BASE_CHAIN_ID;
  const confirmations = Number(requestedConfirmations);

  if (!rpcUrl || !chainId || !txHash) {
    throw new Error(
      "Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <tx-hash> [confirmations]",
    );
  }

  const receipt = await waitForBaseReceipt({ rpcUrl, txHash, chainId, confirmations });
  console.log(JSON.stringify({
    transactionHash: receipt.transactionHash,
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    confirmations: receipt.confirmations,
    chainId: receipt.chainId,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
