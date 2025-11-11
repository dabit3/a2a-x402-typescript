#!/usr/bin/env tsx
/**
 * Simple verification script for Solana implementation
 */

import { SolanaWallet } from './src/wallet/SolanaWallet';
import { logger } from './src/logger';

async function verify ()
{
    console.log( '\n🔍 Verifying Solana Implementation...\n' );
    console.log( '═'.repeat( 50 ) );

    try
    {
        // Test 1: Create wallet
        console.log( '\n✓ Test 1: Creating Solana wallet...' );
        const wallet = await SolanaWallet.create();
        console.log( `  Address: ${ wallet.getAddress() }` );

        // Test 2: Get RPC client
        console.log( '\n✓ Test 2: Getting RPC client...' );
        const rpc = wallet.getRpc();
        const slot = await rpc.getSlot().send();
        console.log( `  Current slot: ${ slot }` );

        // Test 3: Check balance
        console.log( '\n✓ Test 3: Checking balance...' );
        const balance = await wallet.getBalance();
        console.log( `  Balance: ${ balance } lamports` );

        // Test 4: Get blockhash
        console.log( '\n✓ Test 4: Getting latest blockhash...' );
        const { value: blockhash } = await rpc.getLatestBlockhash().send();
        console.log( `  Blockhash: ${ blockhash.blockhash.substring( 0, 20 ) }...` );

        console.log( '\n═'.repeat( 50 ) );
        console.log( '✅ All verification tests passed!' );
        console.log( '═'.repeat( 50 ) );
        console.log( '\nYour Solana implementation is working correctly!' );
        console.log( '\nNext steps:' );
        console.log( '  1. Run full test: npx tsx test-solana-wallet.ts' );
        console.log( '  2. Check documentation: SOLANA_IMPLEMENTATION.md' );
        console.log( '  3. Start enhanced agent: npm run dev\n' );

    } catch ( error )
    {
        console.error( '\n❌ Verification failed:', error );
        console.error( '\nPlease check:' );
        console.error( '  1. All dependencies are installed (pnpm install)' );
        console.error( '  2. RPC endpoint is accessible' );
        console.error( '  3. Network connection is working\n' );
        process.exit( 1 );
    }
}

verify().catch( console.error );
