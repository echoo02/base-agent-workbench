# Base transaction receipt analyzer

A dependency-free Node.js utility that inspects a mined transaction on Base Mainnet or Base Sepolia using read-only JSON-RPC calls.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (built-in fetch).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.

## Run

    BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 node index.mjs 0xYOUR_TRANSACTION_HASH

For Base Sepolia, use BASE_RPC_URL=https://sepolia.base.org and BASE_CHAIN_ID=84532.

The JSON output includes:

- Verified chain ID, transaction hash, success/failed status, block number, and block timestamp.
- Sender, recipient (or null for contract creation), and native ETH value in wei.
- Gas used, effective gas price in wei, and total fee in wei.
- Standard ERC-20 Transfer events decoded from receipt logs. Token amounts remain decimal integer strings in raw units; fetch token decimals separately before display conversion.

## Use as a module

    import { analyzeBaseTransaction } from "./index.mjs";

    const result = await analyzeBaseTransaction({
      rpcUrl: process.env.BASE_RPC_URL,
      chainId: 8453,
      txHash: "0xYOUR_TRANSACTION_HASH",
    });

    console.log(result.status, result.feePaidWei, result.transfers);

## Tests

Run the mocked test suite without a live RPC endpoint:

    node --test index.test.mjs

## Safety and limitations

- Read-only: calls only eth_chainId, eth_getTransactionByHash, eth_getTransactionReceipt, and eth_getBlockByNumber.
- Does not request wallet access, access private keys, sign transactions, approve tokens, or broadcast transactions.
- Only decodes the standard ERC-20 Transfer event; non-standard token events are left untouched.
- Values are returned in wei/raw token units to avoid floating-point precision loss.
- A missing receipt means the transaction may still be pending, unavailable, or unknown; the utility does not poll or retry.
