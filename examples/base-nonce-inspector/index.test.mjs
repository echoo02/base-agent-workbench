import test from "node:test";
import assert from "node:assert/strict";
import { inspectBaseNonce } from "./index.mjs";

const ADDRESS = "0x2222222222222222222222222222222222222222";
const RPC_URL = "https://mainnet.base.org";

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const result = await handler(request);
    return {
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: request.id, result }),
    };
  };
  return { fetchImpl, calls };
}

test("reads latest and pending nonce on Base Mainnet", async () => {
  const { fetchImpl, calls } = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_getTransactionCount" && params[1] === "latest") return "0x2a";
    if (method === "eth_getTransactionCount" && params[1] === "pending") return "0x2c";
    throw new Error("Unexpected RPC request");
  });

  const result = await inspectBaseNonce({
    rpcUrl: RPC_URL, chainId: 8453, address: ADDRESS, fetchImpl,
  });

  assert.deepEqual(result, {
    chainId: 8453,
    address: ADDRESS,
    latestNonce: "42",
    pendingNonce: "44",
    pendingTransactions: "2",
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.slice(1).map((call) => call.params[1]), ["latest", "pending"]);
});

test("supports Base Sepolia and accounts with no pending transactions", async () => {
  const { fetchImpl } = mockFetch(({ method }) => {
    if (method === "eth_chainId") return "0x14a34";
    if (method === "eth_getTransactionCount") return "0x0";
    throw new Error("Unexpected RPC request");
  });

  const result = await inspectBaseNonce({
    rpcUrl: RPC_URL, chainId: 84532, address: ADDRESS, fetchImpl,
  });
  assert.equal(result.pendingTransactions, "0");
});

test("rejects a wrong network before reading the nonce", async () => {
  const { fetchImpl, calls } = mockFetch(() => "0x14a34");
  await assert.rejects(
    inspectBaseNonce({ rpcUrl: RPC_URL, chainId: 8453, address: ADDRESS, fetchImpl }),
    /Wrong network/,
  );
  assert.equal(calls.length, 1);
});

test("validates RPC URL, chain ID, and address", async () => {
  await assert.rejects(
    inspectBaseNonce({ rpcUrl: "file:///tmp/rpc", chainId: 8453, address: ADDRESS }),
    /HTTP\(S\)/,
  );
  await assert.rejects(
    inspectBaseNonce({ rpcUrl: RPC_URL, chainId: 1, address: ADDRESS }),
    /chainId/,
  );
  await assert.rejects(
    inspectBaseNonce({ rpcUrl: RPC_URL, chainId: 8453, address: "0x123" }),
    /20-byte EVM address/,
  );
});

test("rejects malformed nonce quantities and pending nonce below latest", async () => {
  const malformed = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (params[1] === "latest") return "42";
    return "0x2b";
  });
  await assert.rejects(
    inspectBaseNonce({
      rpcUrl: RPC_URL, chainId: 8453, address: ADDRESS, fetchImpl: malformed.fetchImpl,
    }),
    /canonical hex quantity/,
  );

  const inconsistent = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    return params[1] === "latest" ? "0x2b" : "0x2a";
  });
  await assert.rejects(
    inspectBaseNonce({
      rpcUrl: RPC_URL, chainId: 8453, address: ADDRESS, fetchImpl: inconsistent.fetchImpl,
    }),
    /pending nonce is lower/,
  );
});

test("propagates JSON-RPC errors", async () => {
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: "method not found" },
      }),
    };
  };

  await assert.rejects(
    inspectBaseNonce({
      rpcUrl: RPC_URL, chainId: 8453, address: ADDRESS, fetchImpl,
    }),
    /eth_chainId failed \(-32601\): method not found/,
  );
});
