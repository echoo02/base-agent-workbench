# Base USDC payment preflight

A dependency-free Node.js utility that checks whether an owner has enough ERC-20 token balance and allowance for a requested payment through a spender on Base Mainnet or Base Sepolia.

The utility is suitable as a read-only preflight step for an agent payment workflow. It verifies the configured chain, reads token decimals, owner balance, spender allowance, and the owner's native ETH balance, then compares balance and allowance against the requested amount using exact integer arithmetic.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (uses built-in `fetch`).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.
- The ERC-20 token contract, owner, and spender addresses.

## Run

From this directory:

```bash
BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 \
  node index.mjs <TOKEN_ADDRESS> <OWNER_ADDRESS> <SPENDER_ADDRESS> 12.50
```

For Base Sepolia:

```bash
BASE_RPC_URL=https://sepolia.base.org BASE_CHAIN_ID=84532 \
  node index.mjs <TOKEN_ADDRESS> <OWNER_ADDRESS> <SPENDER_ADDRESS> 12.50
```

Pass the token amount as a decimal string. The token contract's on-chain `decimals()` value determines precision; amounts with excess fractional digits are rejected instead of rounded.

## Use as a module

```js
import { checkBaseUsdcPayment } from "./index.mjs";

const preflight = await checkBaseUsdcPayment({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453,
  tokenAddress: process.env.USDC_ADDRESS,
  ownerAddress: process.env.AGENT_WALLET,
  spenderAddress: process.env.PAYMENT_CONTRACT,
  amount: "12.50",
});

if (!preflight.ready) {
  throw new Error("Insufficient token balance or allowance");
}
```

The result reports token balance, allowance, requested amount, native ETH balance in wei, and independent readiness flags. The CLI exits with code 2 when the payment is not ready.

## Tests

Run the mocked test suite without a live RPC endpoint:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Read-only: uses `eth_chainId`, `eth_call`, and `eth_getBalance`; it does not request wallet access, access private keys, sign, approve, or broadcast transactions.
- Verifies the RPC endpoint is connected to the requested Base chain before reading token state.
- Reads the token's on-chain decimals rather than assuming every USDC-like token uses six decimals.
- Uses BigInt for all token quantities; no floating-point conversion or rounding is used.
- The spender allowance is checked but never changed. If it is insufficient, an authorized wallet flow must handle approval separately.
- The native ETH balance is informational only. This tool does not estimate gas or determine whether a particular smart-account/paymaster setup can pay fees.
- Use a trusted RPC endpoint and verify the token contract, owner, and spender addresses before relying on the result. The example does not hard-code a token address and should not be used with an unverified token contract.
