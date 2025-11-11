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
 * Solana Wallet implementation using Anza Kit
 * Handles Solana blockchain operations on Devnet
 */

import
    {
        generateKeyPair,
        createKeyPairFromBytes,
        getAddressFromPublicKey,
        signBytes,
        type Address,
    } from '@solana/keys';
import
    {
        createSolanaRpc,
        devnet,
        lamports,
        createTransactionMessage,
        setTransactionMessageFeePayer,
        setTransactionMessageLifetimeUsingBlockhash,
        appendTransactionMessageInstructions,
        signTransactionMessageWithSigners,
        getSignatureFromTransaction,
        type Rpc,
        type SolanaRpcApiDevnet,
    } from '@solana/kit';
import { pipe } from '@solana/functional';
import { getTransferSolInstruction } from '@solana-program/system';
import { install } from '@solana/webcrypto-ed25519-polyfill';
import { logger } from '../logger';
import * as bs58 from 'bs58';

// Install Web Crypto polyfill for Ed25519
install();

/**
 * Solana Wallet for managing Solana Devnet operations
 */
export class SolanaWallet
{
    private keyPair: CryptoKeyPair;
    private address: Address;
    private rpc: Rpc<SolanaRpcApiDevnet>;

    private constructor (
        keyPair: CryptoKeyPair,
        address: Address,
        rpc: Rpc<SolanaRpcApiDevnet>
    )
    {
        this.keyPair = keyPair;
        this.address = address;
        this.rpc = rpc;
    }

    /**
     * Create a new Solana wallet from a private key (base58 encoded)
     * If no private key is provided, generates a new one
     */
    static async create ( privateKeyBase58?: string, rpcUrl?: string ): Promise<SolanaWallet>
    {
        try
        {
            let keyPair: CryptoKeyPair;

            if ( privateKeyBase58 )
            {
                // Import existing key from base58 string
                const privateKeyBytes = bs58.decode( privateKeyBase58 );
                keyPair = await createKeyPairFromBytes( privateKeyBytes );
                logger.log( '🔑 Imported existing Solana keypair' );
            } else
            {
                // Generate new keypair
                keyPair = await generateKeyPair();
                logger.log( '🔑 Generated new Solana keypair' );
            }

            // Get address from public key
            const address = await getAddressFromPublicKey( keyPair.publicKey );

            // Create RPC client for Devnet
            const url = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
            const rpc = createSolanaRpc( devnet( url ) );

            logger.log( `💼 Solana Wallet initialized: ${ address }` );
            logger.log( `🌐 Connected to: ${ url }` );

            return new SolanaWallet( keyPair, address, rpc );
        } catch ( error )
        {
            logger.error( '❌ Failed to create Solana wallet:', error );
            throw error;
        }
    }

    /**
     * Get the wallet's Solana address
     */
    getAddress (): Address
    {
        return this.address;
    }

    /**
     * Get the wallet's SOL balance
     */
    async getBalance (): Promise<bigint>
    {
        try
        {
            const { value } = await this.rpc.getBalance( this.address ).send();
            return value;
        } catch ( error )
        {
            logger.error( '❌ Failed to get balance:', error );
            throw error;
        }
    }

    /**
     * Request an airdrop of SOL (Devnet only)
     */
    async requestAirdrop ( amount: bigint ): Promise<string>
    {
        try
        {
            logger.log( `💰 Requesting airdrop of ${ amount } lamports...` );

            const signature = await this.rpc
                .requestAirdrop( this.address, lamports( amount ) )
                .send();

            logger.log( `✅ Airdrop requested: ${ signature }` );
            logger.log( '⏳ Waiting for confirmation...' );

            // Wait for confirmation
            await this.confirmTransaction( signature );

            logger.log( `✅ Airdrop confirmed!` );
            return signature;
        } catch ( error )
        {
            logger.error( '❌ Airdrop failed:', error );
            throw error;
        }
    }

    /**
     * Transfer SOL to another address
     */
    async transferSol (
        destination: Address,
        amount: bigint
    ): Promise<{ success: boolean; signature?: string; error?: string }>
    {
        try
        {
            logger.log( `\n💸 Transferring ${ amount } lamports to ${ destination }` );

            // Get recent blockhash
            const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

            // Create transfer instruction
            const transferInstruction = getTransferSolInstruction( {
                source: this.address,
                destination,
                amount: lamports( amount ),
            } );

            // Build transaction message using pipe
            const transactionMessage = pipe(
                createTransactionMessage( { version: 0 } ),
                tx => setTransactionMessageFeePayer( this.address, tx ),
                tx => setTransactionMessageLifetimeUsingBlockhash( latestBlockhash, tx ),
                tx => appendTransactionMessageInstructions( [ transferInstruction ], tx )
            );

            // Create signer from keypair
            const signer = {
                address: this.address,
                keyPair: this.keyPair,
            };

            // Sign transaction
            const signedTransaction = await signTransactionMessageWithSigners(
                transactionMessage,
                [ signer ]
            );

            // Get signature
            const signature = getSignatureFromTransaction( signedTransaction );

            logger.log( `⏳ Transaction sent: ${ signature }` );

            // Send transaction
            await this.rpc.sendTransaction( signedTransaction ).send();

            // Confirm transaction
            await this.confirmTransaction( signature );

            logger.log( `✅ Transfer successful! TX: ${ signature }` );
            return { success: true, signature };
        } catch ( error )
        {
            const errorMessage = error instanceof Error ? error.message : String( error );
            logger.error( '❌ Transfer failed:', errorMessage );
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Sign arbitrary data
     */
    async signData ( data: Uint8Array ): Promise<Uint8Array>
    {
        try
        {
            const signature = await signBytes( this.keyPair.privateKey, data );
            return signature;
        } catch ( error )
        {
            logger.error( '❌ Failed to sign data:', error );
            throw error;
        }
    }

    /**
     * Confirm a transaction
     */
    private async confirmTransaction ( signature: string, maxRetries: number = 30 ): Promise<void>
    {
        let retries = 0;
        while ( retries < maxRetries )
        {
            try
            {
                const { value } = await this.rpc
                    .getSignatureStatuses( [ signature ], { searchTransactionHistory: true } )
                    .send();

                if ( value && value[ 0 ] )
                {
                    const status = value[ 0 ];
                    if ( status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized' )
                    {
                        if ( status.err )
                        {
                            throw new Error( `Transaction failed: ${ JSON.stringify( status.err ) }` );
                        }
                        return;
                    }
                }
            } catch ( error )
            {
                if ( retries === maxRetries - 1 )
                {
                    throw error;
                }
            }

            // Wait 1 second before retry
            await new Promise( resolve => setTimeout( resolve, 1000 ) );
            retries++;
        }

        throw new Error( 'Transaction confirmation timeout' );
    }

    /**
     * Get the RPC client
     */
    getRpc (): Rpc<SolanaRpcApiDevnet>
    {
        return this.rpc;
    }

    /**
     * Export private key as base58 string
     */
    async exportPrivateKey (): Promise<string>
    {
        try
        {
            // Extract private key bytes from CryptoKey
            const privateKeyBytes = await crypto.subtle.exportKey( 'raw', this.keyPair.privateKey );
            return bs58.encode( new Uint8Array( privateKeyBytes ) );
        } catch ( error )
        {
            logger.error( '❌ Failed to export private key:', error );
            throw error;
        }
    }
}
