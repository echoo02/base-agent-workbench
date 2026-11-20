import test from "node:test";
import assert from "node:assert/strict";
import { assertAddress, formatEther, getChainId, rpcRequest } from "../src/rpc.js";
import { previewTransaction } from "../src/transaction-preview.js";

const address = "0x000000000000000000000000000000000000dEaD";

test("accepts a valid EVM address and rejects malformed input", () => {
  assert.equal(assertAddress(address), address);
  assert.throws(() => assertAddress("0x1234"), /20-byte/);
});

test("formats wei without floating point rounding", () => {
  assert.equal(formatEther(1_250_000_000_000_000_000n), "1.25");
  assert.equal(formatEther(0n), "0");
});

test("reads chain ID through JSON-RPC", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result: "0x2105" })
  });
  assert.equal(await getChainId("https://rpc.example", fakeFetch), 8453);
});

test("surfaces JSON-RPC errors", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "failed" } })
  });
  await assert.rejects(() => rpcRequest("https://rpc.example", "eth_chainId", [], fakeFetch), /RPC error -1/);
});

test("previews an unsigned Base Sepolia transaction", () => {
  assert.deepEqual(previewTransaction({ network: "sepolia", to: address, valueEth: "0.015" }), {
    chainId: 84532,
    to: address,
    value: "0x353a4c5a9b0000",
    data: "0x"
  });
});

test("rejects unsafe or malformed transaction values", () => {
  assert.throws(() => previewTransaction({ network: "mainnet", to: address, valueEth: "-1" }), /non-negative/);
  assert.throws(() => previewTransaction({ network: "unknown", to: address, valueEth: "0" }), /network/);
});
