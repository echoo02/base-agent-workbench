# Base contract deployment verifier

A dependency-free Node.js utility that checks whether an address has runtime bytecode on Base Mainnet or Base Sepolia.

## Networks

| Network | Chain ID |
| --- | ---: |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Requirements

- Node.js 20 or newer (built-in fetch).
- An HTTP(S) JSON-RPC endpoint for the selected Base network.

## Run

    BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 node index.mjs 0xYOUR_CONTRACT_ADDRESS

An optional second argument selects the block tag or hex block number:

    BASE_RPC_URL=https://mainnet.base.org BASE_CHAIN_ID=8453 node index.mjs 0xYOUR_CONTRACT_ADDRESS finalized

The utility verifies the RPC chain ID, calls eth_getCode, and reports whether runtime bytecode exists, its byte length, and the returned bytecode. Supported tags include latest, safe, finalized, earliest, pending, and explicit hex block numbers.

## Use as a module

    import { verifyBaseContract } from "./index.mjs";

    const result = await verifyBaseContract({
      rpcUrl: process.env.BASE_RPC_URL,
      chainId: 8453,
      address: "0xYOUR_CONTRACT_ADDRESS",
      blockTag: "latest",
    });

    console.log(result.deployed, result.byteLength);

Optionally provide expectedBytecode to perform an exact normalized runtime-bytecode comparison. This is not a proxy implementation verifier and does not compare compiler metadata or creation bytecode.

## Tests

    node --test index.test.mjs

Tests use mocked JSON-RPC responses and do not require a live Base endpoint.

## Safety and limitations

- Read-only: calls only eth_chainId and eth_getCode.
- Does not connect to a wallet, access private keys, sign, approve, or broadcast transactions.
- A non-empty bytecode result proves code is present at the queried address and block tag; it does not prove the contract is audited, safe, verified, or non-malicious.
- Proxy contracts may delegate to a separate implementation address; this tool does not resolve proxy storage or implementation metadata.
