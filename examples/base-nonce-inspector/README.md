# Base transaction nonce inspector

A dependency-free Node.js utility that reads an account's confirmed and pending transaction nonces on Base Mainnet or Base Sepolia.

Agents can use the difference between the two values as a read-only preflight signal before preparing another transaction. A pending nonce ahead of the latest nonce indicates transactions already in the mempool or otherwise pending at the selected RPC endpoint.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (uses built-in `fetch`).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.
- The wallet address to inspect.

## Run

From this directory:

```bash
BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 \
  node index.mjs 0xYOUR_WALLET_ADDRESS
```

For Base Sepolia:

```bash
BASE_RPC_URL=https://sepolia.base.org BASE_CHAIN_ID=84532 \
  node index.mjs 0xYOUR_WALLET_ADDRESS
```

The output includes the verified chain ID, normalized wallet address, latest nonce, pending nonce, and the difference between them.

## Use as a module

```js
import { inspectBaseNonce } from "./index.mjs";

const result = await inspectBaseNonce({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453,
  address: "0xYOUR_WALLET_ADDRESS",
});

console.log(result.pendingNonce, result.pendingTransactions);
```

## Tests

Run the mocked test suite without a live RPC endpoint:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Read-only: uses `eth_chainId` and `eth_getTransactionCount`; it does not request wallet access, access private keys, sign, or broadcast transactions.
- Verifies the RPC endpoint is connected to the requested Base chain before reading nonce values.
- Uses exact integer strings rather than JavaScript floating-point numbers.
- Pending transaction visibility depends on the RPC provider's mempool view and may differ between providers.
- The pending-minus-latest difference is an estimate of outstanding nonce slots, not a guaranteed count of transactions that will be mined.
- Use a trusted RPC endpoint. A nonce check alone does not replace transaction simulation or balance/fee checks.
