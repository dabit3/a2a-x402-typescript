# A2A x402 TypeScript Codebase Analysis
## Comprehensive Overview for Algorand Support

---

## 1. BLOCKCHAIN SUPPORT & CURRENT IMPLEMENTATION

### Currently Supported Blockchains
This codebase is an **EVM-focused x402 payment protocol implementation** that currently supports:

**Production Networks:**
- **Base Mainnet** (Chain ID: 8453)
  - RPC: `https://mainnet.base.org`
  - USDC Token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

- **Ethereum Mainnet** (Chain ID: 1)
  - USDC Token: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

- **Polygon Mainnet** (Chain ID: 137)
  - USDC Token: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`

**Test Networks:**
- **Base Sepolia** (Chain ID: 84532)
  - RPC: `https://sepolia.base.org`
  - USDC Token: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

- **Polygon Amoy** (Chain ID: 80002)
  - USDC Token: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

### Protocol Type
- **EVM-Compatible Only**: Uses Ethers.js library exclusively
- **EIP-712 Signing**: All payments use EIP-712 typed data signing
- **EIP-3009 Support**: Includes authorization with nonce, validAfter, validBefore timestamps
- **ERC-20 Token Payments**: Specifically designed for token transfers (USDC)

---

## 2. REPOSITORY STRUCTURE

```
a2a-x402-typescript/
├── x402_a2a/                    # Core library (NPM package)
│   ├── core/                    # Main payment logic
│   │   ├── merchant.ts          # Payment requirement creation
│   │   ├── wallet.ts            # EIP-712 signing logic
│   │   ├── protocol.ts          # Verify & settle functions
│   │   ├── facilitator.ts       # x402.org/facilitator integration
│   │   ├── utils.ts             # State management utilities
│   │   ├── helpers.ts           # Decorator helpers (@paidService)
│   │   └── agent.ts             # A2A agent integration
│   ├── types/                   # TypeScript definitions
│   │   ├── state.ts             # Core type definitions
│   │   ├── config.ts            # Configuration types
│   │   └── errors.ts            # Error classes
│   ├── executors/               # Optional middleware
│   │   ├── base.ts              # Base executor class
│   │   ├── server.ts            # Merchant executor
│   │   └── client.ts            # Client executor
│   ├── index.ts                 # Main exports
│   └── extension.ts             # x402 extension declaration
├── client-agent/                # Example client implementation
│   ├── agent.ts                 # Client agent with payment tools
│   └── src/wallet/Wallet.ts     # LocalWallet class
└── merchant-agent/              # Example merchant implementation
    ├── server.ts                # HTTP server
    ├── agent.ts                 # Merchant agent logic
    └── src/
        ├── executor/            # MerchantServerExecutor
        └── facilitator/         # Custom facilitator clients

```

---

## 3. CHAIN-SPECIFIC LOGIC LOCATIONS

### A. Network Configuration
**File**: `/x402_a2a/core/wallet.ts` (Lines 163-179)
```typescript
function getChainId(network: SupportedNetworks): number {
  const chainIds: Record<string, number> = {
    base: 8453,
    "base-sepolia": 84532,
    ethereum: 1,
    polygon: 137,
    "polygon-amoy": 80002,
  };
  // ...
}
```

**File**: `/x402_a2a/core/merchant.ts` (Lines 63-69)
```typescript
const USDC_ADDRESSES: Record<SupportedNetworks, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "polygon-amoy": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
};
```

### B. EIP-712 Signing (Ethereum-Specific)
**File**: `/x402_a2a/core/wallet.ts` (Lines 82-158)
```typescript
export async function processPayment(
  requirements: PaymentRequirements,
  wallet: Wallet,
  maxValue?: number
): Promise<PaymentPayload> {
  // Uses ethers.Wallet.signTypedData()
  // EIP-712 domain construction
  // EIP-3009 authorization
}
```

### C. RPC Provider Configuration
**File**: `/client-agent/src/wallet/Wallet.ts` (Lines 57-62)
```typescript
const url = rpcUrl ||
            process.env.BASE_SEPOLIA_RPC_URL ||
            'https://base-sepolia.g.alchemy.com/v2/_sTLFEOJwL7dFs2bLmqUo';

this.provider = new ethers.JsonRpcProvider(url);
```

### D. Token Transfer Logic (ERC-20 Specific)
**File**: `/client-agent/src/wallet/Wallet.ts` (Lines 184-235)
```typescript
async executePayment(
  tokenAddress: string,
  merchantAddress: string,
  amount: bigint
): Promise<{ success: boolean; txHash?: string; error?: string }>
// Uses ERC20 approve() and transfer() functions
```

---

## 4. CONFIGURATION FILES

### Type Definitions
**File**: `/x402_a2a/types/state.ts`
```typescript
export type SupportedNetworks = "base" | "base-sepolia" | "ethereum" | "polygon" | "polygon-amoy";

export interface PaymentRequirements {
  scheme: string;
  network: SupportedNetworks;
  asset: string;          // Token address
  payTo: string;          // Merchant wallet
  maxAmountRequired: string; // Atomic units
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  outputSchema?: any;
  extra?: Record<string, any>;
}

export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}
```

