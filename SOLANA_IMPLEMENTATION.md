# Solana Implementation Guide

## Overview

This project now includes full Solana blockchain integration using **Anza Kit** (the new Solana web3.js 2.0), alongside the existing Base Sepolia (Ethereum) integration. The implementation demonstrates a dual-chain agent workflow supporting both Ethereum and Solana payments.

## Architecture

### Multi-Chain Support

```
┌─────────────────────────────────────────┐
│      Client Agent (Dual-Chain)          │
├─────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐ │
│  │ Ethereum Wallet │  │ Solana Wallet│ │
│  │ (Base Sepolia)  │  │  (Devnet)    │ │
│  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌──────────────┐    ┌─────────────┐
    │ Base Sepolia │    │Solana Devnet│
    │   (USDC)     │    │   (SOL)     │
    └──────────────┘    └─────────────┘
```

## Key Features

### 1. **Solana Wallet** (`client-agent/src/wallet/SolanaWallet.ts`)

Implemented using Anza Kit (@solana/kit):

- **Key Generation**: Uses Web Crypto API with Ed25519
- **Address Management**: Type-safe Address strings
- **RPC Operations**: Type-safe RPC calls with Devnet support
- **Transactions**: Built using functional pipelines
- **Signatures**: Native Ed25519 signing

#### Key Methods

```typescript
// Create wallet
const wallet = await SolanaWallet.create();

// Get balance
const balance = await wallet.getBalance();

// Request airdrop (Devnet only)
const sig = await wallet.requestAirdrop(lamports(2_000_000_000n));

// Transfer SOL
const result = await wallet.transferSol(recipientAddress, amount);

// Sign arbitrary data
const signature = await wallet.signData(data);

// Export private key
const privateKey = await wallet.exportPrivateKey();
```

### 2. **Solana Client** (`client-agent/src/solana/SolanaClient.ts`)

Simplified RPC client for Devnet operations:

```typescript
const client = new SolanaClient(rpcUrl);

// Get balance
const balance = await client.getBalance(address);

// Get latest blockhash
const { blockhash, lastValidBlockHeight } = await client.getLatestBlockhash();

// Get current slot
const slot = await client.getSlot();
```

### 3. **Enhanced Wallet** (`client-agent/src/wallet/Wallet.ts`)

The `LocalWallet` class now includes Solana integration:

```typescript
class LocalWallet {
  // Ethereum wallet (existing)
  private ethWallet: ethers.Wallet;
  
  // Solana integration
  private solanaClient: SolanaClient;
  private solanaAddress?: Address;
  
  // Methods
  getSolanaClient(): SolanaClient
  getSolanaAddress(): Address | undefined
  setSolanaAddress(address: Address): void
  getSolanaBalance(): Promise<bigint | null>
  requestSolanaAirdrop(lamports: bigint): Promise<string | null>
}
```

## Anza Kit Features Used

### 1. **Type-Safe RPC**

```typescript
import { createSolanaRpc, devnet } from '@solana/kit';

const rpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const { value } = await rpc.getBalance(address).send();
```

### 2. **Functional Transaction Building**

```typescript
import { pipe } from '@solana/functional';

const transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  tx => setTransactionMessageFeePayer(address, tx),
  tx => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
  tx => appendTransactionMessageInstructions([instruction], tx)
);
```

### 3. **Web Crypto API for Keys**

```typescript
import { generateKeyPair, signBytes } from '@solana/keys';

const keyPair: CryptoKeyPair = await generateKeyPair();
const signature = await signBytes(keyPair.privateKey, message);
```

### 4. **Program Instructions**

```typescript
import { getTransferSolInstruction } from '@solana-program/system';

const instruction = getTransferSolInstruction({
  source: senderAddress,
  destination: recipientAddress,
  amount: lamports(1_000_000_000n),
});
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd client-agent
pnpm install
```

### 2. Environment Variables

Create `.env` file:

```bash
# Ethereum (Base Sepolia)
WALLET_PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Solana (Devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Merchant
MERCHANT_AGENT_URL=http://localhost:10000
```

### 3. Test Solana Wallet

```bash
cd client-agent
npx tsx test-solana-wallet.ts
```

Expected output:

```
🚀 Starting Solana Wallet Test (Devnet)
═════════════════════════════════════════════
📝 Step 1: Creating Solana Wallet...
✅ Wallet created: ABC123...
📝 Step 2: Checking initial balance...
💰 Balance: 0 lamports (0 SOL)
📝 Step 3: Requesting airdrop...
✅ Airdrop requested: 2 SOL
...
✅ All tests completed successfully!
```

## Usage Examples

### Basic Solana Operations

