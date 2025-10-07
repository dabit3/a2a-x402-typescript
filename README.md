# TypeScript x402 A2A Implementation

This directory contains the complete TypeScript implementation of the x402 payment protocol extension for A2A (Agent-to-Agent), along with fully functional client and merchant agents demonstrating end-to-end crypto payment flows.

## 📁 Directory Structure

```
typescript/
├── x402_a2a/              # The x402 payment protocol library
│   ├── types/             # Type definitions
│   ├── core/              # Core protocol implementation
│   ├── executors/         # Optional middleware
│   └── index.ts           # Main exports
├── client-agent/          # Orchestrator agent with wallet
│   ├── agent.ts           # Client agent implementation
│   └── src/wallet/        # Wallet & payment handling
└── merchant-agent/        # Payment-enabled merchant agent
    ├── agent.ts           # Merchant agent implementation
    └── src/               # Payment flow testing
```

## ⚡️ Quick Start

### Complete Setup (All Components)

This will set up the full payment demo with both client and merchant agents:

```bash
# 1. Build the x402_a2a library
cd x402_a2a
npm install
npm run build
cd ..

# 2. Set up the merchant agent
cd merchant-agent
npm install
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY and WALLET_PRIVATE_KEY

# 3. Set up the client agent
cd ../client-agent
npm install
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY, WALLET_PRIVATE_KEY, and BASE_SEPOLIA_RPC_URL

# 4. Start the merchant agent (in one terminal)
cd ../merchant-agent
npm run dev

# 5. Start the client agent (in another terminal)
cd ../client-agent
npm run dev
```

### Quick Test

Once both agents are running:

**Client terminal:**
```
You: I want to buy a banana
Agent: The merchant is requesting 1.000000 USDC for a banana. Would you like to proceed?
You: yes
Agent: ✅ Payment completed successfully! Transaction: 0x...
```

## Library Overview: x402_a2a

The `x402_a2a` library is a complete TypeScript port of the Python `x402_a2a` library, providing:

### Core Features

- ✅ **Exception-based payment requirements** - Throw exceptions to request payments
- ✅ **Dynamic pricing** - Set prices based on request parameters
- ✅ **Type-safe implementation** - Full TypeScript support with type definitions
- ✅ **ADK-compatible executors** - Optional middleware for common patterns
- ✅ **Ethereum wallet integration** - Using ethers.js for signing

### Architecture

The library follows a "functional core, imperative shell" architecture:

#### **types/** - Protocol Data Structures
- `config.ts` - Configuration types
- `state.ts` - Payment states and protocol types
- `errors.ts` - Error types and x402PaymentRequiredException
- `index.ts` - Type exports

#### **core/** - Protocol Implementation
- `merchant.ts` - Payment requirements creation
- `wallet.ts` - Payment signing and processing
- `protocol.ts` - Verification and settlement
- `utils.ts` - State management utilities
- `helpers.ts` - Convenience helper functions
- `agent.ts` - Agent card utilities

#### **executors/** - Optional Middleware
- `base.ts` - Base executor class
- `server.ts` - Server-side executor (merchant)
- `client.ts` - Client-side executor (wallet)

## Component Overview

### Client Agent (Orchestrator)

The **client agent** is an orchestrator that:
- Has a wallet with private keys
- Can interact with multiple merchant agents
- Automatically handles payment flows
- Uses LLM-based parsing for natural language commands
- Manages token approvals and payment signing

**Key Features:**
- 🔐 Secure wallet integration with ERC-20 token support
- 💰 Automatic USDC approval and payment handling
- 🤖 Natural language understanding for purchase requests
- ⛓️ Direct blockchain interaction on Base Sepolia
- ✅ User confirmation before payments

**Use Cases:**
- Personal shopping assistant
- Automated procurement agent
- Payment-enabled chatbot

### Merchant Agent (Service Provider)

The **merchant agent** is a service provider that:
- Receives product/service requests
- Generates payment requirements dynamically
- Validates payment signatures
- Settles payments on-chain
- Fulfills orders after payment confirmation

**Key Features:**
- 💵 Fully configurable product pricing (in this example, fixed at 1 USDC pricing for all products)
- 🔍 Payment verification via facilitator
- 📦 Order fulfillment workflow
- 🛡️ Secure payment settlement
- 🎯 ADK-powered agent framework

**Use Cases:**
- E-commerce agent
- API access control
- Premium feature gating

## Usage Examples

### Running the Client Agent

```bash
cd client-agent
npm run dev
```

**Example interaction:**
```
You: hello
Agent: Hi! I'm an x402 payment client agent. I can help you buy products
       from merchants using USDC cryptocurrency. Your wallet is ready at
       0xf59B...45b0e. Try asking me to buy something!

You: I want to buy a banana
Agent: The merchant is requesting 1.000000 USDC for a banana.
       Would you like to proceed with this payment?

You: yes
Agent: [Approving token spending...]
       ✅ Token approval confirmed
       [Signing payment...]
       ✅ Payment signed and submitted
       ✅ Payment completed successfully!
       Transaction: 0x...
```

