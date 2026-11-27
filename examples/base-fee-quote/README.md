# Base EIP-1559 Fee Quote

A dependency-free Node.js example that reads Base fee data over JSON-RPC and calculates a suggested EIP-1559 fee cap.

The example is **read-only**: it does not create a wallet, access a private key, sign a transaction, or broadcast anything.

## Requirements

- Node.js 20 or later (uses the built-in `fetch` API)
- A Base Mainnet or Base Sepolia JSON-RPC endpoint

## Run

Set an RPC endpoint and the matching chain ID:

```bash
# Base Sepolia
BASE_RPC_URL=https://YOUR_BASE_SEPOLIA_RPC_URL BASE_CHAIN_ID=84532 node examples/base-fee-quote/index.mjs

# Base Mainnet
BASE_RPC_URL=https://YOUR_BASE_MAINNET_RPC_URL BASE_CHAIN_ID=8453 node examples/base-fee-quote/index.mjs
```

On Windows PowerShell:

```powershell
$env:BASE_RPC_URL = "https://YOUR_BASE_SEPOLIA_RPC_URL"
$env:BASE_CHAIN_ID = "84532"
node examples/base-fee-quote/index.mjs
```

The script verifies `eth_chainId` before requesting fee data. It calls `eth_feeHistory` for the latest five blocks and a 50th-percentile reward sample. If the endpoint returns no reward samples, it falls back to `eth_maxPriorityFeePerGas`.

The fee cap is calculated as:

```text
maxFeePerGas = (2 × next base fee) + suggested priority fee
```

The returned values include raw wei strings and human-readable gwei strings. Raw values are strings to preserve integer precision.

## Tests

Run the tests with Node's built-in test runner:

```bash
node --test examples/base-fee-quote/index.test.mjs
```

The tests use a mocked JSON-RPC transport; no live endpoint or API key is required.

## Integration notes

Treat this as a fee estimate, not a guarantee of transaction inclusion or a universal recommendation. Actual fees can change before a transaction is submitted. Re-estimate close to submission time, apply application-specific limits, and obtain explicit user authorization before signing or broadcasting a transaction.
