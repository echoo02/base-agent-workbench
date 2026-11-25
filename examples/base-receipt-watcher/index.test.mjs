import test from "node:test";
import assert from "node:assert/strict";
import { waitForBaseReceipt } from "./index.mjs";

const TX = `0x${"a".repeat(64)}`;
const RPC_URL = "https://mainnet.base.org";

function mockFetch(handlers) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request.method);
    const result = await handlers(request.method, calls.filter((method) => method === request.method).length);
    return {
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: request.id, result }),
    };
  };
  return { fetchImpl, calls };
}

test("verifies Base Mainnet and returns a receipt at the requested depth", async () => {
  const receipt = {
    transactionHash: TX,
    blockNumber: "0x64",
    status: "0x1",
  };
  const { fetchImpl, calls } = mockFetch((method) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_getTransactionReceipt") return receipt;
    if (method === "eth_blockNumber") return "0x65";
    throw new Error(`Unexpected method: ${method}`);
  });

  const result = await waitForBaseReceipt({
    rpcUrl: RPC_URL,
    txHash: TX,
    chainId: 8453,
    confirmations: 2,
    fetchImpl,
    sleepFn: async () => {},
  });

  assert.equal(result.confirmations, 2);
  assert.equal(result.transactionHash, TX);
  assert.deepEqual(calls, ["eth_chainId", "eth_getTransactionReceipt", "eth_blockNumber"]);
});

test("rejects a mismatched chain before checking the transaction", async () => {
  const { fetchImpl, calls } = mockFetch(() => "0x14a34");
  await assert.rejects(
    waitForBaseReceipt({ rpcUrl: RPC_URL, txHash: TX, chainId: 8453, fetchImpl }),
    /Wrong network/,
  );
  assert.deepEqual(calls, ["eth_chainId"]);
});

test("polls while the transaction is pending", async () => {
  let receiptChecks = 0;
  const { fetchImpl } = mockFetch((method) => {
    if (method === "eth_chainId") return "0x14a34";
    if (method === "eth_getTransactionReceipt") {
      receiptChecks += 1;
      return receiptChecks === 1 ? null : {
        transactionHash: TX,
        blockNumber: "0x10",
        status: "0x1",
      };
    }
    if (method === "eth_blockNumber") return "0x10";
    throw new Error(`Unexpected method: ${method}`);
  });

  const result = await waitForBaseReceipt({
    rpcUrl: RPC_URL,
    txHash: TX,
    chainId: 84532,
    fetchImpl,
    sleepFn: async () => {},
  });

  assert.equal(receiptChecks, 2);
  assert.equal(result.confirmations, 1);
});

test("reports reverted transactions", async () => {
  const { fetchImpl } = mockFetch((method) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_getTransactionReceipt") {
      return { transactionHash: TX, blockNumber: "0x10", status: "0x0" };
    }
    throw new Error(`Unexpected method: ${method}`);
  });

  await assert.rejects(
    waitForBaseReceipt({ rpcUrl: RPC_URL, txHash: TX, chainId: 8453, fetchImpl }),
    /Transaction reverted/,
  );
});

test("times out if the receipt never appears", async () => {
  let now = 0;
  const { fetchImpl } = mockFetch((method) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_getTransactionReceipt") return null;
    throw new Error(`Unexpected method: ${method}`);
  });

  await assert.rejects(
    waitForBaseReceipt({
      rpcUrl: RPC_URL,
      txHash: TX,
      chainId: 8453,
      timeoutMs: 10,
      pollIntervalMs: 10,
      fetchImpl,
      nowFn: () => now,
      sleepFn: async (ms) => { now += ms; },
    }),
    /Timed out waiting/,
  );
});

test("validates transaction hash and confirmation count", async () => {
  await assert.rejects(
    waitForBaseReceipt({ rpcUrl: RPC_URL, txHash: "0x1234", chainId: 8453 }),
    /32-byte transaction hash/,
  );
  await assert.rejects(
    waitForBaseReceipt({ rpcUrl: RPC_URL, txHash: TX, chainId: 8453, confirmations: 0 }),
    /positive integer/,
  );
});