### Running the Merchant Agent

```bash
cd merchant-agent
npm run dev
```

The merchant agent runs as an API server at `http://localhost:10000` and automatically:
1. Receives product requests
2. Returns payment requirements
3. Verifies payment signatures
4. Settles transactions on-chain
5. Confirms order fulfillment

### Library Usage (Advanced)

#### Server-Side (Merchant)

```typescript
import { x402PaymentRequiredException } from 'x402-a2a-typescript';

// In your agent tool, throw an exception to request payment:
throw new x402PaymentRequiredException(
  "Payment required for product",
  {
    scheme: "exact",
    network: "base-sepolia",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xYourWalletAddress",
    maxAmountRequired: "1000000", // 1 USDC in atomic units
    resource: "/buy-product",
    description: "Payment for banana",
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
  }
);
```

#### Client-Side (Wallet)

```typescript
import { processPayment, x402Utils } from 'x402-a2a-typescript';
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey);
const utils = new x402Utils();

// Get payment requirements from task
const paymentRequired = utils.getPaymentRequirements(task);

// Sign the payment
const paymentPayload = await processPayment(
  paymentRequired.accepts[0],
  wallet
);
```

## Comparison with Python Implementation

| Feature | Python | TypeScript |
|---------|--------|------------|
| Language | Python 3.11+ | TypeScript 5.x |
| Type System | Pydantic | TypeScript interfaces |
| Wallet Library | eth-account | ethers.js |
| ADK Integration | adk-sdk | adk-typescript |
| Exception-based Flow | ✅ | ✅ |
| Executors | ✅ | ✅ |

## Key Differences from Python

1. **Type Definitions**: TypeScript uses interfaces instead of Pydantic models
2. **Wallet Integration**: Uses ethers.js instead of eth-account
3. **Crypto Operations**: Uses native Web Crypto API where available

## Development

### Building the Library

```bash
cd x402_a2a
npm run build
```

### Cleaning Build Artifacts

```bash
cd x402_a2a
npm run clean
```

### Installing in Another Project

```bash
# In your project
npm install file:../x402_a2a
```

## 📖 Documentation

For detailed protocol documentation, see:
- [Python x402_a2a README](../../python/x402_a2a/README.md) - Complete protocol specification
- [Merchant Agent README](merchant-agent/README.md) - Example agent usage

## Key Components

### x402PaymentRequiredException

The core exception class that enables dynamic payment requirements:

```typescript
// Simple payment request
throw await x402PaymentRequiredException.forService({
  price: "$5.00",
  payToAddress: "0x123...",
  resource: "/premium-feature"
});

// Multiple payment options
throw new x402PaymentRequiredException(
  "Choose payment tier",
  [basicRequirement, premiumRequirement, ultraRequirement]
);
```

### x402Utils

State management utilities for working with tasks and metadata:

```typescript
const utils = new x402Utils();

// Get payment status
const status = utils.getPaymentStatus(task);

// Get payment requirements
const requirements = utils.getPaymentRequirements(task);

// Record payment success
utils.recordPaymentSuccess(task, settleResponse);
```

### x402ServerExecutor

Abstract base class for implementing merchant agents:

```typescript
class MyMerchantExecutor extends x402ServerExecutor {
  async verifyPayment(payload, requirements) {
    // Implement verification with your facilitator
  }

  async settlePayment(payload, requirements) {
    // Implement settlement with your facilitator
  }
}
```

## Testing & Development

### End-to-End Payment Flow Test

Test the complete payment flow with both agents:

1. **Terminal 1 - Start merchant agent:**
   ```bash
   cd merchant-agent
   npm run dev
   ```

2. **Terminal 2 - Start client agent:**
   ```bash
   cd client-agent
   npm run dev
   ```

3. **Client terminal - Make a purchase:**
   ```
   You: I want to buy a banana
   Agent: The merchant is requesting 1.000000 USDC for a banana.
          Would you like to proceed with this payment?
   You: yes
   Agent: ✅ Payment completed successfully!
   ```

### Merchant Payment Flow Test (Standalone)

Test just the merchant agent's payment verification:

```bash
cd merchant-agent
npm run test:payment
```

This simulates:
- Product request
- Payment requirement generation
- Client signature
- Payment verification
- Transaction settlement

### Available Commands

#### Client Agent
```bash
npm run dev        # Start in CLI mode
npm run web        # Start with web UI
npm run build      # Compile TypeScript
```

