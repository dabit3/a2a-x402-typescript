# Testing Algorand Support

This guide walks you through testing the Algorand implementation in the a2a-x402-typescript project.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Algorand account** with:
   - Some ALGO for transaction fees (~0.5 ALGO minimum)
   - Test USDC (ASA ID: 10458941 on TestNet)
3. **Algorand wallet** with a 25-word mnemonic phrase

## Quick Setup

### 1. Get an Algorand TestNet Account

**Option A: Use Pera Wallet (Recommended)**
1. Download [Pera Wallet](https://perawallet.app/)
2. Create a new account
3. Switch to TestNet in settings
4. Copy your 25-word mnemonic phrase (Settings → Account → Show Passphrase)
5. Get test ALGO from: https://bank.testnet.algorand.network/

**Option B: Generate a new account programmatically**
```bash
cd x402_a2a
npm install
node -e "const algosdk = require('algosdk'); const acc = algosdk.generateAccount(); console.log('Address:', acc.addr); console.log('Mnemonic:', algosdk.secretKeyToMnemonic(acc.sk));"
```

### 2. Fund Your Account

1. **Get test ALGO**:
   - Visit https://bank.testnet.algorand.network/
   - Enter your Algorand address
   - Request 10 ALGO

2. **Get test USDC** (optional, for full testing):
   - You'll need to opt-in to the USDC ASA first
   - The library handles opt-in automatically during payment

## Testing the Core Library

### Test 1: Basic Network Connection

Create `test-algorand.ts`:

```typescript
import {
  getAlgodClient,
  getSuggestedParams,
  isValidAlgorandAddress
} from './x402_a2a';

async function testConnection() {
  console.log('Testing Algorand connection...\n');

  // Test network connection
  const client = getAlgodClient('algorand-testnet');
  const status = await client.status().do();
  console.log('✅ Connected to Algorand TestNet');
  console.log(`   Last round: ${status.lastRound}`);

  // Get suggested params
  const params = await getSuggestedParams('algorand-testnet');
  console.log('✅ Retrieved transaction parameters');
  console.log(`   Fee: ${params.fee} microALGO`);

  // Test address validation
  const testAddr = 'YOUR_ALGORAND_ADDRESS_HERE';
  const isValid = isValidAlgorandAddress(testAddr);
  console.log(`✅ Address validation: ${isValid ? 'Valid' : 'Invalid'}`);
}

testConnection().catch(console.error);
```

Run it:
```bash
cd x402_a2a
npx ts-node test-algorand.ts
```

### Test 2: Account Generation and Wallet

Create `test-wallet.ts`:

```typescript
import {
  generateAccount,
  accountFromMnemonic,
  getAlgodClient
} from './x402_a2a';

async function testWallet() {
  console.log('Testing Algorand wallet functions...\n');

  // Generate a new account
  const newAccount = generateAccount();
  console.log('✅ Generated new account');
  console.log(`   Address: ${newAccount.address}`);
  console.log(`   Mnemonic: ${newAccount.mnemonic}`);

  // Restore from mnemonic
  const mnemonic = process.env.ALGORAND_MNEMONIC || newAccount.mnemonic;
  const account = accountFromMnemonic(mnemonic);
  console.log('\n✅ Restored account from mnemonic');
  console.log(`   Address: ${account.address}`);

  // Check balance
  const client = getAlgodClient('algorand-testnet');
  const accountInfo = await client.accountInformation(account.address).do();
  const algoBalance = Number(accountInfo.amount) / 1_000_000;
  console.log(`\n✅ Account balance: ${algoBalance} ALGO`);

  // Check ASA holdings
  const assets = accountInfo.assets || [];
  console.log(`   ASA count: ${assets.length}`);
  assets.forEach((asset: any) => {
    console.log(`   - ASA ${asset['asset-id']}: ${asset.amount} units`);
  });
}

testWallet().catch(console.error);
```

Run it:
```bash
export ALGORAND_MNEMONIC="your twenty five word mnemonic phrase here"
npx ts-node test-wallet.ts
```

### Test 3: Payment Signing

Create `test-payment.ts`:

```typescript
import {
  accountFromMnemonic,
  processAlgorandPayment,
  createPaymentRequirements
} from './x402_a2a';

async function testPayment() {
  console.log('Testing Algorand payment signing...\n');

  const mnemonic = process.env.ALGORAND_MNEMONIC;
  if (!mnemonic) {
    throw new Error('ALGORAND_MNEMONIC environment variable not set');
  }

  const account = accountFromMnemonic(mnemonic);
  console.log(`Sender: ${account.address}\n`);

  // Create payment requirements (1 USDC)
  const requirements = await createPaymentRequirements({
    price: "$1.00",
    payToAddress: "RECIPIENT_ADDRESS_HERE", // Replace with actual address
    resource: "/test-payment",
    network: "algorand-testnet",
    description: "Test payment"
  });

  console.log('Payment requirements:');
  console.log(`  Network: ${requirements.network}`);
  console.log(`  Asset: ${requirements.asset} (USDC ASA ID)`);
  console.log(`  Amount: ${requirements.maxAmountRequired} (1 USDC)`);
  console.log(`  To: ${requirements.payTo}`);

  // Sign the payment
  const paymentPayload = await processAlgorandPayment(
    requirements,
    account
  );

  console.log('\n✅ Payment signed successfully');
  console.log(`   Transaction ID: ${paymentPayload.payload.txnId}`);
  console.log(`   Signature length: ${paymentPayload.payload.signature.length} bytes`);
}

testPayment().catch(console.error);
```

Run it:
```bash
export ALGORAND_MNEMONIC="your twenty five word mnemonic phrase here"
npx ts-node test-payment.ts
```

### Test 4: Full Payment Flow with Verification

Create `test-full-flow.ts`:

```typescript
import {
  accountFromMnemonic,
  processAlgorandPayment,
  createPaymentRequirements,
  verifyAlgorandPayment,
  settleAlgorandPayment
} from './x402_a2a';

async function testFullFlow() {
  console.log('Testing full Algorand payment flow...\n');

  const mnemonic = process.env.ALGORAND_MNEMONIC;
  if (!mnemonic) {
    throw new Error('ALGORAND_MNEMONIC environment variable not set');
  }

  const account = accountFromMnemonic(mnemonic);

  // Step 1: Create requirements
  const requirements = await createPaymentRequirements({
    price: "$0.01", // Small amount for testing
    payToAddress: account.address, // Pay to self for testing
    resource: "/test",
    network: "algorand-testnet"
  });

  console.log('Step 1: Payment requirements created ✅');

  // Step 2: Sign payment
  const paymentPayload = await processAlgorandPayment(requirements, account);
  console.log('Step 2: Payment signed ✅');

  // Step 3: Verify payment
  const verifyResult = await verifyAlgorandPayment(paymentPayload, requirements);
  console.log('Step 3: Payment verified ✅');
  console.log(`   Valid: ${verifyResult.isValid}`);
  console.log(`   Payer: ${verifyResult.payer}`);

  if (!verifyResult.isValid) {
    console.error('❌ Payment verification failed:', verifyResult.invalidReason);
    return;
  }

  // Step 4: Settle (submit to blockchain)
  console.log('\nSubmitting to blockchain...');
  const settleResult = await settleAlgorandPayment(paymentPayload, requirements);
  console.log('Step 4: Payment settled ✅');
  console.log(`   Success: ${settleResult.success}`);
  console.log(`   Transaction: ${settleResult.transaction}`);
  console.log(`   Network: ${settleResult.network}`);

  if (settleResult.success) {
    console.log(`\n🎉 View on explorer: https://testnet.algoexplorer.io/tx/${settleResult.transaction}`);
  }
}

