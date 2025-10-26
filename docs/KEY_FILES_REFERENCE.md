# Key Files Reference - a2a-x402 Codebase

Complete map of blockchain-specific code locations for Algorand conversion.

## Core Library Files (Most Critical for Conversion)

### Type Definitions & Configuration

1. **Network Type Definitions**
   - Path: `/x402_a2a/types/state.ts`
   - Lines: 38
   - Defines: `SupportedNetworks` type
   - Change: Add "algorand-mainnet", "algorand-testnet"
   - Also defines: `EIP3009Authorization`, `EIP712Domain`

2. **Configuration Constants**
   - Path: `/x402_a2a/types/config.ts`
   - Lines: 18-51
   - Defines: `X402_EXTENSION_URI`, `TokenAmount`, `Price`, `x402ExtensionConfig`
   - Change: Will be handled by price processing

3. **Error Types**
   - Path: `/x402_a2a/types/errors.ts`
   - Lines: All (~143 lines)
   - Defines: Error classes and `x402PaymentRequiredException`
   - Change: No direct changes needed (blockchain-agnostic)

### Core Payment Logic

4. **Payment Signing (CRITICAL)**
   - Path: `/x402_a2a/core/wallet.ts`
   - Lines: 82-158 - `processPayment()` function
   - Lines: 163-179 - `getChainId()` function
   - Lines: 58-62 - `generateNonce()` function
   - Requires: Complete rewrite for Algorand signing
   - Current: Uses `ethers.Wallet.signTypedData()` for EIP-712
   - Needed: Algorand transaction signing

5. **Payment Requirements Creation**
   - Path: `/x402_a2a/core/merchant.ts`
   - Lines: 63-69 - USDC_ADDRESSES mapping
   - Lines: 58-107 - `processPriceToAtomicAmount()` function
   - Requires: Update token references (USDC ASA IDs)
   - Key change: Replace hex addresses with numeric ASA IDs

6. **Protocol Verification & Settlement**
   - Path: `/x402_a2a/core/protocol.ts`
   - Lines: 31-39 - `verifyPayment()` function
   - Lines: 45-66 - `settlePayment()` function
   - Requires: Minimal changes (delegates to FacilitatorClient)
   - Delegates to: `DefaultFacilitatorClient`

7. **Facilitator Client**
   - Path: `/x402_a2a/core/facilitator.ts`
   - Lines: 33-88 - `verify()` method
   - Lines: 90-132 - `settle()` method
   - Requires: Support for Algorand payload format
   - Current: Posts to x402.org/facilitator

### Utility Functions

8. **State Management Utilities**
   - Path: `/x402_a2a/core/utils.ts`
   - Class: `x402Utils`
   - Lines: 72-347
   - Methods: `getPaymentStatus()`, `recordPaymentSuccess()`, `recordPaymentFailure()`
   - Impact: No direct changes needed

9. **Helper Functions & Decorators**
   - Path: `/x402_a2a/core/helpers.ts`
   - Lines: 29-124 - `requirePayment()`, `paidService()`, `createTieredPaymentOptions()`
   - Impact: No direct changes needed

### Executors

10. **Base Executor Class**
    - Path: `/x402_a2a/executors/base.ts`
    - Lines: 27-48
    - Class: `x402BaseExecutor`
    - Change: No direct changes needed

---

## Example Implementation Files (Secondary Priority)

### Client Agent

11. **Client Wallet Implementation** (IMPORTANT)
    - Path: `/client-agent/src/wallet/Wallet.ts`
    - Lines: 44-243
    - Classes: `LocalWallet` extends `Wallet`
    - Methods:
      - `ensureApproval()` (Lines 72-124) - Token approval (ERC-20 specific)
      - `executePayment()` (Lines 184-235) - Token transfer (ERC-20 specific)
    - Requires: Create `AlgorandWallet` class alongside `LocalWallet`
    - Requires: Rewrite token execution for ASA transfers

12. **Client Agent Main**
    - Path: `/client-agent/agent.ts`
    - Lines: 86-203 - `sendMessageToMerchant()` function
    - Lines: 208-319 - `confirmPayment()` function
    - Impact: Mostly unchanged, uses wallet abstraction

13. **Environment Configuration**
    - Path: `/client-agent/.env.example`
    - Variables: `WALLET_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`, `MERCHANT_AGENT_URL`
    - Requires: Add Algorand equivalents

### Merchant Agent

14. **Merchant Agent Implementation**
    - Path: `/merchant-agent/agent.ts`
    - Impact: Minimal changes, mostly uses library functions

15. **Server Implementation**
    - Path: `/merchant-agent/server.ts`
    - Impact: Minimal changes, mostly uses library functions

