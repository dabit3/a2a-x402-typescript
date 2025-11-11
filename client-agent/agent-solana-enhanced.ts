#!/usr/bin/env tsx
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
 * Enhanced x402 Client Agent with Solana Integration
 * 
 * This agent supports dual-chain operations:
 * - Ethereum payments on Base Sepolia (USDC)
 * - Solana payments on Devnet (SOL, SPL tokens)
 */

import { LlmAgent as Agent } from 'adk-typescript/agents';
import { ToolContext } from 'adk-typescript/tools';
import { LocalWallet } from './src/wallet/Wallet';
import { SolanaWallet } from './src/wallet/SolanaWallet';
import { x402Utils } from 'a2a-x402';
import { logger } from './src/logger';
import { lamports } from '@solana/kit';

// --- Configuration ---

const MERCHANT_AGENT_URL = process.env.MERCHANT_AGENT_URL || 'http://localhost:10000';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

logger.log( `🤖 Enhanced Client Agent Configuration:
  Merchant URL: ${ MERCHANT_AGENT_URL }
  Solana RPC: ${ SOLANA_RPC_URL }
`);

// Initialize wallets
let ethWallet: LocalWallet;
let solanaWallet: SolanaWallet;

async function initializeWallets ()
{
    ethWallet = new LocalWallet();
    solanaWallet = await SolanaWallet.create( undefined, SOLANA_RPC_URL );

    logger.log( `\n💼 Multi-Chain Wallets Initialized:` );
    logger.log( `   🟦 Ethereum (Base Sepolia): ${ ethWallet.getAddress() }` );
    logger.log( `   🟣 Solana (Devnet): ${ solanaWallet.getAddress() }` );
}

const x402 = new x402Utils();

// State management
interface AgentState
{
    sessionId?: string;
    pendingPayment?: {
        agentUrl: string;
        agentName: string;
        requirements: any;
        taskId?: string;
        contextId?: string;
        blockchain?: 'ethereum' | 'solana';
    };
}

const state: AgentState = {};

// --- Helper Functions ---

async function ensureSession (): Promise<string>
{
    if ( state.sessionId )
    {
        return state.sessionId;
    }

    try
    {
        const response = await fetch( `${ MERCHANT_AGENT_URL }/apps/x402_merchant_agent/users/client-user/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {} ),
        } );

        if ( !response.ok )
        {
            throw new Error( `Failed to create session: ${ response.status }` );
        }

        const session = await response.json() as any;
        state.sessionId = session.id;
        logger.log( `✅ Created new session: ${ state.sessionId }` );
        return state.sessionId!;
    } catch ( error )
    {
        logger.error( '❌ Failed to create session:', error );
        throw error;
    }
}

// --- Tool Functions ---

/**
 * Send a message to a remote merchant agent
 */
async function sendMessageToMerchant (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    const message = typeof params === 'string' ? params : ( params.message || params.params || params );
    logger.log( `\n📤 Sending message to merchant: "${ message }"` );

    try
    {
        const sessionId = await ensureSession();

        const response = await fetch( `${ MERCHANT_AGENT_URL }/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {
                appName: 'x402_merchant_agent',
                userId: 'client-user',
                sessionId: sessionId,
                newMessage: {
                    role: 'user',
                    parts: [ { text: String( message ) } ],
                },
            } ),
        } );

        if ( !response.ok )
        {
            const errorText = await response.text();
            logger.error( `❌ Merchant server error (${ response.status }): ${ errorText }` );
            return `Sorry, I couldn't connect to the merchant. Server error: ${ response.status }`;
        }

        const events = await response.json() as any[];
        logger.log( `✅ Received ${ events.length } events from merchant` );

        // Check for payment requirements
        for ( const event of events )
        {
            if ( event.errorCode && event.errorCode === 'x402_payment_required' )
            {
                const paymentReqs = event.errorData?.paymentRequirements;
                if ( paymentReqs && paymentReqs.accepts && paymentReqs.accepts.length > 0 )
                {
                    const paymentOption = paymentReqs.accepts[ 0 ];
                    const price = BigInt( paymentOption.maxAmountRequired );
                    const priceUSDC = ( Number( price ) / 1_000_000 ).toFixed( 6 );
                    const productName = paymentOption.extra?.product?.name || 'product';

                    state.pendingPayment = {
                        agentUrl: MERCHANT_AGENT_URL,
                        agentName: 'merchant_agent',
                        requirements: paymentReqs,
                        taskId: event.invocationId,
                        contextId: event.invocationId,
                        blockchain: 'ethereum', // Default to Ethereum for now
                    };

                    return `The merchant is selling ${ productName } for ${ priceUSDC } USDC on Base Sepolia.

**Payment Details:**
- Product: ${ productName }
- Price: ${ priceUSDC } USDC
- Network: Base Sepolia Testnet
- Payment Token: USDC

Would you like to proceed with this payment?`;
                }
            }
        }

        // Check for text responses
        for ( const event of events )
        {
            if ( event.content && event.content.parts )
            {
                const textParts = event.content.parts
                    .filter( ( p: any ) => p.text )
                    .map( ( p: any ) => p.text )
                    .join( '\n' );
                if ( textParts )
                {
                    return `Merchant says: ${ textParts }`;
                }
            }
        }

        return `I contacted the merchant, but received an unexpected response.`;
    } catch ( error )
    {
        logger.error( '❌ Failed to contact merchant:', error );
        return `Failed to contact merchant: ${ error instanceof Error ? error.message : String( error ) }`;
    }
}

