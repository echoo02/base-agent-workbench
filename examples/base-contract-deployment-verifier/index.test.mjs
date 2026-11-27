import test from "node:test";
import assert from "node:assert/strict";
import { verifyBaseContract } from "./index.mjs";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const CODE = "0x6001600055";

function mockRpc({ chainId = "0x2105", code = CODE, rpcError } = {}) {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    const payload = rpcError
      ? { error: { code: -32000, message: rpcError } }
      : { result: request.method === "eth_chainId" ? chainId : code };
    return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: request.id, ...payload }) };
  };
  return { fetchImpl, calls };
}

test("verifies deployed contract and returns bytecode length", async () => {
  const { fetchImpl, calls } = mockRpc();
  const result = await verifyBaseContract({ rpcUrl: "https://mainnet.base.org", chainId: 8453, address: ADDRESS, fetchImpl });
  assert.equal(result.deployed, true);
  assert.equal(result.byteLength, 5);
  assert.equal(result.bytecode, CODE);
  assert.equal(result.matchesExpectedBytecode, null);
  assert.deepEqual(calls.map((x) => x.method), ["eth_chainId", "eth_getCode"]);
  assert.deepEqual(calls[1].params, [ADDRESS, "latest"]);
});

test("reports an address with no deployed code", async () => {
  const { fetchImpl } = mockRpc({ code: "0x" });
  const result = await verifyBaseContract({ rpcUrl: "https://mainnet.base.org", chainId: 8453, address: ADDRESS, fetchImpl });
  assert.equal(result.deployed, false);
  assert.equal(result.byteLength, 0);
});

test("supports Base Sepolia and explicit block tags", async () => {
  const { fetchImpl, calls } = mockRpc({ chainId: "0x14a34" });
  const result = await verifyBaseContract({ rpcUrl: "https://sepolia.base.org", chainId: 84532, address: ADDRESS, blockTag: "0x1234", fetchImpl });
  assert.equal(result.chainId, 84532);
  assert.equal(calls[1].params[1], "0x1234");
});

test("compares expected runtime bytecode exactly", async () => {
  const { fetchImpl } = mockRpc();
  const match = await verifyBaseContract({ rpcUrl: "https://mainnet.base.org", chainId: 8453, address: ADDRESS, expectedBytecode: CODE.toUpperCase().replace("0X", "0x"), fetchImpl });
  assert.equal(match.matchesExpectedBytecode, true);
  const mismatch = await verifyBaseContract({ rpcUrl: "https://mainnet.base.org", chainId: 8453, address: ADDRESS, expectedBytecode: "0x6002", fetchImpl });
  assert.equal(mismatch.matchesExpectedBytecode, false);
});

test("rejects incorrect network", async () => {
  const { fetchImpl } = mockRpc({ chainId: "0x1" });
  await assert.rejects(verifyBaseContract({ rpcUrl: "https://example.com", chainId: 8453, address: ADDRESS, fetchImpl }), /Wrong network/);
});

test("validates URL, chain, address, block tag, and expected bytecode", async () => {
  const args = { chainId: 8453, address: ADDRESS, fetchImpl: async () => { throw new Error("must not call RPC"); } };
  await assert.rejects(verifyBaseContract({ ...args, rpcUrl: "ftp://example.com" }), /HTTP\(S\)/);
  await assert.rejects(verifyBaseContract({ ...args, rpcUrl: "https://example.com", chainId: 1 }), /chainId/);
  await assert.rejects(verifyBaseContract({ ...args, rpcUrl: "https://example.com", address: "0x123" }), /20-byte/);
  await assert.rejects(verifyBaseContract({ ...args, rpcUrl: "https://example.com", blockTag: "yesterday" }), /blockTag/);
  await assert.rejects(verifyBaseContract({ ...args, rpcUrl: "https://example.com", expectedBytecode: "0x1" }), /bytecode/);
});

test("rejects malformed RPC bytecode and JSON-RPC errors", async () => {
  const malformed = mockRpc({ code: "0x123" });
  await assert.rejects(verifyBaseContract({ rpcUrl: "https://example.com", chainId: 8453, address: ADDRESS, fetchImpl: malformed.fetchImpl }), /malformed bytecode/);
  const failing = mockRpc({ rpcError: "provider unavailable" });
  await assert.rejects(verifyBaseContract({ rpcUrl: "https://example.com", chainId: 8453, address: ADDRESS, fetchImpl: failing.fetchImpl }), /provider unavailable/);
});
