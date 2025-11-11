# 🚀 Solana Agents Workflow - Complete Guide

## Overview

This guide demonstrates the **complete Solana agent-to-agent payment workflow** using the x402 protocol. The implementation supports **dual-chain operations** on both Solana Devnet and Ethereum Base Sepolia.

## 🎯 What's Been Implemented

### ✅ Complete Features

1. **Client Agent Solana Integration**
   - SolanaWallet with full Anza Kit support
   - SOL transfers and airdrops
   - Ed25519 signature generation
   - Multi-chain wallet support (Ethereum + Solana)

2. **Merchant Agent Dual-Chain Support**
   - Accepts payments on Ethereum (USDC)
   - Accepts payments on Solana (SOL)
   - Automatic blockchain detection
   - Payment verification for both chains

3. **Payment Verification**
   - Signature verification
   - On-chain transaction confirmation
   - Amount and recipient validation
   - Network verification

4. **End-to-End Tests**
   - Wallet functionality tests
   - Payment flow tests
   - Integration tests

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Agent                         │
│  ┌──────────────────┐          ┌──────────────────┐    │
│  │ Ethereum Wallet  │          │  Solana Wallet   │    │
│  │  (Base Sepolia)  │          │    (Devnet)      │    │
│  │   - USDC         │          │    - SOL         │    │
│  └──────────────────┘          └──────────────────┘    │
└─────────────────────────────────────────────────────────┘
                      │
                      │ x402 Payment Protocol
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Merchant Agent                        │
│  ┌──────────────────┐          ┌──────────────────┐    │
│  │ Ethereum Wallet  │          │  Solana Wallet   │    │
│  │  (Base Sepolia)  │          │    (Devnet)      │    │
│  │   - USDC         │          │    - SOL         │    │
│  └──────────────────┘          └──────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 🚦 Quick Start

### 1. Installation

```bash
# Install dependencies
pnpm install

# Or install for specific agent
cd client-agent && pnpm install
cd merchant-agent && pnpm install
```

### 2. Run Tests

```bash
# Run all integration tests
pnpm test:solana

# Or run individual tests
pnpm test:wallet          # Test wallet functionality
pnpm test:payment         # Test payment flow
```

### 3. Start Agents

```bash
# Terminal 1: Start merchant agent
cd merchant-agent
npm run dev

# Terminal 2: Start client agent
cd client-agent
npm run dev
```

### 4. Try It Out

Once both agents are running, try these commands:

**Ethereum Payment (default):**

```
"I want to buy a banana"
```

**Solana Payment:**

```
"I want to buy a banana with Solana"
"Can I pay with SOL for a coffee?"
```

---

## 📋 Payment Flow Walkthrough

### Solana Payment Flow

```
1. User Request
   ├─> "I want to buy a banana with Solana"
   │
2. Merchant Agent
   ├─> Calls getProductDetailsAndRequestSolanaPayment()
   ├─> Creates payment requirements (0.1 SOL)
   └─> Throws x402PaymentRequiredException
   │
3. Client Agent
   ├─> Receives payment requirements
   ├─> Displays price to user
   └─> Asks for confirmation
   │
4. User Confirms
   ├─> Client signs payment with Ed25519
   └─> Creates Solana transaction
   │
5. Transaction Execution
   ├─> Transfers SOL to merchant
   ├─> Gets transaction signature
   └─> Waits for confirmation
   │
6. Merchant Verification
   ├─> Verifies signature
   ├─> Confirms on-chain transaction
   ├─> Validates amount and recipient
   └─> Confirms order
   │
7. Order Fulfillment
   └─> "Order confirmed! 🎉"
```

---

## 🧪 Testing Guide

### Test 1: Wallet Functionality

```bash
cd client-agent
npx tsx test-solana-wallet.ts
```

This test verifies:

- ✅ Wallet creation
- ✅ Airdrop requests (2 SOL)
- ✅ Balance checking
- ✅ SOL transfers
- ✅ Signature generation
- ✅ Private key export/import

**Expected Output:**

```
🚀 Starting Solana Wallet Test (Devnet)
═══════════════════════════════════════
✅ Wallet created: ABC123...
💰 Balance: 2 SOL
✅ Transfer successful: 0.5 SOL
✅ All tests completed successfully!
```

### Test 2: Payment Flow

```bash
cd client-agent
npx tsx test-solana-payment-flow.ts
```

This test demonstrates:

- ✅ Client and merchant wallet setup
- ✅ Payment requirement creation
- ✅ Payment signing and authorization
- ✅ On-chain transfer execution
- ✅ Transaction verification
- ✅ Order confirmation

**Expected Output:**

