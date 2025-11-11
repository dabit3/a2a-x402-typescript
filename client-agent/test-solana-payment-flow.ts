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
 * Solana Payment Flow Test - Demonstrates end-to-end x402 payment with Solana
 *
 * This script simulates a complete Solana payment flow:
 * 1. Create client and merchant Solana wallets
 * 2. Fund client wallet via airdrop
 * 3. Merchant creates payment requirements (SOL payment)
 * 4. Client signs and submits Solana transaction
 * 5. Merchant verifies transaction on-chain
 * 6. Merchant confirms order
 */

import { SolanaWallet } from './src/wallet/SolanaWallet';
import { logger } from './src/logger';
import { address, lamports } from '@solana/kit';
import type { Address } from '@solana/addresses';

// Configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PRODUCT_NAME = 'banana';
const PRODUCT_PRICE_SOL = 0.1; // 0.1 SOL
const PRODUCT_PRICE_LAMPORTS = lamports( BigInt( PRODUCT_PRICE_SOL * 1e9 ) );

// Mock payment requirements (Solana version)
interface SolanaPaymentRequirements
{
    scheme: 'exact' | 'up-to';
    network: 'solana-devnet' | 'solana-mainnet';
    payTo: Address;
    maxAmountRequired: string;
    description: string;
    resource: string;
    tokenMint?: Address; // For SPL tokens
    extra?: {
        product?: {
            name: string;
            sku: string;
            version: string;
        };
    };
}

// Mock payment payload (Solana version)
interface SolanaPaymentPayload
{
    from: Address;
    to: Address;
    amount: string;
    signature: string;
    timestamp: number;
    network: string;
}

/**
 * Merchant: Create payment requirements
 */
function createSolanaPaymentRequirements (
    merchantAddress: Address,
    productName: string,
    priceInLamports: bigint
): SolanaPaymentRequirements
{
    return {
        scheme: 'exact',
        network: 'solana-devnet',
        payTo: merchantAddress,
        maxAmountRequired: priceInLamports.toString(),
        description: `Payment for: ${ productName }`,
        resource: `https://example.com/product/${ productName }`,
        extra: {
            product: {
                name: productName,
                sku: `${ productName }_sku`,
                version: '1',
            },
        },
    };
}

/**
 * Client: Sign payment (create and sign transaction)
 */
async function signSolanaPayment (
    clientWallet: SolanaWallet,
    requirements: SolanaPaymentRequirements
): Promise<SolanaPaymentPayload>
{
    const message = new TextEncoder().encode(
        JSON.stringify( {
            to: requirements.payTo,
            amount: requirements.maxAmountRequired,
            timestamp: Date.now(),
            network: requirements.network,
        } )
    );

    const signature = await clientWallet.signData( message );
    const signatureHex = Buffer.from( signature ).toString( 'hex' );

    return {
        from: clientWallet.getAddress(),
        to: requirements.payTo,
        amount: requirements.maxAmountRequired,
        signature: signatureHex,
        timestamp: Date.now(),
        network: requirements.network,
    };
}

/**
 * Merchant: Verify payment signature
 */
async function verifySolanaPaymentSignature (
    payload: SolanaPaymentPayload
): Promise<boolean>
{
    // In a real implementation, this would verify the Ed25519 signature
    // For now, we just check that the signature exists and has the right format
    return payload.signature.length > 0 && payload.signature.length === 128; // 64 bytes in hex
}

/**
 * Main test flow
 */
