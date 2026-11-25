import test from "node:test";
import assert from "node:assert/strict";
import { formatUnits, readBaseTokenBalance } from "./index.mjs";

const TOKEN = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const RPC_URL = "https://mainnet.base.org";
const uint256 = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;

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

test("reads a Base Mainnet token balance and formats 6 decimals", async () => {
  const { fetchImpl, calls } = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_call" && params[0].data.startsWith("0x70a08231")) {
      return uint256("12345678");
    }
    if (method === "eth_call" && params[0].data === "0x313ce567") return uint256(6);
    throw new Error("Unexpected RPC request");
  });

  const result = await readBaseTokenBalance({
    rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
    walletAddress: WALLET, fetchImpl,
  });

  assert.deepEqual(result, {
    chainId: 8453,
    tokenAddress: TOKEN,
    walletAddress: WALLET,
    rawBalance: "12345678",
    decimals: 6,
    formattedBalance: "12.345678",
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].params[1], "latest");
});

test("supports Base Sepolia and zero-decimal tokens", async () => {
  const { fetchImpl } = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x14a34";
    if (method === "eth_call" && params[0].data.startsWith("0x70a08231")) return uint256(42);
    if (method === "eth_call") return uint256(0);
    throw new Error("Unexpected RPC request");
  });

  const result = await readBaseTokenBalance({
    rpcUrl: RPC_URL, chainId: 84532, tokenAddress: TOKEN,
    walletAddress: WALLET, fetchImpl,
  });
  assert.equal(result.formattedBalance, "42");
  assert.equal(result.decimals, 0);
});

test("preserves large balances without floating-point conversion", async () => {
  const large = 123456789012345678901234567890n;
  const { fetchImpl } = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_call" && params[0].data.startsWith("0x70a08231")) return uint256(large);
    if (method === "eth_call") return uint256(18);
    throw new Error("Unexpected RPC request");
  });

  const result = await readBaseTokenBalance({
    rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
    walletAddress: WALLET, fetchImpl,
  });
  assert.equal(result.rawBalance, large.toString());
  assert.equal(result.formattedBalance, "123456789012.34567890123456789");
});

test("rejects the wrong chain before making contract calls", async () => {
  const { fetchImpl, calls } = mockFetch(() => "0x14a34");
  await assert.rejects(
    readBaseTokenBalance({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
      walletAddress: WALLET, fetchImpl,
    }),
    /Wrong network/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "eth_chainId");
});

test("validates addresses, network IDs, and RPC URL", async () => {
  const options = { rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN, walletAddress: WALLET };
  await assert.rejects(readBaseTokenBalance({ ...options, tokenAddress: "0x123" }), /tokenAddress/);
  await assert.rejects(readBaseTokenBalance({ ...options, walletAddress: "bad" }), /walletAddress/);
  await assert.rejects(readBaseTokenBalance({ ...options, chainId: 1 }), /chainId/);
  await assert.rejects(readBaseTokenBalance({ ...options, rpcUrl: "file:///tmp/rpc" }), /HTTP\(S\)/);
});

test("rejects malformed ABI responses and decimals outside uint8 range", async () => {
  const malformed = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (params[0].data.startsWith("0x70a08231")) return "0x01";
    return uint256(6);
  });
  await assert.rejects(
    readBaseTokenBalance({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
      walletAddress: WALLET, fetchImpl: malformed.fetchImpl,
    }),
    /32-byte ABI/,
  );

  const invalidDecimals = mockFetch(({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (params[0].data.startsWith("0x70a08231")) return uint256(1);
    return uint256(256);
  });
  await assert.rejects(
    readBaseTokenBalance({
      rpcUrl: RPC_URL, chainId: 8453, tokenAddress: TOKEN,
      walletAddress: WALLET, fetchImpl: invalidDecimals.fetchImpl,
    }),
    /uint8 range/,
  );
});

test("formats integer units without trailing fractional zeroes", () => {
  assert.equal(formatUnits(1000000n, 6), "1");
  assert.equal(formatUnits(1200300n, 6), "1.2003");
  assert.equal(formatUnits(5n, 3), "0.005");
  assert.equal(formatUnits(0n, 18), "0");
  assert.throws(() => formatUnits(-1n, 6), /non-negative bigint/);
});
