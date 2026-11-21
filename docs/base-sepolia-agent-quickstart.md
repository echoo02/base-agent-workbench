# Build Your First Base AI Agent Connection

This guide connects a Node.js application (or an AI agent's tool layer) to Base Sepolia using a read-only JSON-RPC provider. It is a safe starting point before adding signing, transactions, or agent-controlled payments.

## What you'll build

A small Node.js script that:
- Connects to Base Sepolia through a JSON-RPC endpoint
- Verifies that the endpoint is connected to the expected chain
- Reads the latest block number

The example does not need a wallet private key and cannot send transactions.

## Prerequisites

- Node.js 20 or later
- npm
- A Base Sepolia RPC endpoint from a provider you trust

Base Sepolia uses chain ID `84532` (`0x14A34`).

## 1. Create a project

```bash
mkdir base-agent-demo
cd base-agent-demo
npm init -y
npm install ethers dotenv
```

## 2. Configure the RPC endpoint

Create a `.env` file in the project root:

```dotenv
BASE_SEPOLIA_RPC_URL=https://YOUR_BASE_SEPOLIA_RPC_ENDPOINT
```

Replace the placeholder with your provider's Base Sepolia endpoint. Do not commit your real `.env` file.

Add this to `.gitignore`:

```gitignore
.env
node_modules/
```

You can safely commit a placeholder file named `.env.example`:

```dotenv
BASE_SEPOLIA_RPC_URL=
```

## 3. Add a read-only connection

Create `index.js`:

```javascript
require("dotenv").config();

const { JsonRpcProvider } = require("ethers");

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing BASE_SEPOLIA_RPC_URL in .env");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();

  if (network.chainId !== 84532n) {
    throw new Error(
      `Wrong network: expected Base Sepolia (84532), received ${network.chainId}`
    );
  }

  const blockNumber = await provider.getBlockNumber();

  console.log("Connected to Base Sepolia");
  console.log("Chain ID:", network.chainId.toString());
  console.log("Latest block:", blockNumber);
}

main().catch((error) => {
  console.error("Base connection failed:", error.message);
  process.exitCode = 1;
});
```

Run it:

```bash
node index.js
```

A successful run prints the network name, chain ID, and latest block number.

## 4. Use this as an agent tool

For an AI agent, expose the read operation as a narrowly scoped tool rather than giving the model unrestricted RPC or wallet access.

Suggested tool contract:

- Name: `get_base_sepolia_status`
- Input: no arguments
- Output: `{ chainId: "84532", blockNumber: number }`
- Permissions: read-only
- Failure behavior: return a clear error if the RPC endpoint is unavailable or the chain ID is unexpected

Keep signing and transaction submission in a separate, explicitly authorized component. Never place private keys in prompts, source code, logs, or committed files.

## Troubleshooting

- **Missing environment variable:** confirm that `.env` is in the project root and that `dotenv` is installed.
- **Wrong network:** check that the RPC URL is for Base Sepolia, not Base Mainnet or another testnet.
- **Connection timeout or rate limit:** check your RPC provider's status and usage limits, then try another trusted endpoint.

## Next steps

After the read-only connection works, add one capability at a time:
1. Read contract data using a known Base Sepolia contract address and ABI.
2. Add transaction simulation and explicit user confirmation.
3. Add a signer only when a use case requires sending a transaction.
4. For payment flows, validate recipient, token, amount, chain, and spending limits before requesting authorization.

This quickstart intentionally starts without a private key so new contributors can verify their Base connection safely.
