# Base RPC health check

A dependency-free, read-only Node.js utility that verifies an RPC endpoint is serving Base Mainnet or Base Sepolia.

## Requirements

- Node.js 18 or newer (uses the built-in `fetch` API)
- An HTTP(S) JSON-RPC endpoint for the selected Base network

## Usage

```js
import { checkBaseRpc } from "./index.mjs";

try {
  const health = await checkBaseRpc({
    rpcUrl: process.env.BASE_RPC_URL,
    network: "base", // or "base-sepolia"
    timeoutMs: 5000,
  });
  console.log(health);
} catch (error) {
  console.error("Base RPC health check failed:", error.message);
}
```

A successful result includes `ok`, the verified network, numeric chain ID, and latest block number as a decimal string. The block number remains a string to avoid precision loss.

## Checks performed

1. Calls `eth_chainId` and compares it with Base Mainnet (8453) or Base Sepolia (84532).
2. Calls `eth_blockNumber` to confirm the endpoint can serve a basic read request.
3. Applies a timeout to each request and validates the JSON-RPC envelope and result.

The utility does not request accounts, sign transactions, submit transactions, or require a private key. Keep RPC URLs and provider credentials in environment variables; do not commit secrets.

## Run tests

From the repository root:

```sh
node --test examples/base-rpc-health-check/index.test.mjs
```
