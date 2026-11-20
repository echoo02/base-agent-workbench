# Building AI Agents on Base

This guide is a practical starting point for developers exploring AI agents that interact with the Base ecosystem.

## What an agent can do

An agent-enabled application can combine model reasoning with ordinary software tools and, where appropriate, onchain actions. Useful patterns include:

- **Read onchain data:** inspect balances, transactions, contract state, and events using a trusted RPC provider or indexed data source.
- **Request user-approved actions:** prepare transactions and present clear details for a person to review and sign.
- **Pay for services:** integrate an HTTP payment flow such as x402 when an API explicitly supports it.
- **Expose useful services:** make an API discoverable and charge per request using an appropriate payment facilitator.
- **Connect through tools:** use MCP-compatible tools to expose narrowly scoped capabilities to an AI assistant.

Base mainnet uses chain ID `8453`. Base Sepolia testnet uses chain ID `84532`. Always verify network configuration against the official Base documentation before deploying.

## Suggested application architecture

Keep the agent's reasoning separate from the components that hold credentials or perform privileged actions.

1. **User interface:** collects intent and displays proposed actions.
2. **Agent/orchestrator:** interprets the request and chooses from an allowlisted set of tools.
3. **Policy layer:** validates destination, chain, token, amount, and user permissions.
4. **Execution adapter:** reads chain data or prepares a transaction/payment request.
5. **Signer or wallet:** requires explicit user approval for actions that move funds unless a deliberately designed, bounded authorization model is in place.
6. **Audit log:** records tool inputs, decisions, approvals, transaction hashes, and errors without storing secrets.

## Safe development workflow

1. Start with read-only functionality on Base Sepolia.
2. Add schema validation to every tool input and output.
3. Use an explicit allowlist for contracts, tokens, chains, and API hosts.
4. Set hard spending limits and reject requests above those limits.
5. Require confirmation before signing or broadcasting transactions.
6. Simulate or estimate transactions where supported, then verify the result on an explorer.
7. Add tests for invalid addresses, wrong chain IDs, excessive amounts, timeouts, duplicate requests, and failed transactions.
8. Move to Base mainnet only after reviewing the full permission and key-management model.

## x402 payment pattern

x402 uses the HTTP `402 Payment Required` response to communicate payment requirements. A typical client flow is:

1. Request a resource from an x402-enabled endpoint.
2. If the server responds with `402`, parse and validate the payment requirements.
3. Check that the network, asset, recipient, amount, and expiry satisfy the application's policy.
4. Obtain the required authorization from the configured wallet/payment client.
5. Retry the request with the payment payload.
6. Verify the settlement response before treating the resource request as paid and complete.

Do not blindly pay every `402` response. Treat payment requirements as untrusted input and enforce a maximum amount, approved recipient/asset/network, and timeout. Use the official x402 documentation and a maintained SDK for the implementation details.

## Security checklist

- Never commit private keys, seed phrases, API keys, or wallet exports.
- Keep secrets in environment variables or a dedicated secret manager; commit only a safe `.env.example`.
- Never expose a server-side signing key to browser code or model prompts.
- Treat model output, user input, MCP tool output, and payment requirements as untrusted.
- Validate addresses and amounts in code; do not rely on an LLM to enforce policy.
- Use least-privilege credentials and narrowly scoped tool permissions.
- Add idempotency protection to payment and transaction workflows.
- Log transaction hashes and decisions, but redact secrets and personal data.

## Useful official resources

- [Base developer documentation](https://docs.base.org/)
- [Base agents](https://www.base.org/agents)
- [Base MCP](https://docs.base.org/)
- [x402 documentation](https://www.x402.org/)
- [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- [BaseScan](https://basescan.org/)

## Scope

This guide is educational. It is not an audited implementation, wallet, or recommendation to let an autonomous agent control funds. Review current SDK documentation and security requirements before using any integration in production.
