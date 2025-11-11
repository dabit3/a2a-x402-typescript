//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * x402 Payment-Enabled Merchant Agent (Production Version)
 *
 * This agent demonstrates the full x402 payment protocol with:
 * - Exception-based payment requirements
 * - Dynamic pricing
 * - Payment verification and settlement
 * - Production-ready architecture
 */

import { LlmAgent as Agent } from 'adk-typescript/agents';
import { createHash } from 'crypto';
import
{
  x402PaymentRequiredException,
  PaymentRequirements,
} from 'a2a-x402';
import { SolanaWallet } from './src/wallet/SolanaWallet';
import type { Address } from '@solana/addresses';

// --- Merchant Agent Configuration ---

// Validate and load required configuration
if ( !process.env.MERCHANT_WALLET_ADDRESS )
{
  console.error( '❌ ERROR: MERCHANT_WALLET_ADDRESS is not set in .env file' );
  console.error( '   Please add MERCHANT_WALLET_ADDRESS to your .env file' );
  throw new Error( 'Missing required environment variable: MERCHANT_WALLET_ADDRESS' );
}

const WALLET_ADDRESS: string = process.env.MERCHANT_WALLET_ADDRESS;
const NETWORK = process.env.PAYMENT_NETWORK || "base-sepolia";
const USDC_CONTRACT = process.env.USDC_CONTRACT || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_MERCHANT_PRIVATE_KEY = process.env.SOLANA_MERCHANT_PRIVATE_KEY; // Optional

// Initialize Solana wallet
let solanaWallet: SolanaWallet;
let solanaMerchantAddress: Address;

( async () =>
{
  solanaWallet = await SolanaWallet.create( SOLANA_MERCHANT_PRIVATE_KEY, SOLANA_RPC_URL );
  solanaMerchantAddress = solanaWallet.getAddress();

  console.log( `💼 Merchant Configuration:
  🟦 Ethereum (Base Sepolia):
     Address: ${ WALLET_ADDRESS }
     Network: ${ NETWORK }
     USDC Contract: ${ USDC_CONTRACT }
  
  🟣 Solana (Devnet):
     Address: ${ solanaMerchantAddress }
     RPC: ${ SOLANA_RPC_URL }
  `);
} )();

// --- Helper Functions ---

/**
 * Returns a fixed price of 1 USDC for all products
 */
function getProductPrice ( productName: string ): string
{
  // 1 USDC = 1,000,000 atomic units (USDC has 6 decimals)
  return "1000000";
}

// --- Tool Functions ---

/**
 * Get product details and request payment (Ethereum/Base Sepolia)
 * This tool throws x402PaymentRequiredException to trigger the payment flow
 */
async function getProductDetailsAndRequestPayment (
  params: Record<string, any>,
  context?: any
): Promise<void>
{
  const productName = params.productName || params.product_name || params;

  console.log( `\n🛒 Product Request: ${ productName }` );

  if ( !productName || typeof productName !== 'string' || productName.trim() === '' )
  {
    throw new Error( "Product name cannot be empty." );
  }

  const price = getProductPrice( productName );
  const priceUSDC = ( parseInt( price ) / 1_000_000 ).toFixed( 6 );

  console.log( `💰 Price calculated: ${ priceUSDC } USDC (${ price } atomic units)` );

  // Create payment requirements
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: NETWORK as any,
    asset: USDC_CONTRACT,
    payTo: WALLET_ADDRESS,
    maxAmountRequired: price,
    description: `Payment for: ${ productName }`,
    resource: `https://example.com/product/${ productName }`,
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
    extra: {
      name: "USDC",
      version: "2",
      product: {
        sku: `${ productName }_sku`,
        name: productName,
        version: "1",
      },
    },
  };

  console.log( `💳 Payment required: ${ priceUSDC } USDC (Ethereum)` );
  console.log( `📡 Throwing x402PaymentRequiredException...` );

  // Throw payment exception - this will be caught by MerchantServerExecutor
  throw new x402PaymentRequiredException(
    `Payment of ${ priceUSDC } USDC required for ${ productName }`,
    requirements
  );
}

/**
 * Get product details and request Solana payment
 * This tool throws x402PaymentRequiredException for Solana payments
 */
