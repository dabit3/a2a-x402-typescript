# AMOCA Solana A2A x402

A complete TypeScript implementation of the AMOCA x402 payment protocol for A2A (Agent-to-Agent) communication on Solana. Enable your AI agents to request, verify, and settle crypto payments seamlessly on **Solana**.

[![npm version](https://badge.fury.io/js/a2a-x402.svg)](https://www.npmjs.com/package/a2a-x402)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 🌟 Features

- ✅ **Solana Support**: Solana (Devnet and Mainnet)
- ✅ **Type-Safe APIs**: Full TypeScript support with Anza Kit
- ✅ **AMOCA x402 Protocol**: Complete implementation of payment protocol
- ✅ **Production-Ready**: Comprehensive tests and error handling
- ✅ **Solana Wallets**: Unified interface for Solana operations

## 📚 Documentation

- **[Quick Start Guide](./SOLANA_QUICKSTART.md)** - Get started in 5 minutes
- **[Solana Implementation](./SOLANA_IMPLEMENTATION.md)** - Technical details
- **[Solana Agents Workflow](./SOLANA_AGENTS_WORKFLOW.md)** - Complete workflow guide ⭐
- **[Implementation Complete](./IMPLEMENTATION_COMPLETE.md)** - Feature summary

## Quick start

```bash
npm install a2a-x402
```

### Basic usage

#### Merchant side (request payment)

```typescript
import { x402PaymentRequiredException } from 'a2a-x402';

// In your agent tool, throw an exception to request payment:
throw new x402PaymentRequiredException(
  "Payment required for product",
  {
    scheme: "exact",
    network: "solana-devnet",
    asset: "SOL",
    payTo: "YourSolanaAddress",
    maxAmountRequired: "1000000000", // 1 SOL in lamports
    resource: "/buy-product",
    description: "Payment for banana",
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
  }
);
```

#### Client side (process payment)

```typescript
import { processPayment, x402Utils } from 'a2a-x402';
import { SolanaWallet } from './src/wallet/SolanaWallet';

const wallet = await SolanaWallet.create();
const utils = new x402Utils();

// Get payment requirements from task
const paymentRequired = utils.getPaymentRequirements(task);

// Sign the payment
const paymentPayload = await processPayment(
  paymentRequired.accepts[0],
  wallet
);
```

## Features

- **Exception-based payment flow** - Throw exceptions to request payments dynamically
- **Full TypeScript support** - Complete type definitions and interfaces
- **Solana wallet integration** - Built on Anza Kit for signing and verification
- **Dynamic pricing** - Set prices based on request parameters
- **Solana network support** - Works with Solana Devnet and Mainnet
- **SOL payments** - Native support for SOL transfers
- **ADK-compatible** - Works seamlessly with [ADK TypeScript](https://github.com/njraladdin/adk-typescript)

## What's included

The library provides a complete implementation of the x402 payment protocol:

### Core modules

- **Payment requirements** - Create and validate payment requests
- **Wallet integration** - Sign and process payments with ethers.js
- **Protocol verification** - Verify signatures and settle transactions
- **State management** - Track payment status and metadata
- **Utility functions** - Helper functions for common operations

### Optional executors

Abstract base classes for building payment-enabled agents:

- `x402ServerExecutor` - For merchant/service provider agents
- `x402ClientExecutor` - For client/wallet agents

## API reference

### Core functions

#### `x402PaymentRequiredException`

The main exception class for requesting payments:

```typescript
// Simple payment request
throw new x402PaymentRequiredException(
  "Payment required",
  {
    scheme: "exact",
    network: "solana-devnet",
    asset: "SOL",
    payTo: "YourSolanaAddress",
    maxAmountRequired: "1000000000", // 1 SOL
    resource: "/service",
    description: "Service payment",
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
  }
);

// Multiple payment options
throw new x402PaymentRequiredException(
  "Choose payment tier",
  [basicTier, premiumTier, ultraTier]
);
```

#### `processPayment()`

Sign a payment with a Solana wallet:

```typescript
import { processPayment } from 'a2a-x402';
import { SolanaWallet } from './src/wallet/SolanaWallet';

const wallet = await SolanaWallet.create();
const paymentPayload = await processPayment(requirements, wallet);
```

#### `x402Utils`

Utility class for managing payment state:

```typescript
import { x402Utils } from 'a2a-x402';

const utils = new x402Utils();

// Get payment status
const status = utils.getPaymentStatus(task);

// Get payment requirements
const requirements = utils.getPaymentRequirements(task);

// Record payment success
utils.recordPaymentSuccess(task, settleResponse);
```

### Abstract executors

#### `x402ServerExecutor`

Base class for merchant agents:

```typescript
import { x402ServerExecutor } from 'a2a-x402';

class MyMerchantExecutor extends x402ServerExecutor {
  async verifyPayment(payload, requirements) {
    // Verify signature and payment details
  }

  async settlePayment(payload, requirements) {
    // Execute on-chain settlement
  }
}
```

#### `x402ClientExecutor`

Base class for client agents:

```typescript
import { x402ClientExecutor } from 'a2a-x402';

class MyClientExecutor extends x402ClientExecutor {
  async handlePaymentRequired(error, task) {
    // Process payment requirements
  }
}
```

## Example implementations

This repository includes two fully functional example agents that demonstrate end-to-end payment flows:

### Client agent

A payment-enabled orchestrator agent that can interact with merchants and process SOL payments on Solana.

**Install and run:**

```bash
cd client-agent
npm install
cp .env.example .env
# Edit .env with your API keys and wallet
npm run dev
```

**Features:**

- Secure Solana wallet with SOL support
- Automatic SOL transfers
- Natural language purchase requests
- User confirmation flows

See [client-agent/README.md](client-agent/README.md) for details.

### Merchant agent

A service provider agent that requests SOL payments, verifies signatures, and settles transactions on Solana.

**Install and run:**

```bash
cd merchant-agent
npm install
cp .env.example .env
# Edit .env with your API keys and wallet
npm run dev
```

**Features:**

- Dynamic pricing in SOL
- Payment verification on Solana
- Order fulfillment
- Secure settlement

See [merchant-agent/README.md](merchant-agent/README.md) for details.

### Full demo

Run both agents to see the complete payment flow:

**Terminal 1 - Merchant:**

```bash
cd merchant-agent && npm run dev
```

**Terminal 2 - Client:**

```bash
cd client-agent && npm run dev
```

**Client terminal:**

```
You: I want to buy a banana with Solana
Agent: The merchant is requesting 1.000000 SOL for a banana. Proceed?
You: yes
Agent: Payment completed! Transaction: ABC123...
```

## Development

### Local development

If you want to modify the library locally and test with your agents:

```bash
# Clone and build the library
git clone <repo-url>
cd a2a-x402-typescript/x402_a2a
npm install
npm run build

# Link for local development
cd ../your-project
npm install a2a-x402
```

### Testing

The example agents include test scripts:

```bash
# Test merchant payment flow
cd merchant-agent
npm run test:payment

# Test client agent
cd client-agent
npm run dev
```

## Supported networks

The library works with Solana networks. The example agents use:

### Solana Devnet (testnet)

- RPC: `https://api.devnet.solana.com`
- Explorer: <https://explorer.solana.com/?cluster=devnet>
- Faucets:
  - SOL: <https://faucet.solana.com/>

### Solana Mainnet (production)

- RPC: `https://api.mainnet-beta.solana.com`
- Explorer: <https://explorer.solana.com/>
- Faucets: None (production)

## Security

### Best practices

**Private key management:**

- Never commit private keys or `.env` files
- Use separate wallets for testing and production
- Keep minimal balances in hot wallets
- Consider hardware wallets for production

### SOL approvals

The example client agent uses SOL transfers directly. Always review transaction details before signing.

## Additional resources

### Documentation

- [Client agent README](client-agent/README.md) - Wallet agent implementation details
- [Merchant agent README](merchant-agent/README.md) - Service provider implementation
- [Deployment guide](merchant-agent/DEPLOYMENT.md) - Production deployment instructions

### Related projects

- [ADK TypeScript](https://github.com/njraladdin/adk-typescript) - Agent Development Kit for TypeScript
- [Solana Web3.js](https://github.com/anza-xyz/solana-web3.js) - Official Solana JavaScript SDK

## License

Apache-2.0 - See [LICENSE](LICENSE) for details

## Getting started

1. Install the package: `npm install a2a-x402`
2. Try the examples: Run the client and merchant agents
3. Build your agent: Use the library in your own project
4. Customize: Adapt the example agents to your needs

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
