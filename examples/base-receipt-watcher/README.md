# Base transaction receipt watcher

A dependency-free Node.js utility that waits for a Base transaction to be mined and reach a requested confirmation depth.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (uses built-in `fetch`).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.

## Run

From this directory:

```bash
BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 \
  node index.mjs 0xYOUR_TRANSACTION_HASH 2
```

For Base Sepolia:

```bash
BASE_RPC_URL=https://sepolia.base.org BASE_CHAIN_ID=84532 \
  node index.mjs 0xYOUR_TRANSACTION_HASH
```

The optional final argument is the required confirmation count (default: `1`). The script prints the transaction hash, receipt status, block number, confirmation count, and verified chain ID.

## Use as a module

```js
import { waitForBaseReceipt } from "./index.mjs";

const receipt = await waitForBaseReceipt({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453,
  txHash: "0xYOUR_TRANSACTION_HASH",
  confirmations: 2,
});

console.log(receipt.status, receipt.confirmations);
```

## Tests

Run the mocked test suite without a live RPC endpoint:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Read-only: the utility does not request accounts, access private keys, sign, or broadcast transactions.
- It verifies the RPC chain ID before querying the receipt.
- A confirmation count is a depth check against the latest block, not a guarantee against every possible chain reorganization.
- Use a trusted RPC endpoint and handle timeout/network errors in the calling application.
