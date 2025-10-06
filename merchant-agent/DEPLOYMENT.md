# x402 Merchant Agent - Production Deployment Guide

## Overview

This guide covers deploying the x402-enabled merchant agent to production. The agent accepts payments using the x402 payment protocol with blockchain-based settlement.

## Prerequisites

- Node.js 18+ installed
- Google API key (for Gemini model)
- Access to a facilitator service OR ability to deploy your own
- Wallet address for receiving payments
- Base Sepolia testnet setup (or other supported network)

## Architecture

```
┌─────────────────┐
│  Client Agent   │
│   (with wallet) │
└────────┬────────┘
         │
         │ 1. Request product
         │ 2. Receive payment requirements
         │ 3. Sign & submit payment
         │
         ▼
┌─────────────────────────────┐
│   Merchant Agent Server     │
│  ┌──────────────────────┐   │
│  │ MerchantServerExecutor│  │
│  │  (x402ServerExecutor) │  │
│  └──────────┬───────────┘   │
│             │                │
│  ┌──────────▼───────────┐   │
│  │  FacilitatorClient   │   │
│  │  (verify & settle)   │   │
│  └──────────────────────┘   │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────┐
│  Facilitator Service │
│  (blockchain bridge) │
└──────────────────────┘
```

## Configuration

### 1. Environment Variables

Create a `.env` file:

```bash
# Required: Google API key for Gemini model
GOOGLE_API_KEY=your_api_key_here

# Merchant wallet address (receives payments)
MERCHANT_WALLET_ADDRESS=0xYourWalletAddress

# Payment network (base-sepolia, base, ethereum, polygon, etc.)
PAYMENT_NETWORK=base-sepolia

# USDC contract address on your network
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Facilitator mode: true = use mock (testing), false = use production
USE_MOCK_FACILITATOR=false

# Production facilitator configuration
FACILITATOR_URL=https://your-facilitator-service.com
FACILITATOR_API_KEY=your_facilitator_api_key
```

### 2. Network-Specific Configuration

#### Base Sepolia (Testnet)
```bash
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

#### Base Mainnet
```bash
PAYMENT_NETWORK=base
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

#### Ethereum Mainnet
```bash
PAYMENT_NETWORK=ethereum
USDC_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

## Installation

### 1. Install Dependencies

```bash
cd typescript/merchant-agent
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Verify Installation

Run the payment flow test:

```bash
npm run test:payment
```

Expected output:
```
✅ ===== Payment Flow Test PASSED! =====
   🎉 Order has been confirmed!
   📦 Product will be shipped soon!
```

## Running the Agent

### Development Mode (Mock Facilitator)

For testing without real blockchain transactions:

```bash
# Uses mock facilitator by default
npm run dev
```

### Production Mode (Real Facilitator)

For production with actual blockchain settlement:

```bash
# Set environment variables
export USE_MOCK_FACILITATOR=false
export FACILITATOR_URL=https://your-facilitator-service.com
export FACILITATOR_API_KEY=your_api_key

# Start agent
npm run dev
```

## Facilitator Service

The facilitator service handles blockchain interactions (verification and settlement).

### Option 1: Use Hosted Facilitator

Contact the x402 team or your payment provider for:
- Facilitator URL
- API key
- Supported networks

### Option 2: Deploy Your Own Facilitator

The facilitator must implement the `FacilitatorClient` interface:

```typescript
interface FacilitatorClient {
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;
}
```

**Verification API** (`POST /verify`):
- Input: `{ payload: PaymentPayload, requirements: PaymentRequirements }`
- Output: `{ isValid: boolean, payer?: string, invalidReason?: string }`
- Verifies EIP-712 signature and authorization details

**Settlement API** (`POST /settle`):
- Input: `{ payload: PaymentPayload, requirements: PaymentRequirements }`
- Output: `{ success: boolean, transaction?: string, network: string, payer?: string, errorReason?: string }`
- Submits transaction to blockchain and returns transaction hash

## Production Deployment

### 1. Security Considerations

- **API Keys**: Store `GOOGLE_API_KEY` and `FACILITATOR_API_KEY` securely (use secret management)
- **Network Security**: Use HTTPS for facilitator communication
- **Wallet Security**: Merchant wallet address should be stored in secure cold storage
- **Rate Limiting**: Implement rate limiting on your agent endpoints
- **Monitoring**: Set up logging and monitoring for payment failures

### 2. Cloud Deployment Options

#### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

Build and run:
```bash
docker build -t merchant-agent .
docker run -p 3000:3000 --env-file .env merchant-agent
```

#### Cloud Platforms

