import test from "node:test";
import assert from "node:assert/strict";
import { buildBaseErc20Transfer, parseTokenAmount } from "./index.mjs";

const TOKEN = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";

test("builds transfer calldata with exact six-decimal token units", () => {
  const result = buildBaseErc20Transfer({
    chainId: 8453, tokenAddress: TOKEN, recipientAddress: RECIPIENT,
    amount: "12.345678", decimals: 6,
  });
  assert.equal(result.chainId, 8453);
  assert.equal(result.to, TOKEN);
  assert.equal(result.value, "0x0");
  assert.equal(result.rawAmount, "12345678");
  assert.equal(result.data, `0xa9059cbb${RECIPIENT.slice(2).padStart(64, "0")}${BigInt(12345678).toString(16).padStart(64, "0")}`);
  assert.equal(result.data.length, 2 + 8 + 64 + 64);
});

test("supports Base Sepolia and tokens with zero decimals", () => {
  const result = buildBaseErc20Transfer({
    chainId: 84532, tokenAddress: TOKEN, recipientAddress: RECIPIENT,
    amount: "7", decimals: 0,
  });
  assert.equal(result.chainId, 84532);
  assert.equal(result.rawAmount, "7");
});

test("converts fractional amounts without floating-point arithmetic", () => {
  assert.equal(parseTokenAmount("0.000001", 6), 1n);
  assert.equal(parseTokenAmount("0012.5", 6), 12500000n);
});

test("rejects invalid chain IDs and addresses", () => {
  assert.throws(() => buildBaseErc20Transfer({
    chainId: 1, tokenAddress: TOKEN, recipientAddress: RECIPIENT, amount: "1", decimals: 6,
  }), /chainId/);
  assert.throws(() => buildBaseErc20Transfer({
    chainId: 8453, tokenAddress: "bad", recipientAddress: RECIPIENT, amount: "1", decimals: 6,
  }), /tokenAddress/);
  assert.throws(() => buildBaseErc20Transfer({
    chainId: 8453, tokenAddress: TOKEN, recipientAddress: "bad", amount: "1", decimals: 6,
  }), /recipientAddress/);
});

test("rejects zero, negative, exponent, malformed, and over-precision amounts", () => {
  for (const amount of ["0", "0.000000", "-1", "+1", "1e3", ".5", "1.", "abc"]) {
    assert.throws(() => parseTokenAmount(amount, 6));
  }
  assert.throws(() => parseTokenAmount("1.0000001", 6), /decimal places/);
});

test("rejects invalid decimal counts and uint256 overflow", () => {
  assert.throws(() => parseTokenAmount("1", -1), /decimals/);
  assert.throws(() => parseTokenAmount("1", 256), /decimals/);
  assert.throws(() => parseTokenAmount("115792089237316195423570985008687907853269984665640564039457584007913129639936", 0), /uint256/);
});
