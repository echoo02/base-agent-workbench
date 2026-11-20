# Base Agent Workbench

A community-driven, open-source workspace for developers experimenting with AI agents and the Base ecosystem.

The goal is to make Base agent development easier to understand through practical guides, focused examples, reusable patterns, and community contributions.

## What this project explores

- **Agent-to-chain workflows:** read onchain data and prepare transactions for review.
- **Agentic payments:** understand x402 and pay-per-request service integrations.
- **MCP tooling:** expose carefully scoped Base capabilities to AI assistants.
- **Developer onboarding:** document setup, testing, security, and deployment workflows.
- **Reusable examples:** build small, understandable building blocks that contributors can extend.

## Getting started

Clone the repository:

```bash
git clone https://github.com/echoo02/base-agent-workbench.git
cd base-agent-workbench
```

Start with the [Base Agent Development Guide](docs/BASE_AGENT_GUIDE.md) and browse the [examples directory](examples/README.md).

## Network basics

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | `8453` |
| Base Sepolia | `84532` |

Use Base Sepolia for initial development and testing. Confirm current RPC, faucet, and SDK instructions in the official Base documentation before running an integration.

## Repository structure

```text
.
├── docs/
│   └── BASE_AGENT_GUIDE.md
├── examples/
│   └── README.md
└── README.md
```

## Security principles

- Never commit private keys, seed phrases, or API credentials.
- Keep signing and payment permissions outside model prompts.
- Validate chain, asset, recipient, and amount in application code.
- Require clear user approval for transactions unless using an intentionally designed, bounded authorization flow.
- Treat model output and external tool responses as untrusted input.

## Contributing

Contributions are welcome. Useful contributions include documentation fixes, tested examples, bug reports, security improvements, and integrations that follow the project's safety principles.

Please open an issue to discuss larger changes before starting work. Keep pull requests focused and include clear setup and test instructions.

## Roadmap

- [x] Initial project purpose and contribution direction
- [x] Agent development and security guide
- [x] Example contribution structure
- [ ] Read-only Base RPC example
- [ ] Transaction preview and validation example
- [ ] x402 client example with spending-policy checks
- [ ] MCP tool examples
- [ ] Automated tests and CI for examples

## Disclaimer

This repository is an educational community project, not an audited wallet or autonomous trading system. Review current protocol and SDK documentation and perform security testing before using code with real funds.

## License

MIT