**Google Cloud Run:**
```bash
gcloud run deploy merchant-agent \
  --source . \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY \
  --set-env-vars USE_MOCK_FACILITATOR=false
```

**AWS ECS / Fargate:**
- Build Docker image
- Push to ECR
- Create ECS task with environment variables
- Deploy to Fargate cluster

**Heroku:**
```bash
heroku create merchant-agent
heroku config:set GOOGLE_API_KEY=$GOOGLE_API_KEY
git push heroku main
```

### 3. Scaling Considerations

- **Stateless Design**: The executor is stateless and can scale horizontally
- **Database**: For persistent order tracking, add a database layer
- **Caching**: Cache product prices and payment requirements
- **Load Balancing**: Use load balancer for multiple instances

## Testing in Production

### 1. Smoke Test

Test with a small transaction on testnet:

```bash
# Use Base Sepolia testnet
export PAYMENT_NETWORK=base-sepolia
export USE_MOCK_FACILITATOR=false

npm run test:payment
```

### 2. Integration Test

Have a client agent interact with your deployed merchant:

```typescript
// Client-side code
import { Wallet } from 'ethers';
import { processPayment } from 'x402-a2a-typescript';

// 1. Request product from merchant
const response = await fetch('https://your-merchant-agent.com/task', {
  method: 'POST',
  body: JSON.stringify({ message: 'I want to buy a banana' })
});

// 2. Extract payment requirements from 402 response
const requirements = extractPaymentRequirements(response);

// 3. Sign payment with wallet
const wallet = new Wallet(process.env.PRIVATE_KEY);
const paymentPayload = await processPayment(requirements, wallet);

// 4. Submit payment to merchant
await fetch('https://your-merchant-agent.com/task', {
  method: 'POST',
  body: JSON.stringify({ payment: paymentPayload })
});

// 5. Receive order confirmation
```

## Monitoring and Observability

### Key Metrics to Monitor

- **Payment Success Rate**: % of payments that verify and settle successfully
- **Payment Failures**: Track reasons for verification/settlement failures
- **Response Time**: Time from payment submission to settlement
- **Transaction Fees**: Monitor blockchain gas costs
- **Revenue**: Track total payments received

### Logging

The agent logs important events:
- `🛒 Product Request` - New product request
- `💳 Payment required` - Payment exception thrown
- `✅ Payment Verified Successfully` - Verification passed
- `✅ Payment Settled Successfully` - Settlement completed
- `⛔ Payment Verification Failed` - Verification error
- `⛔ Payment Settlement Failed` - Settlement error

### Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `HTTP 401: Unauthorized` | Invalid facilitator API key | Check `FACILITATOR_API_KEY` |
| `HTTP 503: Service Unavailable` | Facilitator down | Implement retry logic |
| `InvalidReason: insufficient_funds` | Payer has insufficient balance | Return clear error to user |
| `InvalidReason: invalid_signature` | Signature verification failed | Check EIP-712 domain matches |
| `Network error` | Network connectivity issue | Check facilitator URL and firewall |

## Troubleshooting

### Issue: Payment verification always fails

**Check:**
1. Facilitator URL is correct and accessible
2. Network configuration matches (base-sepolia vs base)
3. USDC contract address is correct for the network
4. Facilitator API key is valid

### Issue: Settlement fails but verification succeeds

**Check:**
1. Facilitator has sufficient funds/gas
2. Blockchain network is operational
3. Transaction timeout settings
4. Gas price configuration

### Issue: Client can't connect to agent

**Check:**
1. Agent is running and accessible
2. Firewall rules allow inbound connections
3. ADK server is properly configured
4. Extension activation headers present

## Support and Resources

- **x402 Protocol**: https://github.com/google-a2a/a2a-x402
- **ADK Documentation**: https://adk.anthropic.com
- **x402-a2a-typescript Library**: `typescript/x402_a2a/`
- **Issue Tracker**: Create issues in your repository

## Next Steps

1. ✅ Deploy to staging environment
2. ✅ Test with real facilitator on testnet
3. ✅ Run integration tests
4. ✅ Set up monitoring and alerting
5. ✅ Deploy to production
6. ✅ Monitor payment flows
7. ✅ Scale as needed

---

**Production Checklist:**

- [ ] Environment variables configured
- [ ] Facilitator service set up and tested
- [ ] Merchant wallet address secured
- [ ] Network configuration verified (mainnet vs testnet)
- [ ] Payment flow test passes
- [ ] Docker image built (if using containers)
- [ ] Monitoring and logging configured
- [ ] Error handling tested
- [ ] Security review completed
- [ ] Load testing performed
- [ ] Backup and recovery plan in place
- [ ] Documentation updated
