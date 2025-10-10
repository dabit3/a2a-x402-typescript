# Docker Deployment Guide

This guide explains how to deploy the x402 Merchant Agent using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)
- A Google API key for the Gemini model

## Quick Start with Docker Compose

### 1. Set up environment variables

Create a `.env` file in the merchant-agent directory:

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

**Required variables:**
```bash
GOOGLE_API_KEY=your_actual_google_api_key_here
```

**Optional variables (with defaults):**
```bash
PORT=10000
MERCHANT_WALLET_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
PAYMENT_NETWORK=base-sepolia
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
FACILITATOR_MODE=mock
X402_DEBUG=false
```

### 2. Deploy with Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The service will be available at `http://localhost:10000`

## Manual Docker Deployment

### 1. Build the Docker image

```bash
docker build -t x402-merchant-agent:latest .
```

### 2. Run the container

```bash
docker run -d \
  --name x402-merchant-agent \
  -p 10000:10000 \
  -e GOOGLE_API_KEY="your_google_api_key" \
  -e MERCHANT_WALLET_ADDRESS="0xYourWalletAddress" \
  -e PAYMENT_NETWORK="base-sepolia" \
  -e FACILITATOR_MODE="mock" \
  x402-merchant-agent:latest
```

Or with an env file:

```bash
docker run -d \
  --name x402-merchant-agent \
  -p 10000:10000 \
  --env-file .env \
  x402-merchant-agent:latest
```

## Testing the Deployment

### Health Check

Test the health endpoint:

```bash
curl http://localhost:10000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "x402-merchant-agent",
  "timestamp": 1234567890,
  "uptime": 123.45
}
```

### Test Payment Flow

Once the container is running, test the payment flow with:

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to buy a banana"}'
```

## Docker Commands Reference

### View logs
```bash
docker logs x402-merchant-agent
docker logs -f x402-merchant-agent  # Follow logs
```

### Stop the container
```bash
docker stop x402-merchant-agent
```

### Start the container
```bash
docker start x402-merchant-agent
```

### Remove the container
```bash
docker rm x402-merchant-agent
```

### View container status
```bash
docker ps
```

### Execute commands inside the container
```bash
docker exec -it x402-merchant-agent sh
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP port for the service | `10000` | No |
| `GOOGLE_API_KEY` | Google API key for Gemini | - | Yes |
| `MERCHANT_WALLET_ADDRESS` | Merchant's wallet address | `0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B` | No |
| `PAYMENT_NETWORK` | Blockchain network | `base-sepolia` | No |
| `USDC_CONTRACT` | USDC contract address | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | No |
| `FACILITATOR_MODE` | Payment mode: `mock`, `real`, or `http` | `mock` | No |
| `MERCHANT_PRIVATE_KEY` | Private key (for `real` mode) | - | Conditional |
| `BASE_SEPOLIA_RPC_URL` | RPC URL (for `real` mode) | - | Conditional |
| `FACILITATOR_URL` | Facilitator service URL (for `http` mode) | `https://x402.org/facilitator` | No |
| `X402_DEBUG` | Enable debug logging | `false` | No |

### Port Mapping

The container exposes port `10000` by default. To use a different host port:

```bash
# Map host port 8080 to container port 10000
docker run -p 8080:10000 ...
```

Or in docker-compose.yml:
```yaml
ports:
  - "8080:10000"
```

## Production Deployment

### Using Docker Compose in Production

1. **Create a production environment file:**
   ```bash
   cp .env.example .env.production
   # Edit with production values
   ```

2. **Update docker-compose.yml to use the production file:**
   ```yaml
   env_file:
     - .env.production
   ```

3. **Deploy:**
   ```bash
   docker-compose up -d
   ```

### Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use secrets management** for sensitive data in production (e.g., Docker Secrets, AWS Secrets Manager)
3. **Keep the base image updated** - Rebuild regularly to get security patches
4. **Run as non-root user** (future enhancement)
5. **Use HTTPS** - Put behind a reverse proxy (nginx, traefik) with SSL

### Behind a Reverse Proxy

Example nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name merchant.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:10000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Health Checks

The Docker image includes a health check that runs every 30 seconds. Check the health status:

```bash
docker inspect --format='{{json .State.Health}}' x402-merchant-agent
```

## Troubleshooting

### Container won't start
1. Check logs: `docker logs x402-merchant-agent`
2. Verify environment variables are set correctly
3. Ensure port 10000 is not already in use: `lsof -i :10000`

### Build fails
1. Ensure all dependencies are in package.json
2. Check that the source code builds locally: `npm run build`
3. Clear Docker cache: `docker build --no-cache -t x402-merchant-agent:latest .`

### Cannot connect to the service
1. Verify container is running: `docker ps`
2. Check port mapping: `docker port x402-merchant-agent`
3. Test from inside container: `docker exec x402-merchant-agent wget -O- http://localhost:10000`

## Cloud Deployment Examples

### AWS ECS/Fargate

1. Push image to ECR:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_URL
   docker tag x402-merchant-agent:latest YOUR_ECR_URL/x402-merchant-agent:latest
   docker push YOUR_ECR_URL/x402-merchant-agent:latest
   ```

2. Create ECS task definition with environment variables
3. Deploy as ECS service

### Google Cloud Run

```bash
# Tag for GCR
docker tag x402-merchant-agent:latest gcr.io/YOUR_PROJECT/x402-merchant-agent:latest

# Push to GCR
docker push gcr.io/YOUR_PROJECT/x402-merchant-agent:latest

# Deploy to Cloud Run
gcloud run deploy x402-merchant-agent \
  --image gcr.io/YOUR_PROJECT/x402-merchant-agent:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars GOOGLE_API_KEY=your_key
```

### Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name x402-merchant-agent \
  --image x402-merchant-agent:latest \
  --cpu 1 \
  --memory 1 \
  --port 10000 \
  --environment-variables GOOGLE_API_KEY=your_key
```

## Monitoring

### View resource usage
```bash
docker stats x402-merchant-agent
```

### Prometheus metrics
The service doesn't currently export Prometheus metrics, but you can add monitoring by:
1. Adding a metrics library to the application
2. Exposing a `/metrics` endpoint
3. Configuring Prometheus to scrape the endpoint

## Updating

To update to a new version:

```bash
# Pull latest code
git pull

# Rebuild image
docker-compose build

# Restart service
docker-compose up -d
```

Or with manual deployment:
```bash
docker stop x402-merchant-agent
docker rm x402-merchant-agent
docker build -t x402-merchant-agent:latest .
docker run -d --name x402-merchant-agent -p 10000:10000 --env-file .env x402-merchant-agent:latest
```
