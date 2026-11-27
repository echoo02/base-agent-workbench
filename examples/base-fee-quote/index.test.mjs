import test from "node:test";
import assert from "node:assert/strict";
import { getFeeQuote } from "./index.mjs";

function mockFetch(results) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const next = results.shift();
    if (next instanceof Error) throw next;
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      statusText: next.statusText ?? "OK",
      json: async () => next.body,
    };
  };
  return { fetchImpl, calls };
}

test("returns a Base Sepolia EIP-1559 fee quote without sending a transaction", async () => {
  const { fetchImpl, calls } = mockFetch([
    { body: { jsonrpc: "2.0", id: 1, result: "0x14a34" } },
    {
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          baseFeePerGas: ["0x3b9aca00", "0x3b9aca00"],
          reward: [["0x5f5e100"]],
        },
      },
    },
  ]);

  const quote = await getFeeQuote({
    rpcUrl: "https://rpc.example",
    fetchImpl,
  });

  assert.equal(quote.chainId, "84532");
  assert.equal(quote.baseFeePerGas, "1000000000");
  assert.equal(quote.maxPriorityFeePerGas, "100000000");
  assert.equal(quote.maxFeePerGas, "2100000000");
  assert.equal(quote.maxFeeGwei, "2.1");
  assert.deepEqual(calls.map((call) => call.method), ["eth_chainId", "eth_feeHistory"]);
  assert.deepEqual(calls[1].params, ["0x5", "latest", [50]]);
});

test("rejects an RPC endpoint on the wrong chain", async () => {
  const { fetchImpl } = mockFetch([
    { body: { jsonrpc: "2.0", id: 1, result: "0x1" } },
  ]);

  await assert.rejects(
    getFeeQuote({ rpcUrl: "https://rpc.example", fetchImpl }),
    /Wrong network: expected chain ID 84532, received 1/,
  );
});

test("uses eth_maxPriorityFeePerGas when fee history has no reward samples", async () => {
  const { fetchImpl, calls } = mockFetch([
    { body: { jsonrpc: "2.0", id: 1, result: "0x14a34" } },
    {
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: { baseFeePerGas: ["0x3b9aca00"], reward: [] },
      },
    },
    { body: { jsonrpc: "2.0", id: 1, result: "0x5f5e100" } },
  ]);

  const quote = await getFeeQuote({
    rpcUrl: "https://rpc.example",
    fetchImpl,
  });

  assert.equal(quote.maxPriorityFeePerGas, "100000000");
  assert.deepEqual(calls.map((call) => call.method), [
    "eth_chainId",
    "eth_feeHistory",
    "eth_maxPriorityFeePerGas",
  ]);
});

test("surfaces JSON-RPC errors", async () => {
  const { fetchImpl } = mockFetch([
    {
      body: {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32601, message: "method not found" },
      },
    },
  ]);

  await assert.rejects(
    getFeeQuote({ rpcUrl: "https://rpc.example", fetchImpl }),
    /RPC error -32601: method not found/,
  );
});
