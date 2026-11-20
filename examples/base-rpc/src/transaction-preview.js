import { assertAddress, BASE_NETWORKS } from "./rpc.js";

export function previewTransaction({ network, to, valueEth, data = "0x" }) {
  const selected = BASE_NETWORKS[network];
  if (!selected) throw new TypeError("network must be mainnet or sepolia.");
  assertAddress(to);

  if (typeof valueEth !== "string" || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(valueEth)) {
    throw new TypeError("valueEth must be a non-negative decimal string with up to 18 decimals.");
  }
  if (typeof data !== "string" || !/^0x(?:[a-fA-F0-9]{2})*$/.test(data)) {
    throw new TypeError("data must be 0x-prefixed, even-length hexadecimal bytes.");
  }

  const [whole, fraction = ""] = valueEth.split(".");
  const valueWei = (BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"))).toString();

  return Object.freeze({
    chainId: selected.chainId,
    to,
    value: `0x${BigInt(valueWei).toString(16)}`,
    data
  });
}

// This function only prepares a preview. It does not sign or broadcast.
