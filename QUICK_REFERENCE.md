# 🚀 Solana Agents - Quick Reference

## ⚡ Quick Commands

```bash
# Run all tests
pnpm test:solana

# Run specific tests
pnpm test:wallet          # Wallet functionality
pnpm test:payment         # Payment flow

# Start agents
cd merchant-agent && npm run dev    # Terminal 1
cd client-agent && npm run dev      # Terminal 2
```

## 💬 Example Conversations

**Ethereum Payment (Default):**

```
User: "I want to buy a banana"
Agent: Shows USDC payment requirement
User: "confirm"
Agent: Processes Ethereum payment
```

**Solana Payment:**

```
User: "I want to buy a banana with Solana"
Agent: Shows SOL payment requirement
User: "confirm"
Agent: Processes Solana payment
```

**Wallet Info:**

```
User: "what's my wallet info?"
Agent: Shows both Ethereum and Solana addresses/balances
```

**Airdrop:**

```
User: "send me some SOL"
Agent: Requests 2 SOL airdrop from Devnet
```

## 📁 Key Files

### Client Agent

```
client-agent/
├── agent-solana-enhanced.ts         # Main agent
├── src/wallet/SolanaWallet.ts       # Solana wallet
├── test-solana-wallet.ts            # Wallet tests
└── test-solana-payment-flow.ts      # Payment tests
```

### Merchant Agent

```
merchant-agent/
├── agent.ts                         # Main agent (dual-chain)
├── src/wallet/SolanaWallet.ts       # Merchant wallet
└── src/executor/
    └── SolanaPaymentExecutor.ts     # Payment verification
```

## 🔧 Configuration

**.env (Client Agent):**

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
MERCHANT_AGENT_URL=http://localhost:10000
```

**.env (Merchant Agent):**

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_MERCHANT_PRIVATE_KEY=          # Optional
```

## 📊 Payment Flow

```
1. User requests product with "Solana" keyword
2. Merchant creates SOL payment requirement (0.1 SOL)
3. Client shows price and asks confirmation
4. User confirms
5. Client executes SOL transfer
6. Merchant verifies transaction
7. Order confirmed!
```

## 🧪 Test Coverage

✅ Wallet creation  
✅ Airdrops  
✅ Balance checking  
✅ SOL transfers  
✅ Signature generation  
✅ Payment signing  
✅ Payment verification  
✅ Transaction confirmation  

## 🔗 Explorer Links

**Solana Devnet:**

- Transaction: `https://explorer.solana.com/tx/{signature}?cluster=devnet`
- Address: `https://explorer.solana.com/address/{address}?cluster=devnet`

**Base Sepolia:**

- Transaction: `https://sepolia.basescan.org/tx/{hash}`
- Address: `https://sepolia.basescan.org/address/{address}`

## 💡 Common Operations

### Check Balance

```typescript
const balance = await wallet.getBalance();
console.log(`${Number(balance) / 1e9} SOL`);
```

### Transfer SOL

```typescript
const result = await wallet.transferSol(
  recipientAddress,
  lamports(100_000_000n) // 0.1 SOL
);
```

### Request Airdrop

```typescript
const sig = await wallet.requestAirdrop(
  lamports(2_000_000_000n) // 2 SOL
);
```

### Verify Payment

```typescript
const result = await executor.verifyPayment(
  payload,
  requirements
);
```

## 🐛 Troubleshooting

**Airdrop fails:**

- Wait a few minutes (rate limited)
- Use <https://faucet.solana.com/>

**TX not confirming:**

- Increase timeout in wallet config
- Check RPC endpoint status

**Tests failing:**

- Run `pnpm install` in both agents
- Check .env configuration
- Verify network connectivity

## 📚 Documentation

- **[SOLANA_AGENTS_WORKFLOW.md](./SOLANA_AGENTS_WORKFLOW.md)** - Complete guide
- **[SOLANA_WORKFLOW_COMPLETE.md](./SOLANA_WORKFLOW_COMPLETE.md)** - Summary
- **[SOLANA_IMPLEMENTATION.md](./SOLANA_IMPLEMENTATION.md)** - Technical details

## ✅ Status: COMPLETE

All features implemented and tested! 🎉