testFullFlow().catch(console.error);
```

Run it:
```bash
export ALGORAND_MNEMONIC="your twenty five word mnemonic phrase here"
npx ts-node test-full-flow.ts
```

## Testing with Example Agents

### Client Agent with Algorand Support

1. **Set up the client agent:**
```bash
cd client-agent
npm install
cp .env.example .env
```

2. **Edit `.env` file:**
```env
# Add these Algorand-specific variables
ALGORAND_MNEMONIC=your twenty five word mnemonic phrase here
ALGORAND_NETWORK=algorand-testnet

# Keep existing variables for EVM support
WALLET_PRIVATE_KEY=your_evm_private_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. **Modify `agent.ts` to use AlgorandWallet:**
```typescript
// Add at top
import { AlgorandLocalWallet } from './src/wallet/AlgorandWallet';

// In your agent setup, add:
const algorandWallet = new AlgorandLocalWallet(
  process.env.ALGORAND_MNEMONIC,
  'algorand-testnet'
);

console.log(`Algorand Address: ${algorandWallet.getAddress()}`);
```

4. **Run the agent:**
```bash
npm run dev
```

### Creating a Test Merchant for Algorand

Create `test-merchant.ts` in the merchant-agent directory:

```typescript
import {
  createPaymentRequirements,
  x402PaymentRequiredException
} from 'a2a-x402';

async function createAlgorandPaymentRequest() {
  // Create payment requirement for Algorand
  const requirements = await createPaymentRequirements({
    price: "$1.00",
    payToAddress: "YOUR_MERCHANT_ALGORAND_ADDRESS",
    resource: "/algorand-product",
    network: "algorand-testnet",
    description: "Test product on Algorand"
  });

  // Throw the payment exception
  throw new x402PaymentRequiredException(
    "Payment required for Algorand product",
    requirements
  );
}

createAlgorandPaymentRequest().catch(err => {
  console.log('Payment required exception created:');
  console.log(JSON.stringify(err.toJSON(), null, 2));
});
```