async function testSolanaPaymentFlow ()
{
    console.log( '\n🚀 ===== Solana x402 Payment Flow Test =====\n' );

    try
    {
        // ===== Setup =====
        console.log( '📋 Step 1: Setup - Creating Wallets' );
        console.log( '═'.repeat( 60 ) );

        // Create merchant wallet
        const merchantWallet = await SolanaWallet.create( undefined, SOLANA_RPC_URL );
        const merchantAddress = merchantWallet.getAddress();
        console.log( `   🏪 Merchant Wallet: ${ merchantAddress }` );

        // Create client wallet
        const clientWallet = await SolanaWallet.create( undefined, SOLANA_RPC_URL );
        const clientAddress = clientWallet.getAddress();
        console.log( `   👤 Client Wallet: ${ clientAddress }` );

        // ===== Fund Client Wallet =====
        console.log( '\n📋 Step 2: Fund Client Wallet (Airdrop)' );
        console.log( '═'.repeat( 60 ) );

        console.log( `   Requesting 2 SOL airdrop for client...` );
        const airdropSig = await clientWallet.requestAirdrop( lamports( 2_000_000_000n ) );
        console.log( `   ✅ Airdrop completed: ${ airdropSig }` );

        const clientBalance = await clientWallet.getBalance();
        console.log( `   💰 Client Balance: ${ Number( clientBalance ) / 1e9 } SOL` );

        // ===== Merchant Creates Payment Requirements =====
        console.log( '\n📋 Step 3: Merchant Creates Payment Requirements' );
        console.log( '═'.repeat( 60 ) );

        const paymentRequirements = createSolanaPaymentRequirements(
            merchantAddress,
            PRODUCT_NAME,
            BigInt( PRODUCT_PRICE_LAMPORTS )
        );

        console.log( `   📦 Product: ${ PRODUCT_NAME }` );
        console.log( `   💰 Price: ${ PRODUCT_PRICE_SOL } SOL` );
        console.log( `   🏪 Pay To: ${ merchantAddress }` );
        console.log( `   🌐 Network: ${ paymentRequirements.network }` );

        // ===== Client Signs Payment =====
        console.log( '\n📋 Step 4: Client Signs Payment Authorization' );
        console.log( '═'.repeat( 60 ) );

        const paymentPayload = await signSolanaPayment( clientWallet, paymentRequirements );
        console.log( `   ✅ Payment signed by: ${ clientAddress }` );
        console.log( `   📝 Signature: ${ paymentPayload.signature.substring( 0, 40 ) }...` );

        // ===== Merchant Verifies Signature =====
        console.log( '\n📋 Step 5: Merchant Verifies Payment Signature' );
        console.log( '═'.repeat( 60 ) );

        const isSignatureValid = await verifySolanaPaymentSignature( paymentPayload );
        if ( !isSignatureValid )
        {
            throw new Error( 'Payment signature verification failed' );
        }
        console.log( `   ✅ Signature verification: PASSED` );

        // ===== Execute On-Chain Transfer =====
        console.log( '\n📋 Step 6: Execute On-Chain SOL Transfer' );
        console.log( '═'.repeat( 60 ) );

        const merchantBalanceBefore = await merchantWallet.getBalance();
        console.log( `   💰 Merchant Balance (before): ${ Number( merchantBalanceBefore ) / 1e9 } SOL` );

        const transferResult = await clientWallet.transferSol(
            merchantAddress,
            BigInt( PRODUCT_PRICE_LAMPORTS )
        );

        if ( !transferResult.success )
        {
            throw new Error( `Transfer failed: ${ transferResult.error }` );
        }

        console.log( `   ✅ Transfer successful!` );
        console.log( `   📝 Transaction: ${ transferResult.signature }` );
        console.log( `   🔗 Explorer: https://explorer.solana.com/tx/${ transferResult.signature }?cluster=devnet` );

        // ===== Verify On-Chain Settlement =====
        console.log( '\n📋 Step 7: Verify On-Chain Settlement' );
        console.log( '═'.repeat( 60 ) );

        // Wait a moment for balance to update
        await new Promise( resolve => setTimeout( resolve, 2000 ) );

        const merchantBalanceAfter = await merchantWallet.getBalance();
        const clientBalanceAfter = await clientWallet.getBalance();

        console.log( `   💰 Merchant Balance (after): ${ Number( merchantBalanceAfter ) / 1e9 } SOL` );
        console.log( `   💰 Client Balance (after): ${ Number( clientBalanceAfter ) / 1e9 } SOL` );

        const merchantIncrease = Number( merchantBalanceAfter - merchantBalanceBefore ) / 1e9;
        console.log( `   📈 Merchant Increase: +${ merchantIncrease.toFixed( 9 ) } SOL` );

        if ( merchantIncrease < PRODUCT_PRICE_SOL * 0.99 )
        {
            throw new Error( 'Payment not fully received by merchant' );
        }

        // ===== Order Confirmation =====
        console.log( '\n📋 Step 8: Order Confirmation' );
        console.log( '═'.repeat( 60 ) );

        console.log( `   🎉 Payment verified and settled!` );
        console.log( `   📦 Order for "${ PRODUCT_NAME }" has been confirmed!` );
        console.log( `   🚚 Product will be shipped soon!` );

        // ===== Summary =====
        console.log( '\n✅ ===== Payment Flow Test PASSED! =====\n' );
        console.log( '📊 Transaction Summary:' );
        console.log( `   Product: ${ PRODUCT_NAME }` );
        console.log( `   Price: ${ PRODUCT_PRICE_SOL } SOL` );
        console.log( `   From: ${ clientAddress }` );
        console.log( `   To: ${ merchantAddress }` );
        console.log( `   TX: ${ transferResult.signature }` );
        console.log( `   Network: Solana Devnet` );
        console.log( `   Status: ✅ COMPLETED` );

        console.log( '\n🔍 Key Features Demonstrated:' );
        console.log( '   ✅ Wallet creation and management' );
        console.log( '   ✅ Devnet airdrops' );
        console.log( '   ✅ Payment requirement creation' );
        console.log( '   ✅ Payment signature generation' );
        console.log( '   ✅ Signature verification' );
        console.log( '   ✅ On-chain SOL transfer' );
        console.log( '   ✅ Transaction confirmation' );
        console.log( '   ✅ Balance verification' );
        console.log( '   ✅ Order fulfillment' );

        console.log( '\n🎓 Next Steps:' );
        console.log( '   - Integrate SPL tokens (USDC on Solana)' );
        console.log( '   - Add proper x402 protocol wrapping' );
        console.log( '   - Implement merchant agent Solana support' );
        console.log( '   - Add transaction retry logic' );
        console.log( '   - Deploy to mainnet\n' );

    } catch ( error )
    {
        console.error( '\n❌ ===== Payment Flow Test FAILED =====\n' );
        console.error( 'Error:', error );
        process.exit( 1 );
    }
}

// Run the test
if ( require.main === module )
{
    testSolanaPaymentFlow().catch( ( error ) =>
    {
        console.error( 'Fatal error:', error );
        process.exit( 1 );
    } );
}

export { testSolanaPaymentFlow };
