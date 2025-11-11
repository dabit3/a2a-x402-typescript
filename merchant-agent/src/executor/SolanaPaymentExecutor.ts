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
 * Solana Payment Executor for Merchant Agent
 * 
 * Handles Solana payment verification and settlement in the x402 flow
 */

import { SolanaWallet } from '../wallet/SolanaWallet';
import type { Address } from '@solana/addresses';

export interface SolanaPaymentPayload
{
    from: Address;
    to: Address;
    amount: string;
    signature: string;
    timestamp: number;
    network: string;
}

export interface SolanaPaymentRequirements
{
    scheme: 'exact' | 'up-to';
    network: string;
    asset: string;
    payTo: Address;
    maxAmountRequired: string;
    description: string;
    resource?: string;
    tokenMint?: Address;
    extra?: any;
}

export interface PaymentVerificationResult
{
    isValid: boolean;
    transactionSignature?: string;
    amount?: bigint;
    from?: Address;
    to?: Address;
    error?: string;
}

export class SolanaPaymentExecutor
{
    private wallet: SolanaWallet;

    constructor ( wallet: SolanaWallet )
    {
        this.wallet = wallet;
    }

    /**
     * Verify a Solana payment payload and transaction
     */
    async verifyPayment (
        payload: SolanaPaymentPayload,
        requirements: SolanaPaymentRequirements
    ): Promise<PaymentVerificationResult>
    {
        console.log( '\n🔍 Verifying Solana Payment...' );
        console.log( `   From: ${ payload.from }` );
        console.log( `   To: ${ payload.to }` );
        console.log( `   Amount: ${ payload.amount } lamports` );
        console.log( `   TX Signature: ${ payload.signature }` );

        try
        {
            // 1. Verify payment is to correct address
            if ( payload.to !== requirements.payTo )
            {
                return {
                    isValid: false,
                    error: `Payment sent to wrong address. Expected: ${ requirements.payTo }, Got: ${ payload.to }`,
                };
            }

            // 2. Verify amount matches requirements
            const paymentAmount = BigInt( payload.amount );
            const requiredAmount = BigInt( requirements.maxAmountRequired );

            if ( requirements.scheme === 'exact' && paymentAmount !== requiredAmount )
            {
                return {
                    isValid: false,
                    error: `Incorrect payment amount. Expected: ${ requiredAmount }, Got: ${ paymentAmount }`,
                };
            }

            if ( requirements.scheme === 'up-to' && paymentAmount > requiredAmount )
            {
                return {
                    isValid: false,
                    error: `Payment amount exceeds maximum. Max: ${ requiredAmount }, Got: ${ paymentAmount }`,
                };
            }

            // 3. Verify network
            if ( payload.network !== requirements.network )
            {
                return {
                    isValid: false,
                    error: `Wrong network. Expected: ${ requirements.network }, Got: ${ payload.network }`,
                };
            }

            // 4. Verify signature format (basic check)
            if ( !payload.signature || payload.signature.length < 64 )
            {
                return {
                    isValid: false,
                    error: 'Invalid signature format',
                };
            }

            // 5. Optional: Verify transaction on-chain if signature is a real TX
            // This would check if the transaction actually occurred on the blockchain
            // For now, we'll assume the signature is valid if all other checks pass

            console.log( '   ✅ Payment verification PASSED' );

            return {
                isValid: true,
                transactionSignature: payload.signature,
                amount: paymentAmount,
                from: payload.from,
                to: payload.to,
            };
        } catch ( error )
        {
            console.error( '   ❌ Payment verification FAILED:', error );
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Unknown verification error',
            };
        }
    }

    /**
     * Verify an on-chain transaction (when client provides actual TX signature)
     */
    async verifyOnChainTransaction (
        txSignature: string,
        expectedAmount: bigint,
        expectedFrom?: Address
    ): Promise<PaymentVerificationResult>
    {
        console.log( `\n🔗 Verifying On-Chain Transaction: ${ txSignature }` );

        try
        {
            const verification = await this.wallet.verifyTransaction( txSignature );

            if ( !verification.confirmed )
            {
                return {
                    isValid: false,
                    error: 'Transaction not found or not confirmed',
                };
            }

            console.log( '   ✅ Transaction confirmed on-chain' );
            console.log( `   Block Time: ${ verification.blockTime || 'N/A' }` );

            return {
                isValid: true,
                transactionSignature: txSignature,
                amount: verification.amount,
                from: verification.from,
                to: verification.to,
            };
        } catch ( error )
        {
            console.error( '   ❌ On-chain verification FAILED:', error );
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'On-chain verification failed',
            };
        }
    }

    /**
     * Get current wallet balance
     */
    async getBalance (): Promise<bigint>
    {
        return await this.wallet.getBalance();
    }

    /**
     * Get wallet address
     */
    getAddress (): Address
    {
        return this.wallet.getAddress();
    }
}
