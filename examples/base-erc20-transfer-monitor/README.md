# Base ERC-20 Transfer Monitor

Read standard ERC-20 Transfer event logs for a token over an explicit block range on Base Mainnet or Base Sepolia. Requires Node.js 22+ and an HTTP(S) Base JSON-RPC endpoint.

## Usage

```js
import { getBaseErc20Transfers } from "./index.mjs";
const result = await getBaseErc20Transfers({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453, // use 84532 for Base Sepolia
  tokenAddress: "0xYourTokenAddress",
  fromBlock: 25_000_000,
  toBlock: 25_001_000,
  // Optional: fromAddress: "0x...", toAddress: "0x...",
  maxBlockRange: 2_000,
});
console.log(result.transfers);
```

Run tests: `node --test examples/base-erc20-transfer-monitor/index.test.mjs`.

## Notes

- Checks eth_chainId before querying logs.
- Splits block ranges into bounded requests; tune maxBlockRange for your RPC provider.
- Returns raw token units. Read decimals() separately before displaying human-readable amounts.
- Explicit block range only; this is not a live subscription or historical indexer.
- Providers may impose log-count, range, and archive-data limits.
- Read-only: no wallet connection, private keys, signing, approvals, or transaction broadcasting.