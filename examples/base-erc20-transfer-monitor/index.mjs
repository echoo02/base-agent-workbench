const BASE_CHAIN_IDS = new Set([8453, 84532]);
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_TIMEOUT_MS = 10_000;

function validateAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new TypeError(label + " must be a 20-byte EVM address");
  return value.toLowerCase();
}
function topicAddress(address) { return "0x" + address.slice(2).padStart(64, "0"); }
function parseQuantity(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error("RPC returned an invalid " + label);
  return BigInt(value);
}
async function rpcCall(fetchImpl, rpcUrl, method, params, timeoutMs) {
  const response = await fetchImpl(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(("RPC HTTP error: " + response.status + " " + (response.statusText ?? "")).trim());
  const payload = await response.json();
  if (payload?.error) throw new Error("RPC " + method + " failed (" + payload.error.code + "): " + payload.error.message);
  if (!payload || !Object.hasOwn(payload, "result")) throw new Error("RPC " + method + " returned no result");
  return payload.result;
}

/** Read ERC-20 Transfer logs over an explicit block range on Base. Read-only. */
export async function getBaseErc20Transfers({ rpcUrl, chainId, tokenAddress, fromBlock, toBlock, fromAddress, toAddress, maxBlockRange = 2000, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) throw new TypeError("rpcUrl must be an HTTP(S) URL");
  if (!Number.isSafeInteger(chainId) || !BASE_CHAIN_IDS.has(chainId)) throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs must be a positive safe integer");
  if (!Number.isSafeInteger(maxBlockRange) || maxBlockRange <= 0) throw new TypeError("maxBlockRange must be a positive safe integer");
  if (!Number.isSafeInteger(fromBlock) || fromBlock < 0 || !Number.isSafeInteger(toBlock) || toBlock < fromBlock) throw new TypeError("fromBlock and toBlock must be valid non-negative block numbers with toBlock >= fromBlock");
  const token = validateAddress(tokenAddress, "tokenAddress");
  const from = fromAddress === undefined ? undefined : validateAddress(fromAddress, "fromAddress");
  const to = toAddress === undefined ? undefined : validateAddress(toAddress, "toAddress");
  const actualChainId = Number(parseQuantity(await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], timeoutMs), "chain ID"));
  if (actualChainId !== chainId) throw new Error("Wrong network: expected chain ID " + chainId + ", received " + actualChainId);
  const topics = [TRANSFER_TOPIC, from ? topicAddress(from) : null, to ? topicAddress(to) : null];
  const transfers = [];
  for (let start = fromBlock; start <= toBlock; start += maxBlockRange) {
    const end = Math.min(toBlock, start + maxBlockRange - 1);
    const logs = await rpcCall(fetchImpl, rpcUrl, "eth_getLogs", [{ address: token, fromBlock: "0x" + start.toString(16), toBlock: "0x" + end.toString(16), topics }], timeoutMs);
    if (!Array.isArray(logs)) throw new Error("eth_getLogs returned an invalid log list");
    for (const log of logs) {
      if (!log || !Array.isArray(log.topics) || log.topics.length !== 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC || !/^0x[0-9a-f]{64}$/i.test(log.topics[1]) || !/^0x[0-9a-f]{64}$/i.test(log.topics[2]) || typeof log.data !== "string" || !/^0x[0-9a-f]{64}$/i.test(log.data)) throw new Error("eth_getLogs returned a malformed ERC-20 Transfer log");
      const logToken = validateAddress(log.address, "log.address");
      if (logToken !== token) throw new Error("eth_getLogs returned a log for an unexpected token");
      const blockNumber = parseQuantity(log.blockNumber, "log block number");
      if (blockNumber < BigInt(start) || blockNumber > BigInt(end)) throw new Error("eth_getLogs returned a log outside the requested block range");
      transfers.push({ tokenAddress: logToken, fromAddress: "0x" + log.topics[1].slice(-40).toLowerCase(), toAddress: "0x" + log.topics[2].slice(-40).toLowerCase(), amount: BigInt(log.data).toString(), blockNumber: blockNumber.toString(), transactionHash: log.transactionHash, logIndex: parseQuantity(log.logIndex, "log index").toString() });
    }
  }
  return { chainId: actualChainId, tokenAddress: token, fromBlock, toBlock, transfers };
}