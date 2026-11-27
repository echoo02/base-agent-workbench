import test from "node:test";
import assert from "node:assert/strict";
import {
  checkBaseUsdcPayment,
  formatTokenAmount,
  parseTokenAmount,
} from "./index.mjs";

const TOKEN = "0x1111111111111111111111111111111111111111";
const OWNER = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x3333333333333333333333333333333333333333";
const RPC_URL = "https://mainnet.base.org";
const uint256 = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;

function mockFetch({ chainId = "0x2105", decimals = 6, balance = 25_000_000n, allowance = 20_000_000n, native = 1_000_000_000_000_000n } = {}) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    let result;
    if (request.method === "eth_chainId") result = chainId;
    else if (request.method === "eth_getBalance") result = uint256(native);
    else if (request.method === "eth_call" && request.params[0].data === "0x313ce567") result = uint256(decimals);
    else if (request.method === "eth_call" && request.params[0].data.startsWith("0x70a08231")) result = uint256(balance);
    else if (request.method === "eth_call" && request.params[0].data.startsWith("0xdd62ed3e")) result = uint256(allowance);
    else throw new Error("Unexpected RPC request");
    return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: request.id, result }) };
  };
  return { fetchImpl, calls };
}

test("parses and formats exact token units without floating-point math", () => {
  assert.equal(parseTokenAmount("12.3456", 6), 12345600n);
  assert.equal(parseTokenAmount("0001.2", 6), 1200000n);
  assert.equal(parseTokenAmount("42", 0), 42n);
  assert.equal(formatTokenAmount(12345600n, 6), "12.3456");
  assert.equal(formatTokenAmount(0n, 6), "0");
});

test("rejects invalid, zero, negative, exponent, and over-precision amounts", () => {
  for (const value of ["0", "0.000000", "-1", "+1", "1e3", ".5", "1.", "abc"]) {
    assert.throws(() => parseTokenAmount(value, 6));
  }
  assert.throws(() => parseTokenAmount("0.0000001", 6), /decimal places/);
  assert.throws(() => parseTokenAmount("1", -1), /decimals/);
});

test("reports a ready Base Mainnet payment when balance and allowance cover amount", async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await checkBaseUsdcPayment({
    rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
    ownerAddress: OWNER, spenderAddress: SPENDER, amount: "12.5", fetchImpl,
  });

  assert.equal(result.ready, true);
  assert.equal(result.sufficientBalance, true);
  assert.equal(result.sufficientAllowance, true);
  assert.equal(result.requestedAmountRaw, "12500000");
  assert.equal(result.tokenBalance, "25");
  assert.equal(result.allowance, "20");
  assert.equal(result.nativeBalanceWei, "1000000000000000");
  assert.equal(calls.length, 5);
  assert.equal(calls[0].method, "eth_chainId");
});

test("reports insufficient token balance and allowance independently", async () => {
  const { fetchImpl } = mockFetch({ balance: 5_000_000n, allowance: 2_000_000n });
  const result = await checkBaseUsdcPayment({
    rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
    ownerAddress: OWNER, spenderAddress: SPENDER, amount: "10", fetchImpl,
  });
  assert.equal(result.sufficientBalance, false);
  assert.equal(result.sufficientAllowance, false);
  assert.equal(result.ready, false);
});

test("verifies Base Sepolia chain before reading balances", async () => {
  const { fetchImpl, calls } = mockFetch({ chainId: "0x14a34", balance: 10n, allowance: 10n, decimals: 0 });
  const result = await checkBaseUsdcPayment({
    rpcUrl: RPC_URL, chainId: 84532, tokenAddress: TOKEN,
    ownerAddress: OWNER, spenderAddress: SPENDER, amount: "10", fetchImpl,
  });
  assert.equal(result.ready, true);
  assert.equal(calls[0].method, "eth_chainId");
});

test("rejects wrong chain and invalid configuration before token reads", async () => {
  const wrongChain = mockFetch({ chainId: "0x14a34" });
  await assert.rejects(
    checkBaseUsdcPayment({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
      ownerAddress: OWNER, spenderAddress: SPENDER, amount: "1", fetchImpl: wrongChain.fetchImpl,
    }),
    /Wrong network/,
  );
  assert.equal(wrongChain.calls.length, 1);

  await assert.rejects(
    checkBaseUsdcPayment({
      rpcUrl: "file:///tmp/rpc", chainId: 8453, tokenAddress: TOKEN,
      ownerAddress: OWNER, spenderAddress: SPENDER, amount: "1",
    }),
    /HTTP\(S\)/,
  );
  await assert.rejects(
    checkBaseUsdcPayment({
      rpcUrl: RPC_URL, chainId: 1, tokenAddress: TOKEN,
      ownerAddress: OWNER, spenderAddress: SPENDER, amount: "1",
    }),
    /chainId/,
  );
});

test("validates addresses and malformed ABI responses", async () => {
  await assert.rejects(
    checkBaseUsdcPayment({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: "bad",
      ownerAddress: OWNER, spenderAddress: SPENDER, amount: "1",
    }),
    /tokenAddress/,
  );

  const malformed = mockFetch();
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === "eth_call" && request.params[0].data === "0x313ce567") {
      return { ok: true, status: 200, json: async () => ({ result: "0x01" }) };
    }
    return malformed.fetchImpl(_url, options);
  };
  await assert.rejects(
    checkBaseUsdcPayment({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
      ownerAddress: OWNER, spenderAddress: SPENDER, amount: "1", fetchImpl,
    }),
    /32-byte ABI uint256/,
  );
});
