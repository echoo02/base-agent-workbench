import { pathToFileURL } from "node:url";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function assertAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) throw new TypeError(label + " must be a 20-byte hex address");
  return value.toLowerCase();
}
function quantity(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new TypeError(label + " must be a hex quantity");
  return BigInt(value);
}
function topicAddress(topic, label) {
  if (typeof topic !== "string" || !/^0x[0-9a-f]{64}$/i.test(topic)) throw new TypeError(label + " must be a 32-byte topic");
  if (!/^0{24}/i.test(topic.slice(2, 26))) throw new TypeError(label + " is not a correctly padded address topic");
  return "0x" + topic.slice(-40).toLowerCase();
}

export function decodeTransferLog(log) {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 3) throw new TypeError("Transfer log must contain at least three topics");
  if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) throw new TypeError("Log is not an ERC-20 Transfer event");
  if (typeof log.data !== "string" || !/^0x[0-9a-f]{64}$/i.test(log.data)) throw new TypeError("Transfer event data must contain one uint256 value");
  return {
    token: assertAddress(log.address, "log.address"),
    from: topicAddress(log.topics[1], "Transfer from topic"),
    to: topicAddress(log.topics[2], "Transfer to topic"),
    value: BigInt(log.data).toString(),
    logIndex: log.logIndex == null ? null : quantity(log.logIndex, "logIndex").toString(),
  };
}

async function rpc(fetchImpl, rpcUrl, method, params, id) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok) throw new Error(("RPC HTTP error: " + response.status + " " + (response.statusText || "")).trim());
  const payload = await response.json();
  if (payload.error) throw new Error("RPC " + method + " failed (" + payload.error.code + "): " + payload.error.message);
  if (!Object.hasOwn(payload, "result")) throw new Error("RPC " + method + " returned no result");
  return payload.result;
}

/** Inspect a mined Base transaction with read-only JSON-RPC calls. */
export async function analyzeBaseTransaction({ rpcUrl, txHash, chainId, fetchImpl = fetch } = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) throw new TypeError("rpcUrl must be an HTTP(S) URL");
  if (typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) throw new TypeError("txHash must be a 32-byte transaction hash");
  if (!Number.isSafeInteger(chainId) || ![8453, 84532].includes(chainId)) throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");

  const expectedChainId = "0x" + chainId.toString(16);
  const actualChainId = await rpc(fetchImpl, rpcUrl, "eth_chainId", [], 1);
  if (String(actualChainId).toLowerCase() !== expectedChainId) throw new Error("Wrong network: expected " + expectedChainId + ", received " + actualChainId);

  const [transaction, receipt] = await Promise.all([
    rpc(fetchImpl, rpcUrl, "eth_getTransactionByHash", [txHash], 2),
    rpc(fetchImpl, rpcUrl, "eth_getTransactionReceipt", [txHash], 3),
  ]);
  if (!transaction || !receipt) throw new Error("Transaction is pending, unavailable, or not found");
  if (String(receipt.transactionHash).toLowerCase() !== txHash.toLowerCase()) throw new Error("Receipt transaction hash does not match the requested hash");
  if (String(transaction.hash).toLowerCase() !== txHash.toLowerCase()) throw new Error("Transaction hash does not match the requested hash");
  if (!Array.isArray(receipt.logs)) throw new TypeError("Receipt logs must be an array");

  const blockNumber = quantity(receipt.blockNumber, "receipt.blockNumber");
  const block = await rpc(fetchImpl, rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false], 4);
  if (!block) throw new Error("Transaction block was not found");
  if (quantity(block.number, "block.number") !== blockNumber) throw new Error("Returned block number does not match the receipt");

  const statusValue = quantity(receipt.status, "receipt.status");
  if (statusValue !== 0n && statusValue !== 1n) throw new Error("Receipt status must be 0x0 or 0x1");
  const gasUsed = quantity(receipt.gasUsed, "receipt.gasUsed");
  const effectiveGasPrice = quantity(receipt.effectiveGasPrice, "receipt.effectiveGasPrice");
  const timestamp = Number(quantity(block.timestamp, "block.timestamp"));
  if (!Number.isSafeInteger(timestamp)) throw new RangeError("Block timestamp is outside the safe integer range");

  const transfers = [];
  for (const log of receipt.logs) {
    if (Array.isArray(log?.topics) && String(log.topics[0]).toLowerCase() === TRANSFER_TOPIC) transfers.push(decodeTransferLog(log));
  }
  return {
    transactionHash: txHash.toLowerCase(),
    chainId,
    status: statusValue === 1n ? "success" : "failed",
    blockNumber: blockNumber.toString(),
    blockTimestamp: timestamp,
    blockTimestampIso: new Date(timestamp * 1000).toISOString(),
    from: assertAddress(transaction.from, "transaction.from"),
    to: transaction.to == null ? null : assertAddress(transaction.to, "transaction.to"),
    nativeValueWei: quantity(transaction.value, "transaction.value").toString(),
    gasUsed: gasUsed.toString(),
    effectiveGasPriceWei: effectiveGasPrice.toString(),
    feePaidWei: (gasUsed * effectiveGasPrice).toString(),
    transfers,
  };
}

async function main() {
  const txHash = process.argv[2];
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = Number(process.env.BASE_CHAIN_ID);
  if (!rpcUrl || !txHash || !process.env.BASE_CHAIN_ID) throw new Error("Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <tx-hash>");
  console.log(JSON.stringify(await analyzeBaseTransaction({ rpcUrl, txHash, chainId }), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
