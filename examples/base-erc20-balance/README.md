# Base ERC-20 balance reader

A dependency-free Node.js example that reads an ERC-20 token balance on Base Mainnet or Base Sepolia using standard JSON-RPC calls.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (uses built-in `fetch`).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.
- The ERC-20 contract address and wallet address to query.

## Run

From this directory:

```bash
BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 \
  node index.mjs <TOKEN_ADDRESS> <WALLET_ADDRESS>
```

For Base Sepolia:

```bash
BASE_RPC_URL=https://sepolia.base.org BASE_CHAIN_ID=84532 \
  node index.mjs <TOKEN_ADDRESS> <WALLET_ADDRESS>
```

The output includes the verified chain ID, normalized addresses, raw integer balance, token decimals, and human-readable balance.

## Use as a module

```js
import { readBaseTokenBalance } from "./index.mjs";

const balance = await readBaseTokenBalance({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453,
  tokenAddress: "0xTOKEN_CONTRACT_ADDRESS",
  walletAddress: "0xWALLET_ADDRESS",
});

console.log(balance.formattedBalance);
```

## Tests

Run the mocked tests without a live RPC endpoint:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Read-only: uses `eth_chainId` and `eth_call`; it does not request accounts, access private keys, sign, approve, or broadcast transactions.
- Verifies the connected chain before making contract calls.
- Uses BigInt for raw token amounts to avoid JavaScript floating-point precision loss.
- Assumes the contract follows the standard ERC-20 `balanceOf(address)` and `decimals()` interfaces. Non-standard tokens may not support these calls.
- Use a trusted RPC endpoint and verify the token contract address before relying on the result.
