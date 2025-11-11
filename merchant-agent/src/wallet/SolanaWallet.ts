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
 * Solana Wallet for Merchant Agent
 * 
 * Simplified wallet implementation for receiving payments and verifying transactions
 */

import
{
    address,
    lamports,
    createSolanaRpc,
    devnet,
    type Rpc,
} from '@solana/kit';
import type { Address } from '@solana/addresses';
import
{
    generateKeyPair,
    createKeyPairFromBytes,
} from '@solana/keys';
import bs58 from 'bs58';

export class SolanaWallet
{
    private keyPair: CryptoKeyPair;
    private walletAddress: Address;
    private rpc: Rpc;

    private constructor (
        keyPair: CryptoKeyPair,
        walletAddress: Address,
        rpcUrl: string
    )
    {
        this.keyPair = keyPair;
        this.walletAddress = walletAddress;
        this.rpc = createSolanaRpc( devnet( rpcUrl ) );
    }

    /**
     * Create a new Solana wallet
     */
    static async create (
        privateKey?: string,
        rpcUrl: string = 'https://api.devnet.solana.com'
    ): Promise<SolanaWallet>
    {
        let keyPair: CryptoKeyPair;
        let walletAddress: Address;

        if ( privateKey )
        {
            // Import from base58 private key
            const privateKeyBytes = bs58.decode( privateKey );
            const { publicKey, privateKey: privKey } = await createKeyPairFromBytes(
                privateKeyBytes
            );
            keyPair = { publicKey, privateKey: privKey };

            // Extract address from public key
            const publicKeyBytes = new Uint8Array(
                await crypto.subtle.exportKey( 'raw', publicKey )
            );
            walletAddress = address( bs58.encode( publicKeyBytes ) );
        } else
        {
            // Generate new keypair
            keyPair = await generateKeyPair();

            // Extract address from public key
            const publicKeyBytes = new Uint8Array(
                await crypto.subtle.exportKey( 'raw', keyPair.publicKey )
            );
            walletAddress = address( bs58.encode( publicKeyBytes ) );
        }

        return new SolanaWallet( keyPair, walletAddress, rpcUrl );
    }

    /**
     * Get the wallet's Solana address
     */
    getAddress (): Address
    {
        return this.walletAddress;
    }

    /**
     * Get the wallet's SOL balance
     */
    async getBalance (): Promise<bigint>
    {
        const { value } = await this.rpc.getBalance( this.walletAddress ).send();
        return value;
    }

    /**
     * Verify that a transaction exists and was confirmed
     */
    async verifyTransaction ( signature: string ): Promise<{
        confirmed: boolean;
        amount?: bigint;
        from?: Address;
        to?: Address;
        blockTime?: number;
    }>
    {
        try
        {
            const { value } = await this.rpc.getTransaction( signature as any, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            } ).send();

            if ( !value )
            {
                return { confirmed: false };
            }

            // Transaction exists and is confirmed
            return {
                confirmed: true,
                blockTime: value.blockTime || undefined,
            };
        } catch ( error )
        {
            console.error( 'Error verifying transaction:', error );
            return { confirmed: false };
        }
    }

    /**
     * Get RPC client for custom operations
     */
    getRpc (): Rpc
    {
        return this.rpc;
    }

    /**
     * Export private key as base58 string
     */
    async exportPrivateKey (): Promise<string>
    {
        const privateKeyBytes = new Uint8Array(
            await crypto.subtle.exportKey( 'pkcs8', this.keyPair.privateKey )
        );

        // Extract the 32-byte Ed25519 private key from PKCS#8 format
        // PKCS#8 format has overhead, actual key starts at offset 16
        const ed25519Key = privateKeyBytes.slice( 16, 48 );

        return bs58.encode( ed25519Key );
    }
}