### Price Configuration
**File**: `/x402_a2a/types/config.ts`
```typescript
export type Price = string | number | TokenAmount;

export interface TokenAmount {
  value: string;
  asset: string;
  network: string;
}
```

### Default Extension Config
**File**: `/x402_a2a/types/config.ts` (Lines 35-40)
```typescript
export const DEFAULT_X402_EXTENSION_CONFIG: x402ExtensionConfig = {
  extensionUri: X402_EXTENSION_URI,
  version: "0.1",
  x402Version: 1,
  required: true,
};
```

### Environment Variables
**Client Agent**: `.env.example` requires:
```
WALLET_PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=...
MERCHANT_AGENT_URL=http://localhost:10000
```

**Merchant Agent**: `.env.example` requires:
```
WALLET_PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=...
FACILITATOR_URL=https://x402.org/facilitator
```

---

## 5. WALLET & TRANSACTION HANDLING

### A. Payment Signing Flow
**Entry Point**: `/x402_a2a/core/wallet.ts` - `processPayment()`

**Step 1: Authorization Object Creation**
```typescript
const authorization: EIP3009Authorization = {
  from: wallet.address,
  to: requirements.payTo,
  value: requirements.maxAmountRequired,
  validAfter: 0,
  validBefore: now + requirements.maxTimeoutSeconds,
  nonce: generateNonce(),
};
```

**Step 2: EIP-712 Signing**
```typescript
const domain: TypedDataDomain = {
  name: requirements.extra?.name || "USDC",
  version: requirements.extra?.version || "2",
  chainId: getChainId(requirements.network),
  verifyingContract: requirements.asset,
};

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

const signature = await wallet.signTypedData(domain, types, authorization);
```

**Step 3: Payload Creation**
```typescript
return {
  x402Version: 1,
  scheme: requirements.scheme,
  network: requirements.network,
  payload: {
    signature: signature,
    authorization: authorization,
  },
};
```

### B. Payment Execution (ERC-20 Transfer)
**File**: `/client-agent/src/wallet/Wallet.ts` (Lines 184-235)
```typescript
async executePayment(
  tokenAddress: string,
  merchantAddress: string,
  amount: bigint
) {
  // 1. Check balance
  const balance = await tokenContract.balanceOf(walletAddress);
  
  // 2. Execute transfer
  const tx = await tokenContract.transfer(merchantAddress, amount);
  
  // 3. Wait for confirmation
  const receipt = await tx.wait();
}
```

### C. Token Approval
**File**: `/client-agent/src/wallet/Wallet.ts` (Lines 72-124)
```typescript
async ensureApproval(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint
) {
  // Check current allowance
  const currentAllowance = await tokenContract.allowance(owner, spender);
  
  // If insufficient, approve with 10% buffer
  const approvalAmount = (amount * BigInt(110)) / BigInt(100);
  const tx = await tokenContract.approve(spenderAddress, approvalAmount);
  await tx.wait();
}
```

### D. Wallet State Management
**File**: `/x402_a2a/core/utils.ts`
- `createPaymentSubmissionMessage()`: Packages signed payment
- `recordPaymentSuccess()`: Marks payment completed
- `recordPaymentFailure()`: Handles payment errors
- `getPaymentPayload()`: Retrieves signed payment from task

---

## 6. RPC & NETWORK CONNECTION LOGIC

### A. RPC Provider Setup
**File**: `/client-agent/src/wallet/Wallet.ts` (Lines 45-66)
```typescript
constructor(privateKey?: string, rpcUrl?: string) {
  const url = rpcUrl ||
              process.env.BASE_SEPOLIA_RPC_URL ||
              'https://base-sepolia.g.alchemy.com/v2/_sTLFEOJwL7dFs2bLmqUo';

  this.provider = new ethers.JsonRpcProvider(url);
  this.wallet = new ethers.Wallet(key, this.provider);
}
```

