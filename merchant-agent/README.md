# x402 Merchant Agent

A TypeScript merchant agent with x402 payment protocol integration for blockchain-based payments.

## Quick Start

### Test the Payment Flow

```bash
npm install
npm run test:payment
```

This demonstrates:
1. Product request → Payment exception thrown
2. Client signs payment with wallet
3. Facilitator verifies signature
4. Facilitator settles on-chain
5. Order confirmed

### Run as Development Server

```bash
npm run dev
```

Server runs at `http://localhost:10000` using a custom HTTP server with full x402 payment processing.

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key

# Optional (defaults shown)
PORT=10000
MERCHANT_WALLET_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Facilitator configuration (optional)
USE_MOCK_FACILITATOR=false
FACILITATOR_URL=https://x402.org/facilitator
FACILITATOR_API_KEY=your_facilitator_api_key
```

### Network Configuration

**Base Sepolia (Testnet):**
```bash
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
MERCHANT_WALLET_ADDRESS=0xYourEthereumAddress
```

**Base Mainnet:**
```bash
PAYMENT_NETWORK=base
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
MERCHANT_WALLET_ADDRESS=0xYourEthereumAddress
```

**Algorand TestNet (with NFDomains support!):**
```bash
PAYMENT_NETWORK=algorand-testnet
MERCHANT_WALLET_ADDRESS=merchant.algo  # ← Can use .algo name!
# Or use regular address:
# MERCHANT_WALLET_ADDRESS=ABC123...XYZ789
```

**Algorand MainNet:**
```bash
PAYMENT_NETWORK=algorand-mainnet
MERCHANT_WALLET_ADDRESS=merchant.algo  # ← NFDomains work automatically!
# Or use regular address:
# MERCHANT_WALLET_ADDRESS=ABC123...XYZ789
```

**Ethereum Mainnet:**
```bash
PAYMENT_NETWORK=ethereum
USDC_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

**Polygon:**
```bash
PAYMENT_NETWORK=polygon
USDC_CONTRACT=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
```

**Polygon Amoy (testnet):**
```bash
PAYMENT_NETWORK=polygon-amoy
USDC_CONTRACT=0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
```

## Production Deployment

### Running the Server

The merchant agent uses a custom HTTP server that wraps the agent with `MerchantServerExecutor` for full x402 payment processing.

**Development:**
```bash
npm install
npm run dev
```

**Production:**
```bash
npm run build
npm run start:prod
```

**Features:**
- Wraps the agent with `MerchantServerExecutor`
- Uses the default facilitator at `https://x402.org/facilitator`
- Handles payment verification and settlement automatically
- Provides HTTP API for client integration
- Maintains session state across requests

### Deployment Options

#### Docker (Recommended)

The merchant agent includes complete Docker support for easy deployment.

**Quick Start:**
```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY

# 2. Build and run with Docker Compose
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

**Or use the quick-start script:**
```bash
./docker-quickstart.sh
```

**Manual Docker build and run:**
```bash
# Build
docker build -t x402-merchant-agent:latest .

# Run
docker run -d \
  --name x402-merchant-agent \
  -p 10000:10000 \
  --env-file .env \
  x402-merchant-agent:latest
```

For detailed Docker deployment instructions, see **[DOCKER.md](./DOCKER.md)**

#### Cloud Platforms

**Google Cloud Run:**
```bash
npm run build
gcloud run deploy merchant-agent \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY
```

**AWS ECS/Fargate:**
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

**PM2 (Process Manager):**
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start dist/server.js --name merchant-agent

# View logs
pm2 logs merchant-agent

# Restart
pm2 restart merchant-agent
```

### Facilitator Service

The facilitator service handles blockchain interactions (verification and settlement).

#### Using Default Facilitator

The merchant agent uses `https://x402.org/facilitator` by default. No additional configuration needed.

#### Using Mock Facilitator (Testing)

For local testing without real blockchain transactions:

```bash
USE_MOCK_FACILITATOR=true npm run dev
```

Or modify `server.ts`:

```typescript
import { MockFacilitatorClient } from './src/facilitator/MockFacilitatorClient';

const mockFacilitator = new MockFacilitatorClient();
const paymentExecutor = new MerchantServerExecutor(
  agentAdapter as any,
  undefined,
  mockFacilitator
);
```

#### Deploying Your Own Facilitator

To deploy a custom facilitator, it must implement:

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
- Verifies EIP-712 signature and authorization details
- Returns: `{ isValid: boolean, payer?: string, invalidReason?: string }`

**Settlement API** (`POST /settle`):
- Submits transaction to blockchain
- Returns: `{ success: boolean, transaction?: string, network: string, payer?: string, errorReason?: string }`

## API Usage

### Request Product

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to buy a banana"}'
```

### Response (Payment Required)

```json
{
  "success": true,
  "taskId": "task-1234567890",
  "events": [{
    "status": {
      "state": "input-required",
      "message": {
        "metadata": {
          "x402.payment.status": "payment-required",
          "x402.payment.required": {
            "scheme": "exact",
            "network": "base-sepolia",
            "asset": "0x036CbD...",
            "payTo": "0xAb5801...",
            "maxAmountRequired": "912883"
          }
        }
      }
    }
  }]
}
```

### Submit Payment

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to buy a banana",
    "taskId": "task-1234567890",
    "message": {
      "metadata": {
        "x402.payment.status": "payment-submitted",
        "x402.payment.payload": {
          "scheme": "exact",
          "network": "base-sepolia",
          "payload": {
            "authorization": {...},
            "signature": "0x..."
          }
        }
      }
    }
  }'
```

