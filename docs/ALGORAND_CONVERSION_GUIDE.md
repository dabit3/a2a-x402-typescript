# Algorand Conversion Guide for a2a-x402

This guide maps the current EVM-specific code to the changes needed for Algorand support.

## File-by-File Conversion Strategy

### Priority 1: Type System & Configuration

#### 1. `/x402_a2a/types/state.ts` - Network Support
**Current (EVM-only)**:
```typescript
export type SupportedNetworks = "base" | "base-sepolia" | "ethereum" | "polygon" | "polygon-amoy";

export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}
```

**Changes Needed**:
- Add Algorand networks: `"algorand-mainnet" | "algorand-testnet"`
- Create `AlgorandAuthorization` interface (transaction-based, not EIP-3009)
- Make `PaymentPayload` support both EVM and Algorand formats (union type)

#### 2. `/x402_a2a/types/config.ts` - Token Addresses
**Current**:
```typescript
const USDC_ADDRESSES: Record<SupportedNetworks, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // ... other EVM networks
};
```

**Changes Needed**:
- Replace with Algorand ASA IDs (integers, not hex addresses):
  ```typescript
  const USDC_ASSET_IDS: Record<SupportedNetworks, number> = {
    "algorand-mainnet": 31566704,  // USDC on Algorand mainnet
    "algorand-testnet": 10458941,  // USDC on Algorand testnet
  };
  ```

### Priority 2: Core Signing & Payment Logic

#### 3. `/x402_a2a/core/wallet.ts` - Payment Signing
**Current**:
```typescript
export async function processPayment(
  requirements: PaymentRequirements,
  wallet: Wallet,
  maxValue?: number
): Promise<PaymentPayload> {
  // EIP-712 signing logic
  const domain: TypedDataDomain = { ... };
  const types = { TransferWithAuthorization: [...] };
  const signature = await wallet.signTypedData(domain, types, authorization);
}

function getChainId(network: SupportedNetworks): number {
  const chainIds = { base: 8453, ... };
}
```

**Changes Needed**:
1. Create `getNetworkParams()` function (replaces `getChainId`):
   ```typescript
   function getNetworkParams(network: SupportedNetworks) {
     return {
       rpcUrl: string,
       indexerUrl?: string,
       genesisId: string,
       genesisHash: string,
     };
   }
   ```

2. Create `createAlgorandTransaction()` function:
   ```typescript
   async function createAlgorandTransaction(
     requirements: PaymentRequirements,
     senderAddress: string
   ) {
     // Create Algorand ASA transfer transaction
     const txn = {
       from: senderAddress,
       to: requirements.payTo,
       assetIndex: getUSDCAssetId(requirements.network),
       amount: BigInt(requirements.maxAmountRequired),
       currentRound: (await algodClient.status()).lastRound,
       fee: 1000,
       flatFee: true,
       note: Buffer.from("x402 payment"),
     };
   }
   ```

3. Replace EIP-712 signing with Algorand transaction signing:
   ```typescript
   async function signAlgorandTransaction(txn, privateKey) {
     // Use algosdk.signTransaction(txn, privateKey)
   }
   ```

#### 4. `/x402_a2a/core/merchant.ts` - Payment Requirements
**Current**:
```typescript
const USDC_ADDRESSES: Record<SupportedNetworks, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // ...
};

function processPriceToAtomicAmount(price: Price, network: SupportedNetworks) {
  // Returns { maxAmountRequired, assetAddress }
}
```

**Changes Needed**:
- Update token references to use Algorand ASA IDs instead of contract addresses
- Keep decimal conversion logic (USDC has 6 decimals on both chains)

### Priority 3: Provider & RPC Setup

#### 5. `/client-agent/src/wallet/Wallet.ts` - RPC Provider
**Current**:
```typescript
this.provider = new ethers.JsonRpcProvider(url);
this.wallet = new ethers.Wallet(key, this.provider);
```

**Changes Needed**:
1. Create `AlgorandWallet` class parallel to `LocalWallet`:
   ```typescript
   export class AlgorandWallet extends Wallet {
     private algodClient: algosdk.Algodv2;
     private account: Account;

     constructor(mnemonic: string, rpcUrl: string) {
       const account = algosdk.mnemonicToSecretKey(mnemonic);
       this.account = account;
       this.algodClient = new algosdk.Algodv2('', rpcUrl, 443);
     }
   }
   ```

2. Add network endpoint configuration:
   ```typescript
   const ALGORAND_ENDPOINTS = {
     "algorand-mainnet": "https://mainnet-algorand.api.purestake.io/ps2",
     "algorand-testnet": "https://testnet-algorand.api.purestake.io/ps2",
   };
   ```

### Priority 4: Token Operations

#### 6. `/client-agent/src/wallet/Wallet.ts` - Token Transfer
**Current**:
```typescript
async executePayment(tokenAddress: string, merchantAddress: string, amount: bigint) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
  
  // 1. Approval
  const tx = await tokenContract.approve(spenderAddress, approvalAmount);
  
  // 2. Transfer
  const tx = await tokenContract.transfer(merchantAddress, amount);
}
```

**Changes Needed**:
- Remove approval step (Algorand uses atomic transactions, no separate approval)
- Replace with Algorand ASA transfer transaction:
  ```typescript
  async executeAlgorandPayment(assetId: number, merchantAddress: string, amount: bigint) {
    // Create ASA transfer transaction
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      this.account.addr,
      merchantAddress,
      this.algodClient,
      assetId,
      amount,
    );

    // Sign and submit
    const signedTxn = txn.signTxn(this.account.sk);
    const response = await this.algodClient.sendRawTransaction(signedTxn).do();
    
    // Wait for confirmation
    const result = await algosdk.waitForConfirmation(
      this.algodClient,
      response.txId,
      4
    );
  }
  ```

