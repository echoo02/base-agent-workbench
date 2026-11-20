# Base RPC and Transaction Preview

A dependency-free Node.js example that reads a wallet's native ETH balance from Base and prepares a validated, unsigned transaction preview.

## Requirements

- Node.js 20 or newer
- An HTTP(S) JSON-RPC endpoint for Base Mainnet or Base Sepolia
- A public EVM wallet address

## Run the balance reader

From this directory:

```bash
export RPC_URL="https://your-base-sepolia-rpc.example"
export WALLET_ADDRESS="0x000000000000000000000000000000000000dEaD"
export BASE_NETWORK="sepolia"
npm run balance
```

For Base Mainnet, set `BASE_NETWORK=mainnet` and use a Base Mainnet RPC endpoint. The CLI checks the endpoint's chain ID before requesting a balance.

Do not commit RPC credentials. Use your provider's actual endpoint; the example intentionally does not hard-code a provider.

## Preview an unsigned transaction

Import `previewTransaction` from `src/transaction-preview.js`:

```js
import { previewTransaction } from "./src/transaction-preview.js";

const preview = previewTransaction({
  network: "sepolia",
  to: "0x000000000000000000000000000000000000dEaD",
  valueEth: "0.015"
});

console.log(preview);
```

The result contains the chain ID, recipient, wei-denominated hexadecimal value, and calldata. It is only a preview: this example does not connect to a wallet, sign, or broadcast transactions.

## Run tests

```bash
npm test
```

Tests use Node's built-in test runner and do not require a live RPC endpoint.

## Safety

- Use a trusted RPC provider and verify the chain ID.
- Never enter a private key or seed phrase into this example.
- Validate the recipient and amount in application code.
- Show transaction details and obtain explicit wallet approval before signing.
- Start on Base Sepolia. Review current Base documentation before mainnet use.

See [Base developer docs](https://docs.base.org/) for current network and provider guidance.
