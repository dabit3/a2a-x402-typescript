# Production Deployment Guide

This guide explains how to run the x402 Merchant Agent in production with full payment processing.

## Two Production Approaches

### Option A: ADK API Server (Recommended for Getting Started)

The simplest way to run the merchant agent is using ADK's built-in API server:

```bash
npm install
npm run dev
```

**Advantages:**
- ✅ Zero configuration required
- ✅ Built-in API server
- ✅ Auto-reload on file changes
- ✅ Works immediately

**Limitations:**
- ⚠️ Payment executor wrapper needs manual integration
- ⚠️ Requires ADK CLI tooling

**Production use:**
```bash
npm run build
adk api_server --port 10000 --agent-dir ./dist
```

### Option B: Custom HTTP Server with Executor (Advanced)

For full x402 payment processing with automatic verification and settlement, use the custom server:

**Status:** 🚧 In Development

The custom server (`server.ts`) is designed to:
- ✅ Wrap the agent with `MerchantServerExecutor`
- ✅ Use the default facilitator (`https://x402.org/facilitator`)
- ✅ Handle payment verification and settlement automatically
- ✅ Provide HTTP API for client integration

**Current limitation:** ADK agent invocation in custom server context requires additional integration work.

**When complete:**
```bash
npm run start        # Development
npm run start:prod   # Production
```

## Quick Start (Using ADK Server)

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional (with defaults shown)
PORT=10000
MERCHANT_WALLET_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Custom Facilitator (Optional)

To use a custom facilitator instead of the default, modify `server.ts`:

```typescript
import { MockFacilitatorClient } from './src/facilitator/MockFacilitatorClient';

// Use mock facilitator for testing
const mockFacilitator = new MockFacilitatorClient();
const paymentExecutor = new MerchantServerExecutor(
  agentAdapter as any,
  undefined,
  mockFacilitator
);
```

## API Usage

### Request Format

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to buy a banana",
    "taskId": "optional-task-id",
    "contextId": "optional-context-id"
  }'
```

### Response Format

```json
{
  "success": true,
  "taskId": "task-1234567890",
  "events": [
    {
      "id": "task-1234567890",
      "status": {
        "state": "input-required",
        "message": {
          "messageId": "msg-xxx",
          "role": "agent",
          "parts": [...],
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
      }
    }
  ]
}
```

## Payment Flow

### Step 1: Product Request

Client sends product request:

```json
{
  "text": "I want to buy a banana"
}
```

### Step 2: Payment Required Response

Server responds with payment requirements in metadata:

```json
{
  "metadata": {
    "x402.payment.status": "payment-required",
    "x402.payment.required": { ... }
  }
}
```

### Step 3: Client Signs Payment

Client uses wallet to sign payment (see client-agent implementation).

### Step 4: Payment Submission

Client submits signed payment:

```json
{
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
          "authorization": { ... },
          "signature": "0x..."
        }
      }
    }
  }
}
```

### Step 5: Verification & Settlement

Server automatically:
1. Calls `verifyPayment()` → Facilitator verifies signature
2. Calls `settlePayment()` → Facilitator settles on-chain
3. Returns order confirmation

## Deployment Options

### Option 1: Node.js Server

```bash
# Install PM2 for process management
npm install -g pm2

# Start server
pm2 start dist/server.js --name merchant-agent

# View logs
pm2 logs merchant-agent

# Restart
pm2 restart merchant-agent
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY .env.example .env

EXPOSE 10000

CMD ["node", "dist/server.js"]
```

Build and run:

```bash
docker build -t merchant-agent .
docker run -p 10000:10000 --env-file .env merchant-agent
```

### Option 3: Cloud Platform

#### Google Cloud Run

```bash
# Build
npm run build

# Deploy
gcloud run deploy merchant-agent \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY
```

#### AWS Lambda

Use AWS Lambda with API Gateway. The server needs minor modifications for Lambda handler format.

#### Vercel/Railway/Fly.io

All support Node.js deployments. Use `npm run start:prod` as the start command.

## Monitoring

### Health Check

Add to `server.ts`:

```typescript
if (req.url === '/health') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  return;
}
```

### Logging

The server logs all payment events to console. For production, integrate with:
- **Winston**: Structured logging
- **Datadog**: Application monitoring
- **Sentry**: Error tracking

## Security Considerations

1. **API Authentication**: Add API key validation in production
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **HTTPS**: Always use HTTPS in production (handled by cloud platforms)
4. **Wallet Security**: Keep merchant wallet private key secure
5. **Environment Variables**: Never commit `.env` file

## Testing in Production

### Test Payment Flow

```bash
# 1. Start server
npm run start

# 2. Request product
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to buy a banana"}' \
  | jq '.events[0].status.message.metadata."x402.payment.required"'

# 3. Use client-agent to complete payment
# (See client-agent documentation)
```

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 -p request.json -T application/json http://localhost:10000/
```

## Troubleshooting

### Server Won't Start

```bash
# Check port availability
lsof -i :10000

# Kill existing process
kill -9 $(lsof -t -i:10000)
```

### Payment Verification Fails

- Check facilitator is reachable: `curl https://x402.org/facilitator/health`
- Verify network connectivity
- Check wallet has sufficient balance

### Agent Errors

- Ensure `GOOGLE_API_KEY` is set correctly
- Check Gemini API quota/limits
- Review agent logs for detailed errors

## Performance Optimization

1. **Connection Pooling**: Reuse HTTP connections to facilitator
2. **Caching**: Cache product prices if deterministic
3. **Horizontal Scaling**: Run multiple instances behind load balancer
4. **Database**: Add Redis for payment state if scaling beyond single instance

## Support

- **x402_a2a Library**: `../x402_a2a/README.md`
- **Test Script**: `npm run test:payment` for local testing
- **Issues**: Check agent and facilitator logs

## License

Apache-2.0
