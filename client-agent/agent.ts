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
 * x402 Client Agent - Orchestrator agent with payment capabilities
 *
 * This agent can discover and interact with remote agents (like merchants),
 * automatically handling payment flows when required.
 */

import { LlmAgent as Agent } from 'adk-typescript/agents';
import { ToolContext } from 'adk-typescript/tools';
import { LocalWallet } from './src/wallet/Wallet';
import { x402Utils, PaymentStatus } from 'a2a-x402';
import { logger } from './src/logger';

// --- Client Agent Configuration ---

const MERCHANT_AGENT_URL = process.env.MERCHANT_AGENT_URL || 'http://localhost:10000/agents/merchant';

logger.log(`🤖 Client Agent Configuration:
  Merchant URL: ${MERCHANT_AGENT_URL}
`);

// Initialize wallet
const wallet = new LocalWallet();
const x402 = new x402Utils();

// State management
interface AgentState {
  pendingPayment?: {
    agentUrl: string;
    agentName: string;
    requirements: any;
    taskId?: string;
    contextId?: string;
  };
}

const state: AgentState = {};

// --- Tool Functions ---

/**
 * Parse user message using LLM to extract product name
 */
async function parseUserMessage(message: string): Promise<{ isPurchase: boolean; product?: string }> {
  const { VertexAI } = await import('@google-cloud/vertexai');

  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  });

  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  const prompt = `Analyze this user message and determine if it's a purchase request. If it is, extract the product name.

User message: "${message}"

Respond ONLY with valid JSON in this exact format:
{
  "isPurchase": true/false,
  "product": "product name" or null
}

Examples:
- "I want to buy a banana" -> {"isPurchase": true, "product": "banana"}
- "buy banana" -> {"isPurchase": true, "product": "banana"}
- "get me an apple please" -> {"isPurchase": true, "product": "apple"}
- "hello" -> {"isPurchase": false, "product": null}
- "what can you do?" -> {"isPurchase": false, "product": null}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonText);
    return {
      isPurchase: parsed.isPurchase === true,
      product: parsed.product || undefined,
    };
  } catch (error) {
    logger.error('Failed to parse user message with LLM:', error);
    // Fallback to simple regex if LLM fails
    const lowerMessage = message.toLowerCase();
    const buyMatch = lowerMessage.match(/(?:buy|purchase|get|want)[\s\w]*?(banana|apple|orange|coffee|book|laptop|phone)/i);
    return {
      isPurchase: !!buyMatch,
      product: buyMatch?.[1],
    };
  }
}

/**
 * Send a message to a remote merchant agent
 * For demo purposes, this simulates the merchant's response
 */
async function sendMessageToMerchant(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  // Handle both direct string and object with message/params field
  const message = typeof params === 'string' ? params : (params.message || params.params || params);

  logger.log(`\n📤 Sending message to merchant: "${message}"`);

  // Use LLM to parse the message
  const parsed = await parseUserMessage(String(message));

  if (parsed.isPurchase && parsed.product) {
    const product = parsed.product;

    // Simulate merchant response with payment requirements
    // In reality, this would come from the merchant agent
    // Fixed price: 1 USDC = 1,000,000 atomic units
    const price = 1_000_000;
    const priceUSDC = '1.000000';

    // Store payment requirements in state
    state.pendingPayment = {
      agentUrl: MERCHANT_AGENT_URL,
      agentName: 'merchant_agent',
      requirements: {
        accepts: [{
          scheme: 'exact',
          network: 'base-sepolia',
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          payTo: process.env.MERCHANT_WALLET_ADDRESS || '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
          maxAmountRequired: price.toString(),
          maxTimeoutSeconds: 1200,
          extra: {
            name: 'USDC',
            product: { name: product },
          },
        }],
      },
    };

    logger.log(`💰 Payment required: ${priceUSDC} USDC for ${product}`);

    return `The merchant agent responded! They're selling ${product} for ${priceUSDC} USDC.

**Payment Details:**
- Product: ${product}
- Price: ${priceUSDC} USDC (${price} atomic units)
- Network: Base Sepolia
- Payment Token: USDC

Would you like to proceed with this payment?`;
  }

  // Default response for non-purchase messages
  return `I sent your message "${message}" to the merchant. However, it doesn't seem to be a purchase request. Try asking to buy something specific, like "I want to buy a banana".`;
}

/**
 * Confirm and sign a pending payment
 */
