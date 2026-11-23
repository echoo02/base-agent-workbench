# Troubleshooting

This guide covers common issues developers may encounter while setting up and running Base Agent Workbench.

## Installation Issues

### Node.js Version

Check your Node.js version:

```bash
node -v
```

Use Node.js 20 or later for the Base Sepolia agent quickstart.

## Installing Dependencies

Install the dependencies declared by your project:

```bash
npm install
```

Avoid using `--legacy-peer-deps` as a default workaround. If npm reports a peer-dependency conflict, inspect the conflicting package requirements and choose compatible versions before retrying.

## Environment Variables and Secrets

Keep configuration in a local `.env` file and add `.env` to `.gitignore`. Commit only placeholder values in `.env.example`.

For a read-only Base RPC connection, use a public endpoint variable such as:

```dotenv
BASE_RPC_URL=https://YOUR_BASE_RPC_ENDPOINT
```

A read-only RPC connection does not require a wallet private key. Do not add a `PRIVATE_KEY` variable unless the application genuinely needs to sign transactions.

If signing is required:

- Never hardcode a private key or paste it into an AI prompt.
- Never commit `.env`, private keys, seed phrases, or wallet backups.
- Use a dedicated test wallet on testnets and keep only funds needed for testing.
- Prefer a managed secret store or wallet-signing service for deployed applications.
- Restrict what an agent can request a signer to do; require explicit authorization for transactions and enforce recipient, token, amount, and spending limits.
- Do not print secrets in logs or error messages.

If a key may have been exposed, stop using that key, move remaining funds to a secure wallet, and rotate the exposed credential.

## Wallet Issues

For Base transactions, ensure the wallet is connected to the intended Base network and has the required asset for gas. Base Mainnet and Base Sepolia use different chain IDs and assets.

## RPC Errors

- Check that the RPC URL is correct for the intended Base network.
- Verify your internet connection and the RPC provider's status.
- Check provider rate limits and authentication requirements.
- Confirm the application validates the expected chain ID before using the connection.
- Retry with another trusted endpoint if the provider is unavailable.

## Need More Help?

If the issue continues, open a GitHub Issue and include:

- Operating System
- Node.js version
- The Base network (Mainnet or Sepolia)
- Error message with secrets and account identifiers redacted
- Steps to reproduce