## Common Issues & Troubleshooting

### Issue 1: "Insufficient balance"
**Solution**:
- Check your ALGO balance: You need at least 0.1 ALGO for transaction fees
- Get more ALGO from: https://bank.testnet.algorand.network/

### Issue 2: "ASA opt-in required"
**Solution**:
- The library handles this automatically in `AlgorandLocalWallet`
- If manual opt-in needed, you need 0.1 ALGO per ASA

### Issue 3: "Transaction expired"
**Solution**:
- Algorand transactions have a limited validity window
- Regenerate the payment if too much time has passed
- Default timeout is based on `maxTimeoutSeconds` in requirements

### Issue 4: "Address validation failed"
**Solution**:
- Algorand addresses are 58 characters (not 42 like Ethereum)
- Ensure you're using an Algorand address, not an EVM address

## Testing Checklist

- [ ] Network connection works
- [ ] Can generate new accounts
- [ ] Can restore account from mnemonic
- [ ] Can check account balance
- [ ] Can create payment requirements
- [ ] Can sign payment payload
- [ ] Payment verification passes
- [ ] Can submit transaction to blockchain
- [ ] Transaction confirms successfully
- [ ] Can view transaction on explorer

## Next Steps

1. **Test on MainNet** (when ready):
   - Change network to `algorand-mainnet`
   - Use real USDC (ASA ID: 31566704)
   - Fund with real ALGO

2. **Integrate with agents**:
   - Update client agent to handle both EVM and Algorand
   - Add network selection logic
   - Test end-to-end payment flows

3. **Performance testing**:
   - Test with multiple concurrent payments
   - Measure confirmation times (~4.5 seconds per round)
   - Test failure scenarios

## Resources

- **Algorand TestNet Explorer**: https://testnet.algoexplorer.io/
- **Algorand Faucet**: https://bank.testnet.algorand.network/
- **Algorand Documentation**: https://developer.algorand.org/
- **Pera Wallet**: https://perawallet.app/
- **AlgoSigner**: https://www.purestake.com/technology/algosigner/
