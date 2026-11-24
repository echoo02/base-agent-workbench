import test from "node:test";
import assert from "node:assert/strict";
import { checkBaseRpc } from "./index.mjs";

function mockFetch(results) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request.method);
    const next = results.shift();
    if (next instanceof Error) throw next;
    return { ok: true, json: async () => next };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const result = (value) => ({ jsonrpc: "2.0", id: 1, result: value });

test("checks Base Mainnet chain ID and latest block", async () => {
  const fetchImpl = mockFetch([result("0x2105"), result("0x1234")]);
  const health = await checkBaseRpc({ rpcUrl: "https://rpc.example", fetchImpl });
  assert.deepEqual(health, { ok: true, network: "base", chainId: 8453, latestBlock: "4660" });
  assert.deepEqual(fetchImpl.calls, ["eth_chainId", "eth_blockNumber"]);
});

test("supports Base Sepolia", async () => {
  const health = await checkBaseRpc({
    rpcUrl: "https://rpc.example",
    network: "base-sepolia",
    fetchImpl: mockFetch([result("0x14a34"), result("0x2")]),
  });
  assert.equal(health.chainId, 84532);
});

test("rejects an endpoint on the wrong chain", async () => {
  await assert.rejects(
    checkBaseRpc({ rpcUrl: "https://rpc.example", fetchImpl: mockFetch([result("0x1")]) }),
    /Wrong network/,
  );
});

test("rejects malformed JSON-RPC responses", async () => {
  await assert.rejects(
    checkBaseRpc({ rpcUrl: "https://rpc.example", fetchImpl: mockFetch([{ jsonrpc: "2.0", id: 2, result: "0x2105" }]) }),
    /invalid JSON-RPC response/,
  );
});

test("surfaces JSON-RPC errors", async () => {
  await assert.rejects(
    checkBaseRpc({
      rpcUrl: "https://rpc.example",
      fetchImpl: mockFetch([{ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "rate limited" } }]),
    }),
    /rate limited/,
  );
});

test("turns aborts into a clear timeout error", async () => {
  const fetchImpl = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  await assert.rejects(
    checkBaseRpc({ rpcUrl: "https://rpc.example", timeoutMs: 10, fetchImpl }),
    /timed out after 10ms/,
  );
});

test("validates URL and network options", async () => {
  await assert.rejects(checkBaseRpc({ rpcUrl: "file:///tmp/rpc" }), /valid HTTP or HTTPS URL/);
  await assert.rejects(checkBaseRpc({ rpcUrl: "https://rpc.example", network: "ethereum" }), /network must be/);
});