### Priority 5: Protocol Verification & Settlement

#### 7. `/x402_a2a/core/protocol.ts` - Verification & Settlement
**Current**:
```typescript
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  facilitatorClient?: FacilitatorClient
): Promise<VerifyResponse> {
  const facilitator = facilitatorClient || new DefaultFacilitatorClient();
  return facilitator.verify(paymentPayload, paymentRequirements);
}
```

**No Major Changes Needed**: 
- The verification and settlement logic remains blockchain-agnostic
- It delegates to the `FacilitatorClient` which handles blockchain-specific details
- Only the `FacilitatorClient` implementation needs updates

#### 8. `/x402_a2a/core/facilitator.ts` - Facilitator Client
**Changes Needed**:
- Update to handle both EVM and Algorand payloads
- For Algorand, verification would involve:
  ```typescript
  async verifyAlgorandPayment(payload: PaymentPayload, requirements: PaymentRequirements) {
    // 1. Reconstruct the Algorand transaction from payload
    // 2. Verify the signature against the reconstructed transaction
    // 3. Check transaction details (amount, receiver, asset ID, etc.)
    
    const isValid = algosdk.verifyBytes(
      reconstructedTxnBytes,
      payload.signature,
      senderPublicKey
    );
  }
  ```

### Priority 6: Environment & Configuration

#### 9. `.env` Configuration Files
**Current**:
```
WALLET_PRIVATE_KEY=<ethereum-private-key>
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/...
```

**Changes Needed**:
```
# Support both EVM and Algorand
WALLET_TYPE=algorand  # or 'evm'
ALGORAND_MNEMONIC=<25-word-mnemonic>
ALGORAND_RPC_URL=https://testnet-algorand.api.purestake.io/ps2
ALGORAND_INDEXER_URL=https://testnet-algorand.api.purestake.io/idx2

# Optional: Keep EVM support alongside
ETHEREUM_PRIVATE_KEY=<private-key>
BASE_SEPOLIA_RPC_URL=...
```

### Priority 7: Types - Payment Payload Format

#### 10. `/x402_a2a/types/state.ts` - Multi-Chain Support
**Current**:
```typescript
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: ExactPaymentPayload;  // EVM-specific
}

export interface ExactPaymentPayload {
  signature: string;
  authorization: EIP3009Authorization;
}
```

**Changes Needed**:
```typescript
// Option A: Union type (clean but breaking change)
export type PaymentPayload = EVMPaymentPayload | AlgorandPaymentPayload;

export interface EVMPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  chainType: 'evm';
  payload: ExactPaymentPayload;
}

export interface AlgorandPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  chainType: 'algorand';
  payload: {
    signature: string;
    transaction: {
      txn: string;  // Base64-encoded transaction
      authAddress?: string;
    };
  };
}

// Option B: Generic approach (backward compatible)
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  chainType?: 'evm' | 'algorand';  // default: 'evm'
  payload: Record<string, any>;  // Flexible
}
```

---

## Implementation Order

### Phase 1: Foundation (Weeks 1-2)
1. Update type system to support Algorand networks
2. Create Algorand-specific configuration (ASA IDs, RPC endpoints)
3. Create `AlgorandWallet` class with basic signing

### Phase 2: Core Logic (Weeks 2-3)
4. Implement Algorand transaction creation
5. Replace EVM signing with Algorand signing in `processPayment()`
6. Update `merchant.ts` to handle Algorand ASA IDs

### Phase 3: Payment Execution (Weeks 3-4)
7. Implement Algorand token transfer in wallet
8. Add fee/gas calculation for Algorand
9. Implement transaction confirmation logic

### Phase 4: Integration & Testing (Weeks 4-5)
10. Update facilitator client for Algorand
11. Update example agents to support Algorand
12. Comprehensive testing with testnet

### Phase 5: Documentation & Cleanup (Week 5-6)
13. Update documentation
14. Add Algorand examples
15. Package and publish updates

---

## Key Libraries to Add

```json
{
  "dependencies": {
    "algosdk": "^2.8.0",
    "ethers": "^6.13.0"  // Keep for EVM support
  }
}
```

### Key AlgoSDK Functions

```typescript
import algosdk from 'algosdk';

// Account management
const account = algosdk.mnemonicToSecretKey(mnemonic);
const publicKey = algosdk.publicKeyFromPrivateKey(privateKey);

// Transaction creation
algosdk.makeAssetTransferTxnWithSuggestedParams(
  fromAddr,
  toAddr,
  algodClient,
  assetIndex,
  amount,
  suggestedParams
);

// Signing
const signedTxn = txn.signTxn(secretKey);

// Verification
algosdk.verifyBytes(message, signature, publicKey);

// RPC Client
new algosdk.Algodv2(token, server, port);

// Waiting for confirmation
algosdk.waitForConfirmation(algodClient, txId, rounds);
```

---

## Testing Checklist

- [ ] Create Algorand accounts for testing
- [ ] Verify USDC ASA access on testnet
- [ ] Test transaction creation
- [ ] Test transaction signing
- [ ] Test transaction submission
- [ ] Test payment verification
- [ ] Test with client agent flow
- [ ] Test with merchant agent flow
- [ ] Verify multi-chain support (EVM + Algorand simultaneously)

---

## Backward Compatibility Notes

To maintain EVM support while adding Algorand:

1. Use `chainType` field in `PaymentPayload` to identify blockchain
2. Keep all EVM logic intact, add Algorand conditionally
3. Use factory pattern for wallet creation:
   ```typescript
   function createWallet(type: 'evm' | 'algorand', config) {
     if (type === 'evm') return new LocalWallet(config);
     return new AlgorandWallet(config);
   }
   ```
4. Handle both signing mechanisms in payment processing

