import test from "node:test";
import assert from "node:assert/strict";
import { getBaseTokenAllowance } from "./index.mjs";

const rpcUrl = "https://mainnet.base.org";
const tokenAddress = "0x1111111111111111111111111111111111111111";
const ownerAddress = "0x2222222222222222222222222222222222222222";
const spenderAddress = "0x3333333333333333333333333333333333333333";
const word = (value) => BigInt(value).toString(16).padStart(64, "0");

function mockFetch(results) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const result = results.shift();
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => result,
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("reads an allowance and preserves uint256 precision", async () => {
  const fetchImpl = mockFetch([
    { jsonrpc: "2.0", id: 1, result: "0x2105" },
    { jsonrpc: "2.0", id: 1, result: `0x${word("115792089237316195423570985008687907853269984665640564039457584007913129639935")}` },
  ]);
  const result = await getBaseTokenAllowance({
    rpcUrl, chainId: 8453, tokenAddress, ownerAddress, spenderAddress, fetchImpl,
  });

  assert.equal(result.chainId, 8453);
  assert.equal(result.allowance, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
  assert.equal(fetchImpl.calls[1].method, "eth_call");
  assert.equal(fetchImpl.calls[1].params[0].to, tokenAddress);
  assert.equal(fetchImpl.calls[1].params[0].data,
    `0xdd62ed3e${ownerAddress.slice(2)}${spenderAddress.slice(2)}`);
  assert.equal(fetchImpl.calls[1].params[1], "latest");
});

test("supports Base Sepolia", async () => {
  const fetchImpl = mockFetch([
    { result: "0x14a34" },
    { result: `0x${word(42)}` },
  ]);
  const result = await getBaseTokenAllowance({
    rpcUrl: "https://sepolia.base.org", chainId: 84532,
    tokenAddress, ownerAddress, spenderAddress, fetchImpl,
  });
  assert.equal(result.allowance, "42");
  assert.equal(result.chainId, 84532);
});

test("rejects an RPC endpoint on the wrong chain before eth_call", async () => {
  const fetchImpl = mockFetch([{ result: "0x1" }]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 8453, tokenAddress, ownerAddress, spenderAddress, fetchImpl }),
    /Wrong network/,
  );
  assert.equal(fetchImpl.calls.length, 1);
});

test("rejects malformed addresses before making RPC requests", async () => {
  const fetchImpl = mockFetch([]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 8453, tokenAddress: "0x1234", ownerAddress, spenderAddress, fetchImpl }),
    /tokenAddress must be a 20-byte EVM address/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test("rejects unsupported chain IDs", async () => {
  const fetchImpl = mockFetch([]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 1, tokenAddress, ownerAddress, spenderAddress, fetchImpl }),
    /chainId must be 8453/,
  );
});

test("rejects malformed uint256 return data", async () => {
  const fetchImpl = mockFetch([{ result: "0x2105" }, { result: "0x1234" }]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 8453, tokenAddress, ownerAddress, spenderAddress, fetchImpl }),
    /invalid uint256 allowance/,
  );
});

test("surfaces JSON-RPC errors", async () => {
  const fetchImpl = mockFetch([
    { result: "0x2105" },
    { error: { code: -32000, message: "execution reverted" } },
  ]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 8453, tokenAddress, ownerAddress, spenderAddress, fetchImpl }),
    /execution reverted/,
  );
});

test("validates the request timeout", async () => {
  const fetchImpl = mockFetch([]);
  await assert.rejects(
    getBaseTokenAllowance({ rpcUrl, chainId: 8453, tokenAddress, ownerAddress, spenderAddress, fetchImpl, timeoutMs: 0 }),
    /timeoutMs must be a positive safe integer/,
  );
});
