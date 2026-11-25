import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBaseTransaction, decodeTransferLog } from "./index.mjs";

const HASH = "0x" + "a".repeat(64);
const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const addressTopic = (address) => "0x" + "0".repeat(24) + address.slice(2);
const transferLog = { address: TOKEN, topics: [TRANSFER, addressTopic(FROM), addressTopic(TO)], data: "0x" + "0".repeat(62) + "2a", logIndex: "0x2" };

function fixture(overrides = {}) {
  const responses = {
    eth_chainId: "0x2105",
    eth_getTransactionByHash: { hash: HASH, from: FROM, to: TOKEN, value: "0xde0b6b3a7640000" },
    eth_getTransactionReceipt: { transactionHash: HASH, blockNumber: "0x64", status: "0x1", gasUsed: "0x5208", effectiveGasPrice: "0x3b9aca00", logs: [transferLog] },
    eth_getBlockByNumber: { number: "0x64", timestamp: "0x6553f100" },
    ...overrides,
  };
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: request.id, result: responses[request.method] }) };
  };
  return { fetchImpl, calls };
}

test("decodes Transfer logs with exact integer values", () => {
  assert.deepEqual(decodeTransferLog(transferLog), { token: TOKEN, from: FROM, to: TO, value: "42", logIndex: "2" });
});
test("rejects malformed Transfer logs", () => {
  assert.throws(() => decodeTransferLog({ topics: [] }), /at least three topics/);
  assert.throws(() => decodeTransferLog({ ...transferLog, data: "0x01" }), /uint256/);
});
test("analyzes Base Mainnet transaction and computes fee exactly", async () => {
  const { fetchImpl, calls } = fixture();
  const result = await analyzeBaseTransaction({ rpcUrl: "https://mainnet.base.org", txHash: HASH, chainId: 8453, fetchImpl });
  assert.equal(result.status, "success");
  assert.equal(result.blockNumber, "100");
  assert.equal(result.from, FROM);
  assert.equal(result.to, TOKEN);
  assert.equal(result.nativeValueWei, "1000000000000000000");
  assert.equal(result.gasUsed, "21000");
  assert.equal(result.effectiveGasPriceWei, "1000000000");
  assert.equal(result.feePaidWei, "21000000000000");
  assert.equal(result.transfers[0].value, "42");
  assert.deepEqual(calls.map((call) => call.method), ["eth_chainId", "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getBlockByNumber"]);
});
test("supports Base Sepolia and reports failed receipts", async () => {
  const { fetchImpl } = fixture({ eth_chainId: "0x14a34" });
  const modified = async (url, options) => {
    const request = JSON.parse(options.body);
    const response = await fetchImpl(url, options);
    const body = await response.json();
    if (request.method === "eth_getTransactionReceipt") body.result.status = "0x0";
    return { ...response, json: async () => body };
  };
  const result = await analyzeBaseTransaction({ rpcUrl: "https://sepolia.base.org", txHash: HASH, chainId: 84532, fetchImpl: modified });
  assert.equal(result.status, "failed");
});
test("rejects a wrong network", async () => {
  const { fetchImpl } = fixture({ eth_chainId: "0x1" });
  await assert.rejects(analyzeBaseTransaction({ rpcUrl: "https://example.com", txHash: HASH, chainId: 8453, fetchImpl }), /Wrong network/);
});
test("rejects missing transaction or receipt", async () => {
  const { fetchImpl } = fixture({ eth_getTransactionReceipt: null });
  await assert.rejects(analyzeBaseTransaction({ rpcUrl: "https://example.com", txHash: HASH, chainId: 8453, fetchImpl }), /pending, unavailable, or not found/);
});
test("rejects mismatched block data", async () => {
  const { fetchImpl } = fixture({ eth_getBlockByNumber: { number: "0x65", timestamp: "0x6553f100" } });
  await assert.rejects(analyzeBaseTransaction({ rpcUrl: "https://example.com", txHash: HASH, chainId: 8453, fetchImpl }), /does not match/);
});
test("validates endpoint, hash, and chain ID", async () => {
  const args = { txHash: HASH, chainId: 8453, fetchImpl: async () => { throw new Error("should not run"); } };
  await assert.rejects(analyzeBaseTransaction({ ...args, rpcUrl: "ftp://example.com" }), /HTTP\(S\)/);
  await assert.rejects(analyzeBaseTransaction({ ...args, rpcUrl: "https://example.com", txHash: "0x123" }), /32-byte/);
  await assert.rejects(analyzeBaseTransaction({ ...args, rpcUrl: "https://example.com", chainId: 1 }), /chainId/);
});
test("surfaces JSON-RPC errors and rejects malformed transaction data", async () => {
  const { fetchImpl } = fixture({ eth_getTransactionByHash: { hash: HASH, from: "bad", to: null, value: "0x0" } });
  await assert.rejects(analyzeBaseTransaction({ rpcUrl: "https://example.com", txHash: HASH, chainId: 8453, fetchImpl }), /transaction.from/);
  const rpcError = async () => ({ ok: true, status: 200, json: async () => ({ error: { code: -32000, message: "upstream unavailable" } }) });
  await assert.rejects(analyzeBaseTransaction({ rpcUrl: "https://example.com", txHash: HASH, chainId: 8453, fetchImpl: rpcError }), /upstream unavailable/);
});
