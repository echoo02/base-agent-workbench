import { pathToFileURL } from "node:url";

const ERC20_BALANCE_OF = "70a08231";
const ERC20_DECIMALS = "313ce567";
const ERC20_ALLOWANCE = "dd62ed3e";

function validateAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) {
    throw new TypeError(`${label} must be a 20-byte EVM address`);
  }
  return value.toLowerCase();
}

function encodeAddressCall(selector, ...addresses) {
  return `0x${selector}${addresses.map((address) => address.slice(2).padStart(64, "0")).join("")}`;
}

function decodeUint256(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`Invalid ${label} response: expected a 32-byte ABI uint256`);
  }
  return BigInt(value);
}

export function parseTokenAmount(value, decimals) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError("amount must be a positive decimal string without signs or exponent notation");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new TypeError("decimals must be an integer from 0 to 255");
  }

  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new RangeError(`amount has more than ${decimals} decimal places`);
  }
  const units = BigInt(whole) * (10n ** BigInt(decimals))
    + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n) throw new RangeError("amount must be greater than zero");
  return units;
}

export function formatTokenAmount(value, decimals) {
  if (typeof value !== "bigint" || value < 0n) {
    throw new TypeError("value must be a non-negative bigint");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new TypeError("decimals must be an integer from 0 to 255");
  }
  if (decimals === 0) return value.toString();

  const padded = value.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function rpcCall(fetchImpl, rpcUrl, method, params, id) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText ?? ""}`.trim());
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed (${payload.error.code}): ${payload.error.message}`);
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return payload.result;
}

/**
 * Check whether an owner can make a token payment through a spender on Base.
 * Read-only: no wallet connection, signing, approval, or transaction broadcast.
 */
export async function checkBaseUsdcPayment({
  rpcUrl,
  chainId,
  tokenAddress,
  ownerAddress,
  spenderAddress,
  amount,
  fetchImpl = fetch,
} = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) {
    throw new TypeError("rpcUrl must be an HTTP(S) URL");
  }
  if (![8453, 84532].includes(Number(chainId))) {
    throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  }

  const token = validateAddress(tokenAddress, "tokenAddress");
  const owner = validateAddress(ownerAddress, "ownerAddress");
  const spender = validateAddress(spenderAddress, "spenderAddress");
  if (typeof amount !== "string") {
    throw new TypeError("amount must be a decimal string");
  }

  const expectedChainId = `0x${Number(chainId).toString(16)}`;
  const actualChainId = await rpcCall(fetchImpl, rpcUrl, "eth_chainId", [], 1);
  if (String(actualChainId).toLowerCase() !== expectedChainId) {
    throw new Error(`Wrong network: expected chain ID ${expectedChainId}, received ${actualChainId}`);
  }

  const call = (data, id) => rpcCall(fetchImpl, rpcUrl, "eth_call", [
    { to: token, data }, "latest",
  ], id);

  const [rawDecimals, rawBalance, rawAllowance, rawNativeBalance] = await Promise.all([
    call(`0x${ERC20_DECIMALS}`, 2),
    call(encodeAddressCall(ERC20_BALANCE_OF, owner), 3),
    call(encodeAddressCall(ERC20_ALLOWANCE, owner, spender), 4),
    rpcCall(fetchImpl, rpcUrl, "eth_getBalance", [owner, "latest"], 5),
  ]);

  const decimalsValue = decodeUint256(rawDecimals, "decimals");
  if (decimalsValue > 255n) {
    throw new Error("Invalid decimals response: value exceeds uint8 range");
  }
  const decimals = Number(decimalsValue);
  const required = parseTokenAmount(amount, decimals);
  const balance = decodeUint256(rawBalance, "balanceOf");
  const allowance = decodeUint256(rawAllowance, "allowance");
  const nativeBalance = decodeUint256(rawNativeBalance, "native balance");

  return {
    chainId: Number(chainId),
    tokenAddress: token,
    ownerAddress: owner,
    spenderAddress: spender,
    decimals,
    requestedAmount: formatTokenAmount(required, decimals),
    requestedAmountRaw: required.toString(),
    tokenBalance: formatTokenAmount(balance, decimals),
    tokenBalanceRaw: balance.toString(),
    allowance: formatTokenAmount(allowance, decimals),
    allowanceRaw: allowance.toString(),
    nativeBalanceWei: nativeBalance.toString(),
    sufficientBalance: balance >= required,
    sufficientAllowance: allowance >= required,
    ready: balance >= required && allowance >= required,
  };
}

async function main() {
  const [tokenAddress, ownerAddress, spenderAddress, amount] = process.argv.slice(2);
  const rpcUrl = process.env.BASE_RPC_URL;
  const chainId = Number(process.env.BASE_CHAIN_ID);

  if (!rpcUrl || !chainId || !tokenAddress || !ownerAddress || !spenderAddress || !amount) {
    throw new Error(
      "Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <token> <owner> <spender> <amount>",
    );
  }

  const result = await checkBaseUsdcPayment({
    rpcUrl, chainId, tokenAddress, ownerAddress, spenderAddress, amount,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
