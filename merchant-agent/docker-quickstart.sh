#!/bin/bash
# Quick start script for x402 Merchant Agent Docker deployment

set -e

echo "========================================="
echo "x402 Merchant Agent - Docker Quick Start"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration:"
    echo "   - Add your GOOGLE_API_KEY"
    echo "   - Adjust other settings as needed"
    echo ""
    echo "Run this script again after editing .env"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🔨 Building Docker image..."
docker build -t x402-merchant-agent:latest .

echo ""
echo "✅ Build complete!"
echo ""
echo "Choose deployment method:"
echo "1) Docker Compose (recommended)"
echo "2) Docker run (manual)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting with Docker Compose..."
        docker-compose up -d
        echo ""
        echo "✅ Service started!"
        echo ""
        echo "View logs: docker-compose logs -f"
        echo "Stop service: docker-compose down"
        ;;
    2)
        echo ""
        echo "🚀 Starting with Docker run..."
        docker run -d \
          --name x402-merchant-agent \
          -p 10000:10000 \
          --env-file .env \
          --restart unless-stopped \
          x402-merchant-agent:latest
        echo ""
        echo "✅ Container started!"
        echo ""
        echo "View logs: docker logs -f x402-merchant-agent"
        echo "Stop container: docker stop x402-merchant-agent"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📡 Service is available at: http://localhost:10000"
echo ""
echo "Test the service with:"
echo "curl -X POST http://localhost:10000 \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"text\": \"I want to buy a banana\"}'"
echo ""
