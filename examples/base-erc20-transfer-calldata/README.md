# Base ERC-20 transfer calldata builder

A dependency-free Node.js utility that creates an **unsigned** ERC-20 `transfer(address,uint256)` transaction request for Base Mainnet or Base Sepolia.

It encodes the recipient and token amount into ABI calldata using exact BigInt arithmetic. The token's decimal count must be supplied by the caller (for example, from the token contract's `decimals()` value); the utility does not guess token metadata.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer.
- Token contract address and recipient address.
- Token decimals obtained from a trusted source.

## Use as a module

```js
import { buildBaseErc20Transfer } from "./index.mjs";

const tx = buildBaseErc20Transfer({
  chainId: 8453,
  tokenAddress: process.env.USDC_ADDRESS,
  recipientAddress: "0x2222222222222222222222222222222222222222",
  amount: "12.50",
  decimals: 6,
});

console.log(tx);
// { chainId, to, value: "0x0", data, recipientAddress, amount, decimals, rawAmount }
```

The returned `to` is the token contract, `data` is the ABI-encoded transfer call, and `value` is zero because ERC-20 transfers do not send native ETH.

## Tests

Run the mocked/offline test suite:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Offline encoding only: no RPC requests, wallet connection, private-key access, signing, approval, or broadcasting.
- Produces calldata for the standard ERC-20 `transfer(address,uint256)` function; it does not submit the transaction.
- The caller must independently verify the token contract, network, recipient, token decimals, and amount before signing.
- A successfully encoded request does not guarantee that the token transfer will succeed; token behavior, balances, fees, and restrictions are not checked.
- This utility does not build smart-account or paymaster-specific transaction envelopes.