#### Merchant Agent
```bash
npm run dev              # Start as API server (port 10000)
npm run web              # Start with web UI
npm run test:payment     # Test payment flow standalone
npm run build            # Compile TypeScript
```

#### x402_a2a Library
```bash
npm run build      # Compile library
npm run clean      # Remove build artifacts
```

## Configuration

### Environment Variables

Both agents require configuration via `.env` files.

#### Client Agent (`.env`)
```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key_here
WALLET_PRIVATE_KEY=0xYourClientPrivateKey
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Optional
MERCHANT_AGENT_URL=http://localhost:10000/agents/merchant
```

#### Merchant Agent (`.env`)
```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key_here
WALLET_PRIVATE_KEY=0xYourMerchantPrivateKey

# Optional
PORT=10000
```

### Wallet Setup

Both agents need wallets with funds:

**Client Wallet:**
- ETH for gas fees
- USDC for payments

**Merchant Wallet:**
- ETH for settlement gas fees

Get testnet funds:
- **ETH**: https://www.alchemy.com/faucets/base-sepolia or https://faucet.quicknode.com/base/sepolia
- **USDC**: https://faucet.circle.com/ (select "Base Sepolia" network)

### Network Details

**Base Sepolia (Testnet)**
- Chain ID: 84532
- RPC: `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` or `https://sepolia.base.org`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Explorer: https://sepolia.basescan.org/

**Base Mainnet (Production)**
- Chain ID: 8453
- RPC: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY` or `https://mainnet.base.org`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Explorer: https://basescan.org/

## Security Considerations

### Private Key Management

⚠️ **CRITICAL**: Private keys have full control over wallet funds!

- Never commit `.env` files to git (included in `.gitignore`)
- Use separate wallets for testing vs. production
- Consider hardware wallet integration for production
- Rotate keys regularly
- Use minimal balances for testing

### Approval Limits

The client wallet approves with a 10% buffer:
```typescript
// Approve 110 USDC if merchant requests 100 USDC
const approvalAmount = (amount * 110n) / 100n;
```

You can revoke approvals anytime:
```bash
# Using cast (Foundry)
cast send $USDC_ADDRESS "approve(address,uint256)" \
  $MERCHANT_ADDRESS 0 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY
```

## Troubleshooting

### Common Issues

**Issue: "Insufficient balance"**
```bash
# Check USDC balance
cast call $USDC_ADDRESS "balanceOf(address)(uint256)" $YOUR_ADDRESS \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# Get testnet USDC at: https://faucet.circle.com/
```

**Issue: "Insufficient allowance"**
```bash
# Check current allowance
cast call $USDC_ADDRESS "allowance(address,address)(uint256)" \
  $CLIENT_ADDRESS $MERCHANT_ADDRESS \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# The wallet should auto-approve, but you can manually approve if needed
```

**Issue: "Failed to parse user message"**

The client agent uses LLM-based parsing. If it fails:
- Check your `GOOGLE_API_KEY` is valid
- Try more explicit phrasing: "I want to buy a banana"
- Check the fallback regex supports your product name

**Issue: "Connection refused to merchant"**

Ensure the merchant agent is running:
```bash
# Terminal 1
cd merchant-agent
npm run dev

# Terminal 2 - check it's running
curl http://localhost:10000/health
```

## 🤝 Contributing

When making changes:

1. Update TypeScript source files in the appropriate directory
2. Run `npm run build` to compile
3. Test with both client and merchant agents
4. Ensure TypeScript compilation succeeds without errors
5. Update documentation if adding features

### Adding New Features

**To add a new product:**
- Client: Update the LLM parsing examples in `parseUserMessage()`
- Merchant: Pricing is automatic (fixed at 1 USDC)

**To change pricing:**
- Edit `agent.ts:135` in client-agent
- Edit `agent.ts` in merchant-agent (if implementing dynamic pricing)

**To add payment methods:**
- Extend the payment requirements in both agents
- Update the wallet to support new tokens/networks

## 📚 Further Reading

### Documentation
- **Client Agent**: [client-agent/README.md](client-agent/README.md)
- **Merchant Agent**: [merchant-agent/README.md](merchant-agent/README.md)
- **x402 Library**: Core protocol implementation
- **Deployment**: [merchant-agent/DEPLOYMENT.md](merchant-agent/DEPLOYMENT.md)

### Related Implementations
- **Python Implementation**: `../../python/x402_a2a/` - Full protocol spec
- **Python Demo**: `../../python/adk-demo/` - Reference implementation

## 📄 License

Apache-2.0 - See LICENSE file for details

## 🎯 What's Next?

1. **Try the demo**: Follow the Quick Start guide
2. **Customize pricing**: Modify the merchant agent's pricing logic
3. **Add products**: Extend the product catalog
4. **Deploy**: Use the deployment guide for production setup
5. **Build your own**: Use the library to create custom payment-enabled agents
