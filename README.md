# a2a-x402 with Algorand Support

A complete TypeScript implementation of the [Python x402 payment protocol extension](https://github.com/google-agentic-commerce/a2a-x402) for A2A (Agent-to-Agent) communication, with **full Algorand blockchain support** in addition to EVM chains.

> **Based on:** [dabit3/a2a-x402-typescript](https://github.com/dabit3/a2a-x402-typescript)
> This fork extends the original implementation with comprehensive Algorand support while maintaining full backward compatibility with EVM chains.

✨ **NEW: NFDomains Support** - Use human-readable `.algo` names (like `alice.algo`) instead of long Algorand addresses!

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Quick start

```bash
npm install a2a-x402
```

### Basic usage

#### Merchant side (request payment)

**EVM (Ethereum, Base, Polygon):**
```typescript
import { x402PaymentRequiredException } from 'a2a-x402';

// Request payment on EVM chain
throw new x402PaymentRequiredException(
  "Payment required for product",
  {
    scheme: "exact",
    network: "base-sepolia",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC contract
    payTo: "0xYourWalletAddress",
    maxAmountRequired: "1000000", // 1 USDC in atomic units
    resource: "/buy-product",
    description: "Payment for banana",
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
  }
);
```

**Algorand:**
```typescript
import { x402PaymentRequiredException } from 'a2a-x402';

// Request payment on Algorand (supports both addresses and NFD names!)
throw new x402PaymentRequiredException(
  "Payment required for product",
  {
    scheme: "exact",
    network: "algorand-testnet",
    asset: "10458941", // USDC ASA ID on TestNet
    payTo: "alice.algo", // ← Can use NFD name or regular address!
    maxAmountRequired: "1000000", // 1 USDC in atomic units
    resource: "/buy-product",
    description: "Payment for banana",
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
  }
);
```

#### Client side (process payment)

**EVM:**
```typescript
import { processPayment, x402Utils } from 'a2a-x402';
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey);
const utils = new x402Utils();

// Get payment requirements from task
const paymentRequired = utils.getPaymentRequirements(task);

// Sign the payment (EVM uses EIP-712)
const paymentPayload = await processPayment(
  paymentRequired.accepts[0],
  wallet
);
```

**Algorand:**
```typescript
import { processPayment, accountFromMnemonic, x402Utils } from 'a2a-x402';

// Create Algorand account from mnemonic
const account = accountFromMnemonic(process.env.ALGORAND_MNEMONIC);
const utils = new x402Utils();

// Get payment requirements from task
const paymentRequired = utils.getPaymentRequirements(task);

// Sign the payment (Algorand uses ED25519)
const paymentPayload = await processPayment(
  paymentRequired.accepts[0],
  account
);
```

## Features

### Core Features
- **Exception-based payment flow** - Throw exceptions to request payments dynamically
- **Full TypeScript support** - Complete type definitions and interfaces
- **Dynamic pricing** - Set prices based on request parameters
- **ADK-compatible** - Works seamlessly with [ADK TypeScript](https://github.com/njraladdin/adk-typescript)

### Blockchain Support
- **Multi-chain support** - Works with both EVM and Algorand networks
- **EVM chains** - Base, Ethereum, Polygon (Mainnet and Testnets)
  - Built on ethers.js v6 for signing and verification
  - ERC-20 token payments with EIP-712 signatures
  - Native USDC support on all networks
- **Algorand chains** - MainNet, TestNet, BetaNet
  - Built on algosdk for signing and verification
  - ASA (Algorand Standard Asset) transfers with ED25519 signatures
  - Native USDC support via ASAs
  - Automatic ASA opt-in handling
  - **NFDomains support** - Use .algo names instead of addresses!

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
    network: "base-sepolia",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xYourAddress",
    maxAmountRequired: "1000000",
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

Sign a payment with a wallet:

```typescript
import { processPayment } from 'a2a-x402';
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey);
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

A payment-enabled orchestrator agent that can interact with merchants and process payments.

**Install and run:**
```bash
cd client-agent
npm install
cp .env.example .env
# Edit .env with your API keys and wallet
npm run dev
```

**Features:**
- Secure wallet with ERC-20 support
- Automatic USDC approvals
- Natural language purchase requests
- User confirmation flows

See [client-agent/README.md](client-agent/README.md) for details.

### Merchant agent

A service provider agent that requests payments, verifies signatures, and settles transactions.

**Install and run:**
```bash
cd merchant-agent
npm install
cp .env.example .env
# Edit .env with your API keys and wallet
npm run dev
```

**Features:**
- Dynamic pricing
- Payment verification
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
You: I want to buy a banana
Agent: The merchant is requesting 1.000000 USDC for a banana. Proceed?
You: yes
Agent: Payment completed! Transaction: 0x...
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

### EVM Networks

The library works with any EVM-compatible network:

#### Base Sepolia (testnet)
- Chain ID: `84532`
- RPC: `https://sepolia.base.org`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Explorer: https://sepolia.basescan.org/
- Faucets:
  - ETH: https://www.alchemy.com/faucets/base-sepolia
  - USDC: https://faucet.circle.com/

#### Base Mainnet (production)
- Chain ID: `8453`
- RPC: `https://mainnet.base.org`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Explorer: https://basescan.org/

### NFDomains Support (Algorand)

The library automatically resolves NFDomains (.algo names) to Algorand addresses:

```typescript
import { createPaymentRequirements, resolveNFD } from 'a2a-x402';

// Automatic resolution in payment requirements
const requirements = await createPaymentRequirements({
  payToAddress: "alice.algo", // ← NFD name automatically resolved!
  network: "algorand-mainnet",
  price: "$1.00",
  resource: "/payment"
});
// requirements.payTo will contain the resolved Algorand address

// Or manually resolve an NFD name
const address = await resolveNFD("alice.algo", "algorand-mainnet");
console.log(address); // → "ABC123...XYZ789"

// Reverse lookup (address → NFD)
const nfdName = await reverseResolveNFD(address, "algorand-mainnet");
console.log(nfdName); // → "alice.algo"
```

**Learn more:**
- Register your own .algo name: https://app.nf.domains
- NFDomains Documentation: https://docs.nf.domains

### Algorand Networks

#### Algorand MainNet
- Network: `algorand-mainnet`
- Genesis ID: `mainnet-v1.0`
- Algod: `https://mainnet-api.algonode.cloud`
- Indexer: `https://mainnet-idx.algonode.cloud`
- USDC ASA ID: `31566704`
- Explorer: https://algoexplorer.io/

#### Algorand TestNet
- Network: `algorand-testnet`
- Genesis ID: `testnet-v1.0`
- Algod: `https://testnet-api.algonode.cloud`
- Indexer: `https://testnet-idx.algonode.cloud`
- USDC ASA ID: `10458941`
- Explorer: https://testnet.algoexplorer.io/
- Faucet: https://bank.testnet.algorand.network/

#### Algorand BetaNet
- Network: `algorand-betanet`
- Genesis ID: `betanet-v1.0`
- Algod: `https://betanet-api.algonode.cloud`
- Indexer: `https://betanet-idx.algonode.cloud`
- USDC ASA ID: `10458941` (placeholder)
- Explorer: https://betanet.algoexplorer.io/

## Security

### Best practices

**Private key management:**
- Never commit private keys or `.env` files
- Use separate wallets for testing and production
- Keep minimal balances in hot wallets
- Consider hardware wallets for production

### Token approvals

The example client agent uses a 10% buffer for approvals:
```typescript
const approvalAmount = (amount * 110n) / 100n;
```

Always review approval amounts before signing transactions.

## Additional resources

### Documentation
- [Client agent README](client-agent/README.md) - Wallet agent implementation details
- [Merchant agent README](merchant-agent/README.md) - Service provider implementation
- [Deployment guide](merchant-agent/DEPLOYMENT.md) - Production deployment instructions

### Algorand Documentation
- [Algorand Conversion Guide](docs/ALGORAND_CONVERSION_GUIDE.md) - Complete implementation guide
- [Codebase Analysis](docs/CODEBASE_ANALYSIS_FOR_ALGORAND.md) - Technical deep dive
- [Key Files Reference](docs/KEY_FILES_REFERENCE.md) - Quick reference with file locations
- [Analysis Index](docs/ANALYSIS_INDEX.md) - Documentation navigation guide

### Related projects
- [ADK TypeScript](https://github.com/njraladdin/adk-typescript) - Agent Development Kit for TypeScript
- [Python x402 implementation](https://github.com/google-agentic-commerce/a2a-x402) - Original protocol specification
- [Original a2a-x402-typescript](https://github.com/dabit3/a2a-x402-typescript) - Base implementation

## License

Apache-2.0 - See [LICENSE](LICENSE) for details

## Getting started

1. Install the package: `npm install a2a-x402`
2. Try the examples: Run the client and merchant agents
3. Build your agent: Use the library in your own project
4. Customize: Adapt the example agents to your needs

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
