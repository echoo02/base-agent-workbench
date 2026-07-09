# Troubleshooting

This guide covers common issues developers may encounter while setting up and running Base Agent Workbench.

## Installation Issues

### Node.js Version

Check your Node.js version:

```bash
node -v
```

Use the latest LTS version if possible.

## Installing Dependencies

```bash
npm install
```

If installation fails:

```bash
npm install --legacy-peer-deps
```

## Environment Variables

Make sure your environment variables are configured correctly.

Example:

```text
OPENAI_API_KEY=your_api_key
BASE_RPC_URL=https://your_rpc_url
PRIVATE_KEY=your_private_key
```

## Wallet Issues

Ensure your wallet has enough ETH on Base for gas fees.

## RPC Errors

- Check your RPC URL.
- Verify your internet connection.
- Try again later if the RPC provider is temporarily unavailable.

## Need More Help?

If the issue continues, open a GitHub Issue and include:

- Operating System
- Node.js version
- Error message
- Steps to reproduce