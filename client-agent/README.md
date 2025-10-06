# x402 Client Agent

An orchestrator agent that can interact with merchant agents and handle x402 payment flows using cryptocurrency.

## Features

- 🤖 Connects to merchant agents
- 💰 Payment handling with user confirmation
- 🔐 Secure wallet integration
- ⛓️ USDC payments on Base Sepolia
- ✅ Transparent payment flow

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit with your values:

```bash
GOOGLE_API_KEY=your_gemini_api_key
WALLET_PRIVATE_KEY=0xYourClientPrivateKey
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 3. Fund Your Wallet

Get testnet tokens:
- **ETH** (gas): https://www.alchemy.com/faucets/base-sepolia
- **USDC** (payments): https://faucet.circle.com/

### 4. Start the Agent

```bash
npm run dev
```

## Example Interaction

```
You: I want to buy a banana

Agent: The merchant is requesting payment of 1.00 USDC for a banana.
       Do you want to proceed with the payment?

You: yes

Agent: ✅ Payment completed successfully!
       Transaction: 0x1234...

       View on BaseScan: https://sepolia.basescan.org/tx/0x1234...
```

## How It Works

1. **Request product** → Agent contacts merchant
2. **Receive payment requirements** → Merchant responds with USDC amount
3. **User confirmation** → Agent shows payment details and asks to proceed
4. **Approve tokens** → Wallet approves USDC spending (client pays gas)
5. **Transfer payment** → Wallet transfers USDC to merchant (client pays gas)
6. **Order confirmed** → User receives confirmation

## Security

⚠️ **Private Key**: Your `WALLET_PRIVATE_KEY` can spend tokens!

- Never commit `.env` to git
- Use separate wallets for testnet vs mainnet
- Consider hardware wallet for production

**Approval Buffer**: The wallet approves 10% extra to minimize transactions:
```typescript
// If merchant requests 100 USDC, approve 110 USDC
const approvalAmount = (amount * 110n) / 100n;
```

**Revoke approval**:
```typescript
await usdcContract.approve(merchantAddress, 0);
```

## Network Configuration

**Base Sepolia (Testnet)**
- RPC: `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Chain ID: 84532

**Base (Mainnet)**
- RPC: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Chain ID: 8453

## Troubleshooting

**Insufficient balance**
- Fund wallet with USDC: https://faucet.circle.com/
- Check balance: Your wallet address is shown when agent starts

**Insufficient allowance**
- Wallet auto-approves. If it fails, check you have ETH for gas

**Transaction failed**
- Ensure wallet has ETH for gas fees
- Verify RPC URL is correct
- Check network connectivity

## Related

- [Merchant Agent](../merchant-agent/README.md)
- [x402 Protocol Library](../x402_a2a/README.md)

## License

Apache-2.0