## Architecture

```
┌─────────────┐
│   Client    │ 1. Request product
│ (with wallet)│ 2. Receive payment requirements
└──────┬──────┘ 3. Sign & submit payment
       │
       ▼
┌─────────────────────┐
│  Merchant Agent     │
│  ┌───────────────┐  │
│  │ x402 Executor │  │ Verifies payment
│  └───────┬───────┘  │ Settles on-chain
│          │          │
│  ┌───────▼───────┐  │
│  │ Facilitator   │  │
│  │   Client      │  │
│  └───────────────┘  │
└─────────────────────┘
```

## Features

- 🛒 Dynamic pricing based on product names
- 💰 x402 payment protocol with exceptions
- ✅ Automatic payment verification
- 🔐 On-chain USDC settlement (Base Sepolia)
- 🚀 Default facilitator at `https://x402.org/facilitator`

## Payment Flow

The complete payment flow involves these steps:

### Step 1: Product Request

Client sends product request:

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to buy a banana"}'
```

### Step 2: Payment Required Response

Server responds with payment requirements in metadata:

```json
{
  "metadata": {
    "x402.payment.status": "payment-required",
    "x402.payment.required": {
      "x402Version": 1,
      "accepts": [{
        "scheme": "exact",
        "network": "base-sepolia",
        "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "payTo": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
        "maxAmountRequired": "912883",
        "maxTimeoutSeconds": 1200,
        "description": "Payment for: banana",
        "resource": "https://example.com/product/banana",
        "mimeType": "application/json"
      }]
    }
  }
}
```

### Step 3: Client Signs Payment

Client uses wallet to sign payment (see `client-agent` implementation).

### Step 4: Payment Submission

Client submits signed payment with same `taskId`:

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to buy a banana",
    "taskId": "same-task-id-from-step-1",
    "message": {
      "metadata": {
        "x402.payment.status": "payment-submitted",
        "x402.payment.payload": {
          "x402Version": 1,
          "scheme": "exact",
          "network": "base-sepolia",
          "payload": {
            "authorization": {...},
            "signature": "0x..."
          }
        }
      }
    }
  }'
```

### Step 5: Verification & Settlement

Server automatically:
1. Calls `verifyPayment()` → Facilitator verifies signature
2. Calls `settlePayment()` → Facilitator settles on-chain
3. Returns order confirmation

## Monitoring

### Health Check

Add to your server:

```typescript
if (req.url === '/health') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  return;
}
```

### Key Metrics to Monitor

- **Payment success rate**: % of payments that verify and settle successfully
- **Payment failures**: Track reasons for verification/settlement failures
- **Response time**: Time from payment submission to settlement
- **Transaction fees**: Monitor blockchain gas costs
- **Revenue**: Track total payments received

### Logging

The agent logs important events:
- `🛒 Product Request` - New product request
- `💳 Payment required` - Payment exception thrown
- `✅ Payment Verified Successfully` - Verification passed
- `✅ Payment Settled Successfully` - Settlement completed
- `⛔ Payment Verification Failed` - Verification error
- `⛔ Payment Settlement Failed` - Settlement error

For production, integrate with:
- **Winston**: Structured logging
- **Datadog**: Application monitoring
- **Sentry**: Error tracking

## Security

### Best Practices

- **API Keys**: Store `GOOGLE_API_KEY` and `FACILITATOR_API_KEY` securely (use secret management)
- **Network Security**: Use HTTPS for facilitator communication
- **Wallet Security**: Merchant wallet address should be stored in secure cold storage
- **Rate Limiting**: Implement rate limiting on your agent endpoints to prevent abuse
- **Environment Variables**: Never commit `.env` file to version control
- **API Authentication**: Add API key validation in production
- **HTTPS**: Always use HTTPS in production (handled by cloud platforms)

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `HTTP 401: Unauthorized` | Invalid facilitator API key | Check `FACILITATOR_API_KEY` |
| `HTTP 503: Service Unavailable` | Facilitator down | Implement retry logic |
| `InvalidReason: insufficient_funds` | Payer has insufficient balance | Return clear error to user |
| `InvalidReason: invalid_signature` | Signature verification failed | Check EIP-712 domain matches |
| `Network error` | Network connectivity issue | Check facilitator URL and firewall |

### Server Won't Start

```bash
# Check port availability
lsof -i :10000

# Kill existing process
kill -9 $(lsof -t -i:10000)
```

### Payment Verification Fails

**Check:**
1. Facilitator is reachable: `curl https://x402.org/facilitator/health`
2. Network configuration matches (base-sepolia vs base)
3. USDC contract address is correct for the network
4. Facilitator API key is valid

### Settlement Fails but Verification Succeeds

**Check:**
1. Facilitator has sufficient funds/gas
2. Blockchain network is operational
3. Transaction timeout settings
4. Gas price configuration

### Agent Errors

- Verify `GOOGLE_API_KEY` is set correctly
- Check Gemini API quota/limits
- Review agent logs for detailed errors

## Testing in Production

### Smoke Test

Test with a small transaction on testnet:

```bash
# Use Base Sepolia testnet
export PAYMENT_NETWORK=base-sepolia
export USE_MOCK_FACILITATOR=false

npm run test:payment
```

Expected output:
```
✅ ===== Payment Flow Test PASSED! =====
   🎉 Order has been confirmed!
   📦 Product will be shipped soon!
```

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 -p request.json -T application/json http://localhost:10000/
```

## License

Apache-2.0