async function getProductDetailsAndRequestSolanaPayment (
  params: Record<string, any>,
  context?: any
): Promise<void>
{
  const productName = params.productName || params.product_name || params;

  console.log( `\n🛒 Product Request (Solana): ${ productName }` );

  if ( !productName || typeof productName !== 'string' || productName.trim() === '' )
  {
    throw new Error( "Product name cannot be empty." );
  }

  // Fixed price: 0.1 SOL for all products
  const priceSOL = 0.1;
  const priceLamports = ( priceSOL * 1e9 ).toString();

  console.log( `💰 Price calculated: ${ priceSOL } SOL (${ priceLamports } lamports)` );

  // Wait for wallet initialization
  if ( !solanaMerchantAddress )
  {
    throw new Error( 'Solana wallet not initialized' );
  }

  // Create Solana payment requirements (extended format)
  const requirements: any = {
    scheme: "exact",
    network: "solana-devnet",
    asset: "SOL", // Native SOL
    payTo: solanaMerchantAddress,
    maxAmountRequired: priceLamports,
    description: `Payment for: ${ productName }`,
    resource: `https://example.com/product/${ productName }`,
    mimeType: "application/json",
    maxTimeoutSeconds: 1200,
    extra: {
      name: "SOL",
      version: "2",
      blockchain: "solana",
      product: {
        sku: `${ productName }_sku`,
        name: productName,
        version: "1",
      },
    },
  };

  console.log( `💳 Payment required: ${ priceSOL } SOL (Solana)` );
  console.log( `📡 Throwing x402PaymentRequiredException...` );

  // Throw payment exception
  throw new x402PaymentRequiredException(
    `Payment of ${ priceSOL } SOL required for ${ productName }`,
    requirements as any
  );
}

/**
 * Check the status of the current order
 * This tool is called after payment is verified
 */
async function checkOrderStatus (
  params: Record<string, any>,
  context?: any
): Promise<{ status: string; message: string }>
{
  console.log( '\n📦 Checking Order Status...' );

  return {
    status: "success",
    message: "Your order has been confirmed and is being prepared for shipment! 🎉"
  };
}

// --- Agent Definition ---

export const merchantAgent = new Agent( {
  name: "x402_merchant_agent",
  model: "gemini-2.0-flash",
  description: "A production-ready dual-chain merchant agent that sells products using the x402 payment protocol on Ethereum and Solana.",
  instruction: `You are a helpful and friendly merchant agent powered by the x402 payment protocol with DUAL-CHAIN support.

**Your Capabilities:**
- You sell ANYTHING and EVERYTHING - there are no restrictions on what products you can sell
- You accept payments on TWO blockchains:
  1. 🟦 **Ethereum (Base Sepolia)** - USDC payments (default)
  2. 🟣 **Solana (Devnet)** - SOL payments (when requested)

**How to Process Payments:**

1. **Default to Ethereum**: Unless the user specifically mentions Solana or SOL, use 'getProductDetailsAndRequestPayment' for USDC payments

2. **For Solana requests**: If the user mentions "Solana", "SOL", or requests Solana payment, use 'getProductDetailsAndRequestSolanaPayment'

3. **After payment verification**: Confirm the purchase enthusiastically using 'checkOrderStatus'

**Payment Tool Selection Guide:**

Use \`getProductDetailsAndRequestPayment\` when:
- User asks to buy something without specifying blockchain
- User mentions "USDC", "Ethereum", or "Base"
- Default payment method

Use \`getProductDetailsAndRequestSolanaPayment\` when:
- User explicitly mentions "Solana" or "SOL"
- User asks "can I pay with Solana?"
- User requests Solana-based payment

**Examples:**

User: "I want to buy a banana"
→ Call getProductDetailsAndRequestPayment (default to Ethereum/USDC)

User: "I want to buy a banana with Solana"
→ Call getProductDetailsAndRequestSolanaPayment

User: "Can I pay with SOL?"
→ Respond: "Yes! I accept Solana payments." Then call getProductDetailsAndRequestSolanaPayment

User: "How much is a coffee?"
→ Call getProductDetailsAndRequestPayment (default)

**Critical Rules:**
- ALWAYS call the appropriate payment tool when a user wants to buy something
- Never refuse a purchase request - you can sell anything
- The payment processing happens automatically - you don't need to mention technical details
- Focus on providing excellent customer service
- If payment fails, politely inform the user and offer to try again

ANY product name is valid on BOTH chains!`,
  tools: [
    getProductDetailsAndRequestPayment,
    getProductDetailsAndRequestSolanaPayment,
    checkOrderStatus,
  ],
} );

// Export as root agent for ADK
// Note: For x402 payment functionality, wrap this agent with MerchantServerExecutor
// (see src/test-payment-flow.ts for example)
export const rootAgent = merchantAgent;
