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
 * Solana Client implementation using Anza Kit
 * Handles Solana blockchain operations on Devnet
 */

import { createSolanaRpc, type Address } from '@solana/kit';
import { logger } from '../logger';

/**
 * Solana Client for managing Solana Devnet RPC operations
 * This is a simplified version that uses the new Anza Kit
 */
export class SolanaClient
{
    private rpc: ReturnType<typeof createSolanaRpc>;
    private rpcUrl: string;

    constructor ( rpcUrl?: string )
    {
        this.rpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        this.rpc = createSolanaRpc( this.rpcUrl );
        logger.log( `🌐 Solana Client connected to: ${ this.rpcUrl }` );
    }

    /**
     * Get account balance
     */
    async getBalance ( address: Address ): Promise<bigint>
    {
        try
        {
            const { value } = await this.rpc.getBalance( address ).send();
            return value;
        } catch ( error )
        {
            logger.error( '❌ Failed to get balance:', error );
            throw error;
        }
    }

    /**
     * Request an airdrop (Devnet only)
     */
    async requestAirdrop ( address: Address, lamports: bigint ): Promise<string>
    {
        try
        {
            logger.log( `💰 Requesting airdrop of ${ lamports } lamports to ${ address }...` );

            const signature = await this.rpc
                .requestAirdrop( address as any, lamports as any )
                .send();

            logger.log( `✅ Airdrop requested: ${ signature }` );
            return signature;
        } catch ( error )
        {
            logger.error( '❌ Airdrop failed:', error );
            throw error;
        }
    }

    /**
     * Get latest blockhash
     */
    async getLatestBlockhash ()
    {
        try
        {
            const { value } = await this.rpc.getLatestBlockhash().send();
            return value;
        } catch ( error )
        {
            logger.error( '❌ Failed to get latest blockhash:', error );
            throw error;
        }
    }

    /**
     * Get slot
     */
    async getSlot (): Promise<bigint>
    {
        try
        {
            const slot = await this.rpc.getSlot().send();
            return slot;
        } catch ( error )
        {
            logger.error( '❌ Failed to get slot:', error );
            throw error;
        }
    }

    /**
     * Get RPC client
     */
    getRpc ()
    {
        return this.rpc;
    }

    /**
     * Get RPC URL
     */
    getRpcUrl (): string
    {
        return this.rpcUrl;
    }
}
