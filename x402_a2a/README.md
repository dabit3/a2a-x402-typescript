# x402 A2A Payment Protocol Extension (TypeScript)

This package provides a complete TypeScript implementation of the x402 payment protocol extension for A2A using an **exception-based approach** for dynamic payment requirements.

This is the TypeScript port of the Python `x402_a2a` library.

## Installation

```bash
npm install x402-a2a-typescript
```

## Quick Start

### Server-Side (Merchant Agent)

```typescript
import { x402PaymentRequiredException } from 'x402-a2a-typescript';

// In your agent logic, throw an exception to request payment:
throw x402PaymentRequiredException.forService({
  price: "$5.00",
  payToAddress: "0x123...",
  resource: "/premium-feature"
});
```

### Client-Side (Wallet/Signing)

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

### Using the Default Facilitator

The library now includes a default facilitator that connects to `https://x402.org/facilitator` (matching Python behavior):

```typescript
import { verifyPayment, settlePayment } from 'x402-a2a-typescript';

// Uses default facilitator automatically
const verifyResult = await verifyPayment(paymentPayload, requirements);
const settleResult = await settlePayment(paymentPayload, requirements);
```

To use a custom facilitator:

```typescript
import { DefaultFacilitatorClient } from 'x402-a2a-typescript';

// Custom facilitator URL
const facilitator = new DefaultFacilitatorClient({
  url: 'https://your-facilitator.com',
  apiKey: 'optional-api-key'
});

const verifyResult = await verifyPayment(paymentPayload, requirements, facilitator);
```

## Architecture

The package follows a "functional core, imperative shell" architecture:

- **types/**: Protocol data structures (config, errors, state)
- **core/**: Protocol implementation (merchant, wallet, protocol, utils)
- **executors/**: Optional middleware for common integration patterns

## Features

- 🚀 Exception-based payment requirements
- 💰 Dynamic pricing based on request parameters
- 🔒 Type-safe TypeScript implementation
- 🎯 ADK-compatible executors
- 📦 Zero configuration required
- 🌐 Default facilitator client (https://x402.org/facilitator)

## Advanced: Implementing Custom Facilitators

The library defines a `FacilitatorClient` interface that you can implement for custom payment processing:

```typescript
import {
  FacilitatorClient,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse
} from 'x402-a2a-typescript';

export class MyCustomFacilitator implements FacilitatorClient {
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    // Your verification logic here
    // - Validate signatures
    // - Check balances
    // - Verify authorization

    return {
      isValid: true,
      payer: '0x...',
    };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    // Your settlement logic here
    // - Execute blockchain transaction
    // - Transfer tokens
    // - Update records

    return {
      success: true,
      transaction: '0x...',
      network: requirements.network,
      payer: '0x...',
    };
  }
}
```

### Using Custom Facilitators with Executors

When implementing a merchant agent with the `x402ServerExecutor`, you can provide your custom facilitator:

```typescript
import { x402ServerExecutor, verifyPayment, settlePayment } from 'x402-a2a-typescript';

export class MerchantServerExecutor extends x402ServerExecutor {
  private facilitator?: FacilitatorClient;

  constructor(delegate: AgentExecutor, config?: x402ExtensionConfig, facilitator?: FacilitatorClient) {
    super(delegate, config);
    this.facilitator = facilitator;
  }

  async verifyPayment(payload: PaymentPayload, requirements: PaymentRequirements) {
    // Uses custom facilitator if provided, otherwise uses default
    return verifyPayment(payload, requirements, this.facilitator);
  }

  async settlePayment(payload: PaymentPayload, requirements: PaymentRequirements) {
    return settlePayment(payload, requirements, this.facilitator);
  }
}
```

### Example: Mock Facilitator for Testing

```typescript
export class MockFacilitatorClient implements FacilitatorClient {
  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    console.log('Mock: Payment verification always succeeds');
    return {
      isValid: true,
      payer: payload.payload.authorization.from,
    };
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Mock: Generated fake transaction ${mockTxHash}`);

    return {
      success: true,
      transaction: mockTxHash,
      network: requirements.network,
      payer: payload.payload.authorization.from,
    };
  }
}
```

## Configuration

### Debug Logging

The library includes a configurable logger that can be controlled via environment variable:

```bash
# Enable detailed x402 protocol logs
X402_DEBUG=true npm run dev

# Or in your .env file
X402_DEBUG=true
```

When enabled, you'll see detailed logs for:
- Payment requirement creation
- Payment verification steps
- Settlement processing
- Payment status transitions

**Note:** Error logs are always shown regardless of the `X402_DEBUG` setting.

## Documentation

See the [main README](../../../python/x402_a2a/README.md) for detailed protocol documentation.

## License

Apache-2.0