/**
 * Confirm and process payment (Ethereum/Solana)
 */
async function confirmPayment (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    if ( !state.pendingPayment )
    {
        return 'No pending payment to confirm.';
    }

    logger.log( '\n💰 User confirmed payment. Processing...' );

    try
    {
        const paymentOption = state.pendingPayment.requirements.accepts[ 0 ];
        const blockchain = state.pendingPayment.blockchain || 'ethereum';

        if ( blockchain === 'ethereum' )
        {
            return await processEthereumPayment( paymentOption );
        } else if ( blockchain === 'solana' )
        {
            return await processSolanaPayment( paymentOption );
        }

        return 'Unsupported blockchain';
    } catch ( error )
    {
        logger.error( '❌ Payment processing failed:', error );
        return `Payment processing failed: ${ error instanceof Error ? error.message : String( error ) }`;
    }
}

async function processEthereumPayment ( paymentOption: any ): Promise<string>
{
    const tokenAddress = paymentOption.asset;
    const merchantAddress = paymentOption.payTo;
    const amount = BigInt( paymentOption.maxAmountRequired );
    const productName = paymentOption.extra?.product?.name || 'product';

    // Sign payment
    const signedPayload = await ethWallet.signPayment( state.pendingPayment!.requirements );
    logger.log( '✅ Payment signed' );

    // Execute transfer
    const transferResult = await ethWallet.executePayment( tokenAddress, merchantAddress, amount );
    if ( !transferResult.success )
    {
        return `Payment transfer failed: ${ transferResult.error }`;
    }

    logger.log( `✅ Transfer successful: ${ transferResult.txHash }` );

    // Notify merchant
    await notifyMerchant( productName, signedPayload );

    const amountUSDC = ( Number( amount ) / 1_000_000 ).toFixed( 6 );
    const result = `✅ Ethereum payment completed!

**Transaction Details:**
- Product: ${ productName }
- Amount: ${ amountUSDC } USDC
- Transaction: ${ transferResult.txHash }
- View: https://sepolia.basescan.org/tx/${ transferResult.txHash }`;

    state.pendingPayment = undefined;
    return result;
}

async function processSolanaPayment ( paymentOption: any ): Promise<string>
{
    // For Solana payments, handle SPL token or SOL transfers
    const amount = BigInt( paymentOption.maxAmountRequired );
    const productName = paymentOption.extra?.product?.name || 'product';
    const recipientAddress = paymentOption.payTo;

    // Simple SOL transfer for demonstration
    const transferResult = await solanaWallet.transferSol(
        recipientAddress as any,
        amount
    );

    if ( !transferResult.success )
    {
        return `Solana payment failed: ${ transferResult.error }`;
    }

    const amountSOL = ( Number( amount ) / 1e9 ).toFixed( 6 );
    const result = `✅ Solana payment completed!

**Transaction Details:**
- Product: ${ productName }
- Amount: ${ amountSOL } SOL
- Transaction: ${ transferResult.signature }
- View: https://explorer.solana.com/tx/${ transferResult.signature }?cluster=devnet`;

    state.pendingPayment = undefined;
    return result;
}

async function notifyMerchant ( productName: string, signedPayload: any ): Promise<void>
{
    try
    {
        const response = await fetch( MERCHANT_AGENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {
                text: `I want to buy ${ productName }`,
                taskId: state.pendingPayment!.taskId,
                contextId: state.pendingPayment!.contextId,
                message: {
                    messageId: `msg-${ Date.now() }`,
                    role: 'user',
                    parts: [ { kind: 'text', text: `I want to buy ${ productName }` } ],
                    metadata: {
                        x402: {
                            paymentStatus: 'payment-submitted',
                            paymentPayload: signedPayload,
                        },
                    },
                },
            } ),
        } );

        if ( response.ok )
        {
            logger.log( '✅ Merchant notified' );
        }
    } catch ( error )
    {
        logger.error( '❌ Failed to notify merchant:', error );
    }
}