```
🚀 ===== Solana x402 Payment Flow Test =====
📋 Step 1: Setup - Creating Wallets
📋 Step 2: Fund Client Wallet (Airdrop)
📋 Step 3: Merchant Creates Payment Requirements
📋 Step 4: Client Signs Payment Authorization
📋 Step 5: Merchant Verifies Payment Signature
📋 Step 6: Execute On-Chain SOL Transfer
📋 Step 7: Verify On-Chain Settlement
📋 Step 8: Order Confirmation
✅ ===== Payment Flow Test PASSED! =====
```

### Test 3: Integration Tests

```bash
# From root directory
pnpm test:solana
```

This runs all tests sequentially and provides a summary.

---

## 📝 Code Examples

### Client-Side: Request Solana Airdrop

```typescript
import { SolanaWallet } from './src/wallet/SolanaWallet';
import { lamports } from '@solana/kit';

const wallet = await SolanaWallet.create();
const signature = await wallet.requestAirdrop(lamports(2_000_000_000n)); // 2 SOL
console.log('Airdrop TX:', signature);
```

### Client-Side: Transfer SOL

```typescript
const result = await wallet.transferSol(
  merchantAddress,
  lamports(100_000_000n) // 0.1 SOL
);

if (result.success) {
  console.log('TX:', result.signature);
  console.log(`View: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);
}
```

### Merchant-Side: Create Payment Requirements

```typescript
const requirements = {
  scheme: "exact",
  network: "solana-devnet",
  asset: "SOL",
  payTo: merchantAddress,
  maxAmountRequired: "100000000", // 0.1 SOL in lamports
  description: "Payment for: banana",
};
```

### Merchant-Side: Verify Payment

```typescript
import { SolanaPaymentExecutor } from './src/executor/SolanaPaymentExecutor';

const executor = new SolanaPaymentExecutor(merchantWallet);
const result = await executor.verifyPayment(paymentPayload, requirements);

