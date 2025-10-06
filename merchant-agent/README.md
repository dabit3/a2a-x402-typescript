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

Server runs at `http://localhost:10000` using ADK's built-in API server.

## Production Deployment

### Configuration

Create a `.env` file:

```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key

# Optional (defaults shown)
PORT=10000
MERCHANT_WALLET_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Deployment Options

#### Using ADK (Recommended)

```bash
npm run build
adk api_server --port 10000 --agent-dir ./dist
```

#### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
COPY .env .env
EXPOSE 10000
CMD ["node", "dist/server.js"]
```

```bash
docker build -t merchant-agent .
docker run -p 10000:10000 merchant-agent
```

#### Cloud Platforms

**Google Cloud Run:**
```bash
gcloud run deploy merchant-agent \
  --source . \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY
```

**PM2:**
```bash
pm2 start dist/server.js --name merchant-agent
```

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

## Network Configuration

**Base Mainnet:**
```bash
PAYMENT_NETWORK=base
USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Ethereum Mainnet:**
```bash
PAYMENT_NETWORK=ethereum
USDC_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

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

### Key Metrics

- Payment success rate
- Verification/settlement failures
- Response time
- Transaction fees

## Security

- Store API keys in secret management
- Use HTTPS in production
- Implement rate limiting
- Keep merchant wallet secure
- Never commit `.env` files

## Troubleshooting

**Server won't start:**
```bash
lsof -i :10000
kill -9 $(lsof -t -i:10000)
```

**Payment verification fails:**
- Check facilitator is reachable: `curl https://x402.org/facilitator/health`
- Verify network configuration matches
- Confirm USDC contract address is correct

**Agent errors:**
- Verify `GOOGLE_API_KEY` is set
- Check Gemini API quota/limits
- Review agent logs

## License

Apache-2.0