16. **Merchant Executor**
    - Path: `/merchant-agent/src/executor/MerchantServerExecutor.ts`
    - Impact: May need Algorand awareness for verification

17. **Facilitator Implementations**
    - Path: `/merchant-agent/src/facilitator/ProductionFacilitatorClient.ts`
    - Path: `/merchant-agent/src/facilitator/MockFacilitatorClient.ts`
    - Impact: May need Algorand support

---

## File Dependency Map

```
User Code (agents)
    ↓
/x402_a2a/index.ts (main exports)
    ├→ /x402_a2a/core/wallet.ts ← CRITICAL: processPayment()
    │   └→ uses getChainId() ← CRITICAL: Replace with Algorand params
    │
    ├→ /x402_a2a/core/merchant.ts ← IMPORTANT: USDC addresses
    │   └→ uses processPriceToAtomicAmount()
    │
    ├→ /x402_a2a/core/protocol.ts ← SECONDARY: Delegates to facilitator
    │   └→ /x402_a2a/core/facilitator.ts ← IMPORTANT: Handle Algorand payload
    │
    ├→ /x402_a2a/core/utils.ts ← MINIMAL CHANGES
    │
    ├→ /x402_a2a/types/state.ts ← CRITICAL: Add Algorand types
    │
    └→ /x402_a2a/types/errors.ts ← MINIMAL CHANGES

/client-agent/src/wallet/Wallet.ts ← CRITICAL: Create AlgorandWallet
    └→ Implements abstract Wallet class
```

---

## Summary of Changes by Category

### Must Change (Critical Path)
1. `/x402_a2a/types/state.ts` - Add Algorand network types
2. `/x402_a2a/core/wallet.ts` - Replace EIP-712 signing with Algorand signing
3. `/x402_a2a/core/merchant.ts` - Update token references to ASA IDs
4. `/client-agent/src/wallet/Wallet.ts` - Create AlgorandWallet class
5. `/x402_a2a/core/facilitator.ts` - Support Algorand payload verification

### Should Change (Important)
6. `/x402_a2a/types/config.ts` - Add Algorand configuration
7. `/client-agent/agent.ts` - Update to support Algorand agents
8. Environment files - Add Algorand-specific variables
9. `/x402_a2a/core/protocol.ts` - Minimal: may need chainType awareness

### Can Keep (Minimal Impact)
10. `/x402_a2a/core/utils.ts` - State management (blockchain-agnostic)
11. `/x402_a2a/core/helpers.ts` - Decorator logic (blockchain-agnostic)
12. `/x402_a2a/executors/` - Base classes (blockchain-agnostic)
13. `/x402_a2a/types/errors.ts` - Error classes (blockchain-agnostic)

---

## Quick Reference: Key Functions to Change

| Function | File | Lines | Current Tech | Needed Change |
|----------|------|-------|--------------|---------------|
| `processPayment()` | `/x402_a2a/core/wallet.ts` | 82-158 | EIP-712 signing | Algorand transaction signing |
| `getChainId()` | `/x402_a2a/core/wallet.ts` | 163-179 | Chain ID lookup | Network params lookup |
| `processPriceToAtomicAmount()` | `/x402_a2a/core/merchant.ts` | 58-107 | Token addresses | ASA IDs |
| `ensureApproval()` | `/client-agent/src/wallet/Wallet.ts` | 72-124 | ERC-20 approve | Remove (not needed) |
| `executePayment()` | `/client-agent/src/wallet/Wallet.ts` | 184-235 | ERC-20 transfer | ASA transfer |
| `verify()` | `/x402_a2a/core/facilitator.ts` | 51-88 | EVM signature verify | Algorand signature verify |
| `settle()` | `/x402_a2a/core/facilitator.ts` | 90-132 | Submit to facilitator | Submit to facilitator |

---

## Testing Files

Key files for implementing tests:

- `/merchant-agent/src/test-payment-flow.ts` - Integration test template
- `/merchant-agent/test-direct.ts` - Direct payment flow test

---

## Build & Configuration Files

- `/x402_a2a/package.json` - Add algosdk dependency
- `/client-agent/package.json` - Add algosdk dependency
- `/merchant-agent/package.json` - Add algosdk dependency

---

## Documentation Files Created

These analysis documents provide detailed conversion guidance:

1. `/CODEBASE_ANALYSIS_FOR_ALGORAND.md` - Complete codebase overview
2. `/ALGORAND_CONVERSION_GUIDE.md` - Step-by-step conversion instructions
3. `/KEY_FILES_REFERENCE.md` - This file

