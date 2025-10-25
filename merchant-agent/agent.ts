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
import { x402PaymentRequiredException, PaymentRequirements } from 'a2a-x402';

// --- Merchant Agent Configuration ---

// Validate and load required configuration
if (!process.env.MERCHANT_WALLET_ADDRESS) {
  console.error('❌ ERROR: MERCHANT_WALLET_ADDRESS is not set in .env file');
  console.error('   Please add MERCHANT_WALLET_ADDRESS to your .env file');
  throw new Error('Missing required environment variable: MERCHANT_WALLET_ADDRESS');
}

const WALLET_ADDRESS: string = process.env.MERCHANT_WALLET_ADDRESS;
const NETWORK = process.env.PAYMENT_NETWORK || "base-sepolia";
const USDC_CONTRACT = process.env.USDC_CONTRACT || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

console.log(`💼 Merchant Configuration:
  Wallet: ${WALLET_ADDRESS}
  Network: ${NETWORK}
  USDC Contract: ${USDC_CONTRACT}
`);

// --- Product Metadata ---

const EBOOK_DOWNLOAD_URL = 'https://gist.github.com/dabit3/fd7f4d24ebdda092f6cbbb6a5e57e487';

const PRODUCT = {
  sku: 'developer_relations_ebook',
  name: 'Developer Relations Ebook',
  description:
    'A practical guide to designing, launching, and scaling successful developer relations programs. Delivered instantly via secure download link.',
  priceAtomicUnits: '1000000', // 1 USDC with 6 decimals
};

// --- Tool Functions ---

/**
 * Get product details and request payment
 * This tool throws x402PaymentRequiredException to trigger the payment flow
 */
async function getProductDetailsAndRequestPayment(
  params: Record<string, any>,
  context?: any
): Promise<void> {
  const userRequest = typeof params === 'string'
    ? params
    : params?.productName || params?.product_name;
  const productName = PRODUCT.name;

  console.log(`\n🛒 Product Request Received`);
  if (userRequest) {
    console.log(`   User asked for: ${userRequest}`);
  }
  console.log(`   Proceeding with: ${productName}`);

  if (typeof userRequest === 'string' && userRequest.trim() === '') {
    throw new Error('Product request text cannot be empty.');
  }

  const price = PRODUCT.priceAtomicUnits;
  const priceUSDC = (Number(price) / 1_000_000).toFixed(6);

  console.log(`💰 Price calculated: ${priceUSDC} USDC (${price} atomic units)`);

  // Create payment requirements
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: NETWORK as any,
    asset: USDC_CONTRACT,
    payTo: WALLET_ADDRESS,
    maxAmountRequired: price,
    description: `Payment for: ${productName}`,
    resource: `urn:ebook:${PRODUCT.sku}`,
    mimeType: "text/plain",
    maxTimeoutSeconds: 1200,
    extra: {
      name: "USDC",
      version: "2",
      product: {
        sku: PRODUCT.sku,
        name: productName,
        version: "1",
        description: PRODUCT.description,
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
    status: "success",
    message: `Link to download: ${EBOOK_DOWNLOAD_URL}`,
  };
}

// --- Agent Definition ---

export const merchantAgent = new Agent({
  name: "x402_merchant_agent",
  model: "gemini-2.0-flash",
  description: "Merchant agent that sells the Developer Relations Ebook with the x402 payment protocol.",
  instruction: `You are a friendly and concise merchant agent that sells exactly one product: the Developer Relations Ebook for 1 USDC on ${NETWORK}.

**Product Catalog**
- Developer Relations Ebook — 1 USDC. ${PRODUCT.description}
- Payment settles to wallet ${WALLET_ADDRESS}. Delivery is instant via secure download link.

**How to Assist**
- When the user greets you or asks what is available, explain that you only offer the Developer Relations Ebook, highlight the price (1 USDC), and mention that payment is handled through the x402 flow.
- If a user asks for anything else, clarify that only the Developer Relations Ebook is available and invite them to purchase it.
- When the user clearly wants to buy or confirm the purchase, call getProductDetailsAndRequestPayment (ignore any other product names and always sell the ebook).
- After payment is verified (metadata will include x402.payment.status values like "payment-verified" or "payment-success"), immediately call checkOrderStatus to retrieve the download link and share it with the user without modification. Preface the link with a short confirmation like "Here is your download link:".
- If payment settlement fails, apologize and tell the user how to retry or contact support.

**Tone & Style**
- Be warm, professional, and to the point.
- Make it clear that delivery happens right after a successful on-chain payment.
- Never mention implementation details about the executor or internal tooling.

**Examples**
- User: "What products do you have?" → Respond with a short catalog description featuring the Developer Relations Ebook and invite the user to purchase it for 1 USDC.
- User: "I want to buy something" → Clarify only the ebook is available and ask if they want to proceed; when they confirm, call getProductDetailsAndRequestPayment with the ebook.
- User: "Yes, let's do it" after confirming price → Call getProductDetailsAndRequestPayment.
- User: Payment completed and metadata indicates success → Call checkOrderStatus and then send the download link.
`,
  tools: [
    getProductDetailsAndRequestPayment,
    checkOrderStatus,
  ],
});

// Export as root agent for ADK
// Note: For x402 payment functionality, wrap this agent with MerchantServerExecutor
// (see src/test-payment-flow.ts for example)
export const rootAgent = merchantAgent;
