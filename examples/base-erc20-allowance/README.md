# Base ERC-20 allowance inspector

Read the ERC-20 allowance granted by an owner to a spender on Base Mainnet or Base Sepolia.

The example uses the standard ERC-20 `allowance(owner, spender)` view through JSON-RPC `eth_call`. It is useful for agent safety checks and approval reviews before an application relies on a token allowance.

## Requirements

- Node.js 20 or newer
- An HTTP(S) JSON-RPC endpoint for Base Mainnet or Base Sepolia
- The token contract, owner, and spender addresses

## Use as a module

```js
import { getBaseTokenAllowance } from "./index.mjs";

const result = await getBaseTokenAllowance({
  rpcUrl: process.env.BASE_RPC_URL,
  chainId: 8453, // Base Mainnet; use 84532 for Base Sepolia
  tokenAddress: "0xTOKEN_CONTRACT",
  ownerAddress: "0xOWNER",
  spenderAddress: "0xSPENDER",
});

console.log(result.allowance); // raw token units as an exact decimal string
```

The returned allowance is the raw uint256 value. To display a human-readable token amount, divide by the token's `decimals()` value using integer-safe unit formatting in your application. The inspector intentionally does not assume token decimals.

## Tests

Run the mocked tests without a live RPC endpoint:

```bash
node --test index.test.mjs
```

## Safety and limitations

- Read-only: uses `eth_chainId` and `eth_call`; it does not request wallet access, access private keys, sign, approve, or broadcast transactions.
- Verifies that the RPC endpoint is connected to the requested Base chain before reading the allowance.
- Returns the raw allowance as a decimal string to avoid JavaScript number precision loss.
- A zero allowance may mean no approval, while a very large value may represent an effectively unlimited approval; interpret the value with the token's decimals and application context.
- Use a trusted RPC endpoint. This example reads the current state at the `latest` block and does not provide historical allowance data.
