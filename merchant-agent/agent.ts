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
import { x402PaymentRequiredException, PaymentRequirements } from 'a2a-x402';

// --- Merchant Agent Configuration ---

// Validate and load required configuration
if (!process.env.MERCHANT_WALLET_ADDRESS) {
  console.error('❌ ERROR: MERCHANT_WALLET_ADDRESS is not set in .env file');
  console.error('   Please add MERCHANT_WALLET_ADDRESS to your .env file');
  throw new Error(
    'Missing required environment variable: MERCHANT_WALLET_ADDRESS'
  );
}

const WALLET_ADDRESS: string = process.env.MERCHANT_WALLET_ADDRESS;
const NETWORK = process.env.PAYMENT_NETWORK || 'base-sepolia';
const USDC_CONTRACT =
  process.env.USDC_CONTRACT || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

console.log(`💼 Merchant Configuration:
  Wallet: ${WALLET_ADDRESS}
  Network: ${NETWORK}
  USDC Contract: ${USDC_CONTRACT}
`);

// --- Helper Functions ---

/**
 * Returns a fixed price of 1 USDC for all products
 */
function getProductPrice(productName: string): string {
  // 1 USDC = 1,000,000 atomic units (USDC has 6 decimals)
  return '1000000';
}

// --- Tool Functions ---

/**
 * Get product details and request payment
 * This tool throws x402PaymentRequiredException to trigger the payment flow
 */
async function getProductDetailsAndRequestPayment(
  params: Record<string, any>,
  context?: any
): Promise<void> {
  const productName = params.productName || params.product_name || params;

  console.log(`\n🛒 Product Request: ${productName}`);

  if (
    !productName ||
    typeof productName !== 'string' ||
    productName.trim() === ''
  ) {
    throw new Error('Product name cannot be empty.');
  }

  const price = getProductPrice(productName);
  const priceUSDC = (parseInt(price) / 1_000_000).toFixed(6);

  console.log(`💰 Price calculated: ${priceUSDC} USDC (${price} atomic units)`);

  // Create payment requirements
  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: NETWORK as any,
    asset: USDC_CONTRACT,
    payTo: WALLET_ADDRESS,
    maxAmountRequired: price,
    description: `Payment for: ${productName}`,
    resource: `https://example.com/product/${productName}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 1200,
    extra: {
      name: 'USDC',
      version: '2',
      product: {
        sku: `${productName}_sku`,
        name: productName,
        version: '1',
      },
    },
  };

  console.log(`💳 Payment required: ${priceUSDC} USDC`);
  console.log(`📡 Throwing x402PaymentRequiredException...`);

  // Throw payment exception - this will be caught by MerchantServerExecutor
  throw new x402PaymentRequiredException(
    `Payment of ${priceUSDC} USDC required for ${productName}`,
    requirements
  );
}

/**
 * Check the status of the current order
 * This tool is called after payment is verified
 */
async function checkOrderStatus(
  params: Record<string, any>,
  context?: any
): Promise<{ status: string; message: string }> {
  console.log('\n📦 Checking Order Status...');

  return {
    status: 'success',
    message:
      'Your order has been confirmed and is being prepared for shipment! 🎉',
  };
}

// --- Agent Definition ---

export const merchantAgent = new Agent({
  name: 'x402_merchant_agent',
  model: 'gemini-2.0-flash',
  description:
    'A production-ready merchant agent that sells products using the x402 payment protocol.',
  instruction: `You are a helpful and friendly merchant agent powered by the x402 payment protocol.

**Your Role:**
- You sell ANYTHING and EVERYTHING - there are no restrictions on what products you can sell
- When a user asks to buy ANY item or requests pricing, ALWAYS use the 'getProductDetailsAndRequestPayment' tool
- Accept all purchase requests for any product, service, or item mentioned
- This will trigger the x402 payment flow automatically
- After payment is verified by the system, confirm the purchase with enthusiasm
- Be professional, friendly, and concise

**Critical Rules:**
- ALWAYS call getProductDetailsAndRequestPayment when a user wants to buy something
- Never refuse a purchase request - you can sell anything
- The payment processing happens automatically - you don't need to mention technical details
- Focus on providing excellent customer service
- If payment fails, politely inform the user and offer to try again

**Examples of Valid Requests:**
- "I want to buy a banana" → Call getProductDetailsAndRequestPayment with "banana"
- "I want to buy a pencil" → Call getProductDetailsAndRequestPayment with "pencil"
- "I want to buy a laptop" → Call getProductDetailsAndRequestPayment with "laptop"
- "Can I purchase coffee?" → Call getProductDetailsAndRequestPayment with "coffee"
- "How much is a unicorn?" → Call getProductDetailsAndRequestPayment with "unicorn"

ANY product name is valid!`,
  tools: [getProductDetailsAndRequestPayment, checkOrderStatus],
});

// Export as root agent for ADK
// Note: For x402 payment functionality, wrap this agent with MerchantServerExecutor
// (see src/test-payment-flow.ts for example)
export const rootAgent = merchantAgent;
