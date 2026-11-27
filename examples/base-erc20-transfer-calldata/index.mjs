const BASE_CHAIN_IDS = new Set([8453, 84532]);
const TRANSFER_SELECTOR = "a9059cbb";
const MAX_UINT256 = (1n << 256n) - 1n;

function validateAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a 20-byte EVM address`);
  }
  return value.toLowerCase();
}

export function parseTokenAmount(amount, decimals) {
  if (typeof amount !== "string" || !/^\d+(?:\.\d+)?$/.test(amount)) {
    throw new TypeError("amount must be a positive decimal string without signs or exponent notation");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new TypeError("decimals must be an integer from 0 to 255");
  }

  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new RangeError(`amount has more than ${decimals} decimal places`);
  }
  const units = BigInt(whole) * (10n ** BigInt(decimals))
    + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n) throw new RangeError("amount must be greater than zero");
  if (units > MAX_UINT256) throw new RangeError("amount exceeds the uint256 maximum");
  return units;
}

/**
 * Build unsigned ERC-20 transfer calldata for Base.
 * This is an offline encoder: it does not connect to an RPC or wallet,
 * sign a transaction, request approval, or broadcast anything.
 */
export function buildBaseErc20Transfer({
  chainId,
  tokenAddress,
  recipientAddress,
  amount,
  decimals,
} = {}) {
  if (!Number.isSafeInteger(chainId) || !BASE_CHAIN_IDS.has(chainId)) {
    throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  }

  const token = validateAddress(tokenAddress, "tokenAddress");
  const recipient = validateAddress(recipientAddress, "recipientAddress");
  const rawAmount = parseTokenAmount(amount, decimals);
  const encodedRecipient = recipient.slice(2).padStart(64, "0");
  const encodedAmount = rawAmount.toString(16).padStart(64, "0");

  return {
    chainId,
    to: token,
    value: "0x0",
    data: `0x${TRANSFER_SELECTOR}${encodedRecipient}${encodedAmount}`,
    recipientAddress: recipient,
    amount,
    decimals,
    rawAmount: rawAmount.toString(),
  };
}