### B. Facilitator Client (Verification & Settlement)
**File**: `/x402_a2a/core/facilitator.ts`
```typescript
export class DefaultFacilitatorClient implements FacilitatorClient {
  private config: FacilitatorConfig;

  constructor(config?: FacilitatorConfig) {
    const url = config?.url || 'https://x402.org/facilitator';
    this.config = {
      url: url.endsWith('/') ? url.slice(0, -1) : url,
      apiKey: config?.apiKey,
    };
  }

  async verify(payload, requirements): Promise<VerifyResponse> {
    const response = await fetch(`${this.config.url}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        x402Version: payload.x402Version,
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
    });
  }

  async settle(payload, requirements): Promise<SettleResponse> {
    const response = await fetch(`${this.config.url}/settle`, {
      method: 'POST',
      // ... similar to verify
    });
  }
}
```

### C. Remote Agent Communication
**File**: `/client-agent/agent.ts` (Lines 86-203)
```typescript
async function sendMessageToMerchant(params) {
  // HTTP request to merchant agent
  const response = await fetch(`${MERCHANT_AGENT_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: 'x402_merchant_agent',
      userId: 'client-user',
      sessionId: sessionId,
      newMessage: { role: 'user', parts: [{ text: message }] },
    }),
  });
}
```

---

## 7. MAIN ENTRY POINTS & CORE FUNCTIONALITY

### A. Library Entry Point
**File**: `/x402_a2a/index.ts`

**Primary Exports:**
```typescript
// Merchant functions
export { createPaymentRequirements } from "./core/merchant";

// Wallet functions (client-side)
export { processPayment, processPaymentRequired } from "./core/wallet";

// Protocol functions (verification & settlement)
export { verifyPayment, settlePayment } from "./core/protocol";

// State management
export { x402Utils } from "./core/utils";

// Helper functions
export {
  requirePayment,
  requirePaymentChoice,
  paidService,
  smartPaidService,
  createTieredPaymentOptions,
  checkPaymentContext,
} from "./core/helpers";

// Error types
export {
  x402PaymentRequiredException,
  x402ErrorCode,
  mapErrorToCode,
} from "./types/errors";

// Optional middleware
export {
  x402BaseExecutor,
  x402ServerExecutor,
  x402ClientExecutor,
} from "./executors";
```

### B. Payment Request Flow

**Merchant Side** (via decorator):
```typescript
@requirePayment({
  price: 1.5,
  payToAddress: merchantWallet,
  resource: "/buy-product",
  network: "base-sepolia",
})
async sellProduct() {
  // ...
}
// Throws: x402PaymentRequiredException
```

**Client Side**:
```typescript
const wallet = new Wallet(privateKey);
const paymentRequired = utils.getPaymentRequirements(task);
const signedPayload = await processPayment(
  paymentRequired.accepts[0],
  wallet
);
```

**Verification & Settlement**:
```typescript
const verify = await verifyPayment(signedPayload, paymentRequired);
const settle = await settlePayment(signedPayload, paymentRequired);
```

### C. Error Handling
**File**: `/x402_a2a/types/errors.ts`
```typescript
export class x402PaymentRequiredException extends x402Error {
  public readonly paymentRequirements: PaymentRequirements[];
  public readonly errorCode?: string;

  static async forService(
    options: PaymentRequiredExceptionOptions
  ): Promise<x402PaymentRequiredException>
}
```

---

## 8. KEY CLASSES & INTERFACES

### Core Interfaces

**PaymentRequirements**
```typescript
{
  scheme: "exact";
  network: SupportedNetworks;
  asset: string;              // Token address
  payTo: string;              // Merchant address
  maxAmountRequired: string;   // Atomic units
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  extra?: { name: string; version: string };
}
```

**PaymentPayload** (Signed)
```typescript
{
  x402Version: 1;
  scheme: string;
  network: string;
  payload: {
    signature: string;        // EIP-712 signature
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
}
```

**SettleResponse**
```typescript
{
  success: boolean;
  transaction?: string;       // Tx hash
  network: string;
  payer?: string;
  errorReason?: string;
}
```

### Utility Classes

**x402Utils**
```typescript
class x402Utils {
  getPaymentStatus(task: Task): PaymentStatus | null
  getPaymentRequirements(task: Task): x402PaymentRequiredResponse | null
  getPaymentPayload(task: Task): PaymentPayload | null
  recordPaymentSuccess(task: Task, settleResponse: SettleResponse): Task
  recordPaymentFailure(task: Task, errorCode: string, settleResponse: SettleResponse): Task
}
```

---

## 9. DEPENDENCIES

**Main Dependencies** (`/x402_a2a/package.json`):
```json
{
  "dependencies": {
    "ethers": "^6.13.0",
    "adk-typescript": "^1.0.3"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

**Key Library: Ethers.js v6**
- `Wallet`: Private key management
- `JsonRpcProvider`: RPC communication
- `Contract`: ERC-20 interactions
- `signTypedData()`: EIP-712 signing

**Key Library: ADK TypeScript**
- Agent framework for orchestration
- Tool/function integration
- Task/message state management

---

## SUMMARY: WHAT NEEDS TO CHANGE FOR ALGORAND SUPPORT

### 1. **Type System Changes**
   - Expand `SupportedNetworks` to include Algorand networks
   - Remove EVM-specific fields from `EIP3009Authorization`
   - Create Algorand-specific signing structures

### 2. **Signing Mechanism Replacement**
   - Replace EIP-712 signing with Algorand transaction signing
   - Use `algosdk` instead of `ethers.js` for signing

### 3. **Network Configuration**
   - Add Algorand Mainnet and Testnet endpoints
   - Configure Algorand RPC endpoints instead of Alchemy

### 4. **Token Handling**
   - Replace USDC contract addresses with Algorand ASA IDs
   - Update token transfer logic for Algorand Standard Assets (ASAs)

### 5. **Wallet Implementation**
   - Create Algorand-compatible wallet class
   - Handle Algorand account creation and mnemonic import

### 6. **Settlement Logic**
   - Replace ERC-20 approval/transfer with Algorand ASA transactions
   - Update gas/fee logic for Algorand

### 7. **Facilitator Client**
   - Ensure facilitator supports Algorand or implement custom Algorand settlement

### 8. **RPC Provider**
   - Support Algorand node endpoints instead of EVM RPC

---
