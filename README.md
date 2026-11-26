# Base Agent Workbench

A community-driven repository for experimenting with AI agents on the Base ecosystem.

## Purpose

This repository is intended to help developers:

- Build AI agents for Base
- Learn Base development
- Share open-source examples
- Improve developer onboarding

## Getting Started

Clone the repository:

```bash
git clone https://github.com/echoo02/base-agent-workbench.git
```

Move into the project:

```bash
cd base-agent-workbench
```

## Guides

- [Base Sepolia agent quickstart](docs/base-sepolia-agent-quickstart.md) — connect a Node.js application or agent tool to Base Sepolia using a read-only RPC provider.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — resolve common setup, RPC, and wallet issues, including safe handling of environment variables and signing keys.

## Examples

- [Base transaction receipt watcher](examples/base-receipt-watcher/README.md) — wait for a transaction receipt and confirmation depth without signing or broadcasting.
- [Base USDC payment preflight](examples/base-usdc-payment-preflight/README.md) — check an agent wallet's token balance and spender allowance before a payment.
- [Base ERC-20 allowance inspector](examples/base-erc20-allowance/README.md) — inspect an owner's token approval for a spender using read-only RPC calls.

## Contributing

Contributions are welcome.

Please read the [CONTRIBUTING.md](CONTRIBUTING.md) guide before submitting a Pull Request.

## Roadmap

- AI Agent examples
- Base integrations
- Deployment guides
- MCP examples
- x402 payment examples

## License

MIT