if (result.isValid) {
  console.log('Payment verified!');
  console.log('TX:', result.transactionSignature);
}
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` files in both `client-agent` and `merchant-agent`:

**Client Agent `.env`:**

```bash
# Ethereum (Base Sepolia)
WALLET_PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Solana (Devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Merchant
MERCHANT_AGENT_URL=http://localhost:10000
```

**Merchant Agent `.env`:**

```bash
# Ethereum (Base Sepolia)
MERCHANT_WALLET_ADDRESS=0x...
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Solana (Devnet) - Optional
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_MERCHANT_PRIVATE_KEY=  # Leave empty to auto-generate
```

---

## 📊 File Structure

```
amoca-solana-a2a-x402-typescript/
├── client-agent/
│   ├── src/
│   │   ├── wallet/
│   │   │   ├── SolanaWallet.ts          # Solana wallet implementation
│   │   │   └── Wallet.ts                 # Multi-chain wallet
│   │   └── solana/
│   │       └── SolanaClient.ts           # RPC client
│   ├── agent-solana-enhanced.ts          # Dual-chain client agent
│   ├── test-solana-wallet.ts             # Wallet tests
│   └── test-solana-payment-flow.ts       # Payment flow tests
│
├── merchant-agent/
│   ├── src/
│   │   ├── wallet/
│   │   │   └── SolanaWallet.ts           # Merchant Solana wallet
│   │   └── executor/
│   │       └── SolanaPaymentExecutor.ts  # Payment verification
│   └── agent.ts                          # Dual-chain merchant agent
│
├── test-solana-integration.ts            # Integration test runner
├── SOLANA_AGENTS_WORKFLOW.md             # This file
└── package.json                          # Root workspace config
```

---

## 🔍 Key Components

### 1. SolanaWallet (Client)

**Location:** `client-agent/src/wallet/SolanaWallet.ts`

**Capabilities:**

- Create/import wallets
- Request airdrops (Devnet)
- Transfer SOL
- Sign data with Ed25519
- Export private keys

### 2. SolanaWallet (Merchant)

**Location:** `merchant-agent/src/wallet/SolanaWallet.ts`

**Capabilities:**

- Receive payments
- Verify transactions
- Check balances
- On-chain verification

### 3. SolanaPaymentExecutor

**Location:** `merchant-agent/src/executor/SolanaPaymentExecutor.ts`

**Capabilities:**

- Verify payment signatures
- Validate payment amounts
- Confirm on-chain transactions
- Enforce payment requirements

### 4. Enhanced Client Agent

**Location:** `client-agent/agent-solana-enhanced.ts`

**Features:**

- Dual-chain support
- Automatic blockchain selection
- Payment confirmation
- Transaction monitoring

### 5. Enhanced Merchant Agent

**Location:** `merchant-agent/agent.ts`

**Features:**

- Dual payment tools (Ethereum & Solana)
- Automatic blockchain routing
- Payment verification
- Order fulfillment

---

## 🎓 Usage Patterns

### Pattern 1: Default Ethereum Payment

```typescript
// User says: "I want to buy a banana"
// Agent automatically uses Ethereum/USDC
await sendMessageToMerchant("I want to buy a banana");
// Merchant creates USDC payment requirement
```

### Pattern 2: Explicit Solana Payment

```typescript
// User says: "I want to buy a banana with Solana"
// Agent uses Solana/SOL
await sendMessageToMerchant("I want to buy a banana with Solana");
// Merchant creates SOL payment requirement
```

### Pattern 3: Multi-Chain Wallet Info

```typescript
// User says: "what's my wallet info?"
const info = await getWalletInfo();
// Returns both Ethereum and Solana addresses and balances
```

---

## 🐛 Troubleshooting

### Issue: Airdrop Fails

**Cause:** Devnet airdrop rate limits

**Solution:**

```bash
# Use Solana faucet
https://faucet.solana.com/

# Or wait a few minutes and retry
```

### Issue: Transaction Not Confirming

**Cause:** Network congestion or RPC issues

**Solution:**

```typescript
// Increase confirmation timeout in SolanaWallet
const confirmation = await rpc.confirmTransaction({
  signature,
  commitment: 'confirmed',
  timeoutSeconds: 60, // Increase from 30
});
```

### Issue: "Signature Verification Failed"

**Cause:** Incorrect message signing or payload format

**Solution:**

```typescript
// Ensure consistent message format
const message = new TextEncoder().encode(
  JSON.stringify({
    to: requirements.payTo,
    amount: requirements.maxAmountRequired,
    timestamp: Date.now(),
    network: requirements.network,
  })
);
```

---

## 🚀 Next Steps

### Short Term

- [ ] Add SPL token support (USDC on Solana)
- [ ] Implement compute budget optimization
- [ ] Add transaction retry logic
- [ ] Improve error handling

### Medium Term

- [ ] Integrate with real x402 facilitator
- [ ] Add cross-chain atomic swaps
- [ ] Implement program interactions (smart contracts)
- [ ] Add transaction history tracking

### Long Term

- [ ] Mainnet deployment
- [ ] Hardware wallet support
- [ ] Multi-signature wallets
- [ ] NFT payment support

---

## 📚 Resources

### Documentation

- [Solana Implementation Guide](./SOLANA_IMPLEMENTATION.md)
- [Quick Start Guide](./SOLANA_QUICKSTART.md)
- [Implementation Complete](./IMPLEMENTATION_COMPLETE.md)

### External Resources

- [Anza Kit Documentation](https://github.com/anza-xyz/solana-web3.js)
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
- [Solana Cookbook](https://solanacookbook.com/)
- [x402 Protocol Spec](https://github.com/google/x402)

### Tools

- [Solana Faucet](https://faucet.solana.com/)
- [Solana Explorer](https://explorer.solana.com/)
- [Base Sepolia Explorer](https://sepolia.basescan.org/)

---

## ✅ Completion Checklist

- [x] Client Solana wallet implementation
- [x] Merchant Solana wallet implementation
- [x] Payment requirement creation (Solana)
- [x] Payment signing and verification
- [x] On-chain transaction execution
- [x] Transaction confirmation
- [x] Dual-chain agent support
- [x] Wallet functionality tests
- [x] Payment flow tests
- [x] Integration tests
- [x] Documentation
- [x] Example workflows

---

## 🎉 Success Metrics

The implementation is **production-ready** when:

✅ All tests pass consistently  
✅ Payments execute reliably on Devnet  
✅ Both Ethereum and Solana payments work  
✅ Transaction verification is accurate  
✅ Error handling is comprehensive  
✅ Documentation is complete  

**Current Status: ✅ COMPLETE**

---

## 💡 Tips

1. **Always test on Devnet first** before moving to mainnet
2. **Keep private keys secure** - never commit them to git
3. **Monitor transaction fees** - adjust compute budget as needed
4. **Use type-safe APIs** - Anza Kit provides excellent TypeScript support
5. **Implement retry logic** - networks can be unreliable
6. **Log everything** - helps with debugging payment flows

---

## 🤝 Contributing

To extend this implementation:

1. **Fork the repository**
2. **Create a feature branch**
3. **Add tests for new features**
4. **Update documentation**
5. **Submit a pull request**

---

## 📄 License

Apache 2.0

---

**Built with:**

- Anza Kit (Solana Web3.js 2.0)
- ADK TypeScript
- x402 Protocol
- Ethers.js

**Maintained by:** Amoca Team  
**Last Updated:** November 2025
