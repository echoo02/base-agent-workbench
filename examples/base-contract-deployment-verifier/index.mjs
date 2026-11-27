import { pathToFileURL } from "node:url";

function assertAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) {
    throw new TypeError("address must be a 20-byte hex address");
  }
  return value.toLowerCase();
}
function normalizeBytecode(value, label) {
  if (typeof value !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new TypeError(label + " must be non-empty, even-length hex bytecode");
  }
  return value.toLowerCase();
}
function normalizeBlockTag(value) {
  const tag = value ?? "latest";
  if (["latest", "safe", "finalized", "earliest", "pending"].includes(tag)) return tag;
  if (typeof tag === "string" && /^0x[0-9a-f]+$/i.test(tag)) return tag.toLowerCase();
  throw new TypeError("blockTag must be a supported block tag or hex block number");
}
async function rpc(fetchImpl, rpcUrl, method, params) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(("RPC HTTP error: " + response.status + " " + (response.statusText || "")).trim());
  const payload = await response.json();
  if (payload.error) throw new Error("RPC " + method + " failed (" + payload.error.code + "): " + payload.error.message);
  if (!Object.hasOwn(payload, "result")) throw new Error("RPC " + method + " returned no result");
  return payload.result;
}

/** Verify that an address has deployed runtime bytecode on Base. Read-only eth_getCode. */
export async function verifyBaseContract({
  rpcUrl, chainId, address, blockTag = "latest", expectedBytecode, fetchImpl = fetch,
} = {}) {
  if (typeof rpcUrl !== "string" || !/^https?:\/\//i.test(rpcUrl)) throw new TypeError("rpcUrl must be an HTTP(S) URL");
  if (!Number.isSafeInteger(chainId) || ![8453, 84532].includes(chainId)) throw new TypeError("chainId must be 8453 (Base Mainnet) or 84532 (Base Sepolia)");
  const contractAddress = assertAddress(address);
  const tag = normalizeBlockTag(blockTag);

  const chainHex = await rpc(fetchImpl, rpcUrl, "eth_chainId", []);
  const expectedChainHex = "0x" + chainId.toString(16);
  if (String(chainHex).toLowerCase() !== expectedChainHex) {
    throw new Error("Wrong network: expected " + expectedChainHex + ", received " + chainHex);
  }

  const code = await rpc(fetchImpl, rpcUrl, "eth_getCode", [contractAddress, tag]);
  if (typeof code !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(code)) {
    throw new TypeError("eth_getCode returned malformed bytecode");
  }
  const normalizedCode = code.toLowerCase();
  const deployed = normalizedCode !== "0x";
  const expected = expectedBytecode === undefined ? null : normalizeBytecode(expectedBytecode, "expectedBytecode");
  const matchesExpectedBytecode = expected === null ? null : deployed && normalizedCode === expected;

  return {
    chainId,
    address: contractAddress,
    blockTag: tag,
    deployed,
    byteLength: (normalizedCode.length - 2) / 2,
    bytecode: normalizedCode,
    expectedBytecodeProvided: expected !== null,
    matchesExpectedBytecode,
  };
}

async function main() {
  const [address, blockTag = "latest"] = process.argv.slice(2);
  const { BASE_RPC_URL: rpcUrl, BASE_CHAIN_ID: chain } = process.env;
  if (!rpcUrl || !chain || !address) throw new Error("Usage: BASE_RPC_URL=<url> BASE_CHAIN_ID=8453 node index.mjs <contract-address> [block-tag]");
  const result = await verifyBaseContract({ rpcUrl, chainId: Number(chain), address, blockTag });
  console.log(JSON.stringify(result, null, 2));
  if (!result.deployed) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
