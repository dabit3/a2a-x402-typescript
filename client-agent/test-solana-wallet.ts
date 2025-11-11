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
 * Test script for Solana Wallet implementation
 * Demonstrates full Solana workflow on Devnet using Anza Kit
 */

import { SolanaWallet } from './src/wallet/SolanaWallet';
import { logger } from './src/logger';
import { address, lamports } from '@solana/kit';

async function testSolanaWallet ()
{
    console.log( '\n🚀 Starting Solana Wallet Test (Devnet)\n' );
    console.log( '═'.repeat( 60 ) );

    try
    {
        // Step 1: Create a new Solana wallet
        logger.log( '\n📝 Step 1: Creating Solana Wallet...' );
        const wallet = await SolanaWallet.create();

        const walletAddress = wallet.getAddress();
        logger.log( `✅ Wallet created: ${ walletAddress }` );

        // Step 2: Check initial balance
        logger.log( '\n📝 Step 2: Checking initial balance...' );
        let balance = await wallet.getBalance();
        logger.log( `💰 Balance: ${ balance } lamports (${ Number( balance ) / 1e9 } SOL)` );

        // Step 3: Request airdrop (Devnet only)
        logger.log( '\n📝 Step 3: Requesting airdrop...' );
        const airdropAmount = lamports( 2_000_000_000n ); // 2 SOL
        const airdropSig = await wallet.requestAirdrop( airdropAmount );
        logger.log( `✅ Airdrop signature: ${ airdropSig }` );

        // Step 4: Check balance after airdrop
        logger.log( '\n📝 Step 4: Checking balance after airdrop...' );
        balance = await wallet.getBalance();
        logger.log( `💰 New balance: ${ balance } lamports (${ Number( balance ) / 1e9 } SOL)` );

        // Step 5: Create a second wallet for transfer test
        logger.log( '\n📝 Step 5: Creating recipient wallet...' );
        const recipientWallet = await SolanaWallet.create();
        const recipientAddress = recipientWallet.getAddress();
        logger.log( `✅ Recipient wallet: ${ recipientAddress }` );

        // Step 6: Transfer SOL
        logger.log( '\n📝 Step 6: Transferring SOL...' );
        const transferAmount = 500_000_000n; // 0.5 SOL
        const transferResult = await wallet.transferSol(
            recipientAddress,
            transferAmount
        );

        if ( transferResult.success )
        {
            logger.log( `✅ Transfer successful!` );
            logger.log( `   Transaction: ${ transferResult.signature }` );
        } else
        {
            logger.error( `❌ Transfer failed: ${ transferResult.error }` );
        }

        // Step 7: Check final balances
        logger.log( '\n📝 Step 7: Checking final balances...' );
        const senderBalance = await wallet.getBalance();
        const recipientBalance = await recipientWallet.getBalance();

        logger.log( `💰 Sender balance: ${ senderBalance } lamports (${ Number( senderBalance ) / 1e9 } SOL)` );
        logger.log( `💰 Recipient balance: ${ recipientBalance } lamports (${ Number( recipientBalance ) / 1e9 } SOL)` );

        // Step 8: Sign arbitrary data
        logger.log( '\n📝 Step 8: Testing signature functionality...' );
        const message = new TextEncoder().encode( 'Hello, Solana!' );
        const signature = await wallet.signData( message );
        logger.log( `✅ Signature created: ${ signature.length } bytes` );

        // Step 9: Export private key (for backup)
        logger.log( '\n📝 Step 9: Exporting private key...' );
        const privateKey = await wallet.exportPrivateKey();
        logger.log( `🔑 Private key (base58): ${ privateKey.substring( 0, 20 ) }...` );
        logger.log( '   ⚠️  Keep this secure! Never share it!' );

        // Step 10: Test RPC methods
        logger.log( '\n📝 Step 10: Testing RPC methods...' );
        const rpc = wallet.getRpc();
        const slot = await rpc.getSlot().send();
        logger.log( `📊 Current slot: ${ slot }` );

        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
        logger.log( `📦 Latest blockhash: ${ latestBlockhash.blockhash }` );
        logger.log( `📏 Last valid block height: ${ latestBlockhash.lastValidBlockHeight }` );

        console.log( '\n═'.repeat( 60 ) );
        console.log( '✅ All tests completed successfully!' );
        console.log( '═'.repeat( 60 ) );

    } catch ( error )
    {
        console.error( '\n❌ Test failed:', error );
        process.exit( 1 );
    }
}

// Run the test
testSolanaWallet().catch( console.error );