```typescript
import { SolanaWallet } from './src/wallet/SolanaWallet';
import { lamports } from '@solana/kit';

// Create wallet
const wallet = await SolanaWallet.create();
console.log('Address:', wallet.getAddress());

// Request airdrop
const airdropSig = await wallet.requestAirdrop(lamports(2_000_000_000n));
console.log('Airdrop:', airdropSig);

// Check balance
const balance = await wallet.getBalance();
console.log('Balance:', balance, 'lamports');

// Transfer
const result = await wallet.transferSol(
  recipientAddress,
  lamports(500_000_000n)
);
if (result.success) {
  console.log('Transfer TX:', result.signature);
}
```

### Multi-Chain Wallet

```typescript
import { LocalWallet } from './src/wallet/Wallet';
import { SolanaWallet } from './src/wallet/SolanaWallet';

// Initialize both wallets
const ethWallet = new LocalWallet();
const solWallet = await SolanaWallet.create();

// Link Solana to main wallet
ethWallet.setSolanaAddress(solWallet.getAddress());

// Check both balances
console.log('ETH Address:', ethWallet.getAddress());
console.log('SOL Address:', ethWallet.getSolanaAddress());

const solBalance = await ethWallet.getSolanaBalance();
console.log('SOL Balance:', solBalance);
```

## Transaction Flow

### Solana Payment Flow

```
1. User requests purchase
   ↓
2. Agent contacts merchant
   ↓
3. Merchant provides payment requirements
   ↓
4. User confirms payment
   ↓
5. Build transaction:
   - Create transaction message
   - Set fee payer
   - Set lifetime (blockhash)
   - Add transfer instruction
   ↓
6. Sign transaction with keypair
   ↓
7. Send transaction to network
   ↓
8. Confirm transaction
   ↓
9. Notify merchant
   ↓
10. Complete!
```

## Key Differences: Anza Kit vs web3.js 1.x

| Feature | web3.js 1.x | Anza Kit 2.0 |
|---------|-------------|--------------|
| **Keys** | `Keypair` class | `CryptoKeyPair` (Web Crypto) |
| **Addresses** | `PublicKey` class | `Address` string type |
| **Transactions** | Mutable classes | Immutable functional pipes |
| **RPC** | Promise-based | Type-safe with `.send()` |
| **Signatures** | Sync signing | Async Web Crypto |
| **Bundle Size** | Large monolith | Modular packages |

## Package Structure

```
@solana/kit                    # Main package (re-exports everything)
  ├─ @solana/keys              # Key management
  ├─ @solana/addresses         # Address utilities
  ├─ @solana/rpc               # RPC client
  ├─ @solana/transactions      # Transaction building
  ├─ @solana/functional        # pipe() utilities
  ├─ @solana/codecs            # Data serialization
  └─ @solana-program/*         # Program clients
     ├─ system                 # System program
     └─ compute-budget         # Compute budget program
```

## Security Considerations

1. **Private Key Storage**: Use environment variables or secure vaults
2. **RPC Endpoints**: Use trusted RPC providers
3. **Devnet Only**: Current implementation is for Devnet testing
4. **Key Export**: Only export private keys when absolutely necessary
5. **Transaction Confirmation**: Always wait for confirmation

## Migration to Mainnet

When ready for production:

1. Change RPC URL to mainnet:

```typescript
const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
```

2. Remove Devnet helper:

```typescript
// Before
const rpc = createSolanaRpc(devnet(url));

// After
const rpc = createSolanaRpc(url);
```

3. Disable airdrops (not available on mainnet)

4. Use production SPL tokens instead of SOL

5. Implement proper error handling and retries

## Testing

Run the test suite:

```bash
# Test Solana wallet
npx tsx test-solana-wallet.ts

# Test full agent (with both chains)
npm run dev
```

## Troubleshooting

### Common Issues

**Error: Ed25519 not supported**

```bash
# Install polyfill
pnpm install @solana/webcrypto-ed25519-polyfill
```

**Error: Cannot find module 'bs58'**

```bash
pnpm install bs58
```

**Airdrop fails**

- Devnet airdrops are rate-limited
- Try again after a few minutes
- Use alternative: <https://faucet.solana.com>

**Transaction timeout**

- Increase confirmation timeout
- Check RPC endpoint status
- Verify sufficient balance for fees

## Resources

- [Anza Kit Documentation](https://github.com/anza-xyz/solana-web3.js)
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
- [Solana Cookbook](https://solanacookbook.com/)
- [Anza Kit Tour](https://github.com/anza-xyz/solana-web3.js/blob/master/TOUR.md)

## Future Enhancements

- [ ] SPL Token support (USDC, USDT on Solana)
- [ ] Solana-based x402 payment protocol
- [ ] Cross-chain atomic swaps
- [ ] Solana NFT integration
- [ ] Mainnet support
- [ ] Hardware wallet integration
- [ ] Multi-signature support
- [ ] Program interaction (smart contracts)

## License

Apache 2.0