/**
 * Cancel pending payment
 */
async function cancelPayment (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    if ( !state.pendingPayment )
    {
        return 'No pending payment to cancel.';
    }
    logger.log( '❌ User cancelled payment' );
    state.pendingPayment = undefined;
    return 'Payment cancelled.';
}

/**
 * Get wallet information for both chains
 */
async function getWalletInfo (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    const ethBalance = await ethWallet.getBalance();
    const solBalance = await solanaWallet.getBalance();

    return `**Multi-Chain Wallet Info:**

🟦 **Ethereum (Base Sepolia)**
   Address: ${ ethWallet.getAddress() }

🟣 **Solana (Devnet)**
   Address: ${ solanaWallet.getAddress() }
   Balance: ${ ( Number( solBalance ) / 1e9 ).toFixed( 6 ) } SOL`;
}

/**
 * Request Solana airdrop
 */
async function requestSolanaAirdrop (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    const amount = params.amount || 2_000_000_000; // 2 SOL default

    try
    {
        const signature = await solanaWallet.requestAirdrop( BigInt( amount ) );
        const amountSOL = ( Number( amount ) / 1e9 ).toFixed( 2 );

        return `✅ Airdrop requested: ${ amountSOL } SOL
Transaction: ${ signature }
View: https://explorer.solana.com/tx/${ signature }?cluster=devnet`;
    } catch ( error )
    {
        return `❌ Airdrop failed: ${ error instanceof Error ? error.message : String( error ) }`;
    }
}

/**
 * Transfer SOL to another address
 */
async function transferSolana (
    params: Record<string, any>,
    context?: ToolContext
): Promise<string>
{
    const { recipient, amount } = params;

    if ( !recipient || !amount )
    {
        return 'Please provide both recipient address and amount';
    }

    try
    {
        const result = await solanaWallet.transferSol( recipient, BigInt( amount ) );

        if ( result.success )
        {
            const amountSOL = ( Number( amount ) / 1e9 ).toFixed( 6 );
            return `✅ Transfer successful: ${ amountSOL } SOL to ${ recipient }
Transaction: ${ result.signature }
View: https://explorer.solana.com/tx/${ result.signature }?cluster=devnet`;
        } else
        {
            return `❌ Transfer failed: ${ result.error }`;
        }
    } catch ( error )
    {
        return `❌ Transfer failed: ${ error instanceof Error ? error.message : String( error ) }`;
    }
}

// --- Agent Definition ---

export const clientAgent = new Agent( {
    name: 'x402_dual_chain_client',
    model: 'gemini-2.0-flash',
    description: 'A dual-chain client agent supporting Ethereum and Solana payments.',
    instruction: `You are an advanced x402 payment client agent with multi-chain capabilities.

**Your Capabilities:**
- Purchase products from merchants using USDC on Base Sepolia (Ethereum)
- Manage Solana wallet and perform SOL transfers on Devnet
- Handle dual-chain payment workflows
- Request airdrops and check balances

**Multi-Chain Wallet:**
- Ethereum: Connected to Base Sepolia testnet
- Solana: Connected to Solana Devnet

**How to assist users:**

1. **When greeting:** Introduce your dual-chain capabilities
2. **For purchases:** Use Ethereum (Base Sepolia) with USDC
3. **For Solana operations:** Use dedicated Solana tools
4. **Always explain:** What blockchain you're using and why

**Example interactions:**

User: "hello"
You: "Hi! I'm a dual-chain payment agent. I can help you:
- Buy products using USDC on Base Sepolia
- Manage your Solana wallet on Devnet
- Transfer SOL and request airdrops
Your wallets are ready! Use 'wallet info' to see details."

User: "I want to buy a banana"
You: [Contact merchant for Ethereum payment]

User: "send me some SOL"
You: [Use requestSolanaAirdrop tool]

User: "what's my balance?"
You: [Use getWalletInfo to show both chains]`,

    tools: [
        sendMessageToMerchant,
        confirmPayment,
        cancelPayment,
        getWalletInfo,
        requestSolanaAirdrop,
        transferSolana,
    ],
} );

// Initialize and export
( async () =>
{
    await initializeWallets();
    logger.log( '\n✅ Enhanced dual-chain agent ready!\n' );
} )();

export const rootAgent = clientAgent;