async function confirmPayment(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  if (!state.pendingPayment) {
    return 'No pending payment to confirm.';
  }

  logger.log('\n💰 User confirmed payment. Processing...');

  try {
    const paymentOption = state.pendingPayment.requirements.accepts[0];
    const tokenAddress = paymentOption.asset;
    const merchantAddress = paymentOption.payTo;
    const amount = BigInt(paymentOption.maxAmountRequired);
    const productName = paymentOption.extra?.product?.name || 'product';

    // Step 1: Sign the payment with wallet (this also handles approval)
    const signedPayload = await wallet.signPayment(state.pendingPayment.requirements);

    logger.log('✅ Payment signed successfully!');
    logger.log(`   Signature: ${signedPayload.payload.signature.substring(0, 20)}...`);

    // Step 2: Execute the actual token transfer
    const transferResult = await wallet.executePayment(tokenAddress, merchantAddress, amount);

    if (!transferResult.success) {
      return `Payment transfer failed: ${transferResult.error}`;
    }

    const amountUSDC = (Number(amount) / 1_000_000).toFixed(6);
    const result = `✅ Payment completed successfully!

**Transaction Details:**
- Product: ${productName}
- Amount: ${amountUSDC} USDC (${amount.toString()} atomic units)
- Token: ${tokenAddress}
- Merchant: ${merchantAddress}
- Transaction: ${transferResult.txHash}

You can view the transaction on BaseScan: https://sepolia.basescan.org/tx/${transferResult.txHash}`;

    // Clear pending payment
    state.pendingPayment = undefined;

    return result;

  } catch (error) {
    logger.error('❌ Payment processing failed:', error);
    return `Payment processing failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Cancel a pending payment
 */
async function cancelPayment(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  if (!state.pendingPayment) {
    return 'No pending payment to cancel.';
  }

  logger.log('❌ User cancelled payment.');
  state.pendingPayment = undefined;

  return 'Payment cancelled.';
}

/**
 * Get wallet information
 */
async function getWalletInfo(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  return `Wallet Address: ${wallet.getAddress()}`;
}

// --- Agent Definition ---

export const clientAgent = new Agent({
  name: 'x402_client_agent',
  model: 'gemini-2.0-flash',
  description: 'An orchestrator agent that can interact with merchants and handle payments.',
  instruction: `You are a helpful client agent that assists users in buying products from merchant agents using cryptocurrency payments.

**How you work:**
This is an x402 payment demo. You can help users purchase products from merchant agents using USDC on the Base Sepolia blockchain.

**When users greet you or send unclear messages:**
Introduce yourself and explain what you can do:
- "Hi! I'm a client agent that can help you purchase products using cryptocurrency."
- "I can connect to merchant agents and handle the payment process for you."
- "Try asking me to buy something, like: 'I want to buy a banana'"
- "Your wallet is connected at: ${wallet.getAddress()}"

**When users want to buy something:**
1. Use sendMessageToMerchant to request the product from the merchant
2. The merchant will respond with payment requirements (amount in USDC)
3. Ask the user to confirm: "The merchant is requesting X USDC for [product]. Do you want to proceed?"
4. If user confirms ("yes", "confirm", "ok"), use confirmPayment to sign and submit
5. If user declines ("no", "cancel"), use cancelPayment

**Important guidelines:**
- ALWAYS explain what you're doing in a friendly, clear way
- When greeting messages arrive, respond warmly and explain your capabilities
- Be transparent about payment amounts before proceeding
- Handle errors gracefully and explain what went wrong
- If the user message doesn't relate to purchasing, kindly redirect them to ask for a product

**Example interactions:**

User: "hello"
You: "Hi! I'm an x402 payment client agent. I can help you buy products from merchants using USDC cryptocurrency. Your wallet is ready at ${wallet.getAddress()}. Try asking me to buy something, like 'I want to buy a banana'!"

User: "I want to buy a banana"
You: [Contact merchant, receive requirements]
You: "The merchant is requesting 54.39 USDC for a banana. Would you like to proceed with this payment?"

User: "yes"
You: [Sign and submit payment]
You: "✅ Payment successful! Your banana order has been confirmed!"`,

  tools: [
    sendMessageToMerchant,
    confirmPayment,
    cancelPayment,
    getWalletInfo,
  ],
});

// Export as root agent for ADK
export const rootAgent = clientAgent;
