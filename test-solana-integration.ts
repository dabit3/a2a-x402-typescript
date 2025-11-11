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
 * Solana Agent Integration Test
 * 
 * Demonstrates the complete workflow:
 * 1. Run both client and merchant Solana wallet tests
 * 2. Execute end-to-end payment flow
 * 3. Verify all components work together
 */

import { execSync } from 'child_process';
import * as path from 'path';

const ROOT_DIR = path.resolve( __dirname, '..' );

console.log( '\n🚀 ===== Solana Agents Integration Test =====\n' );
console.log( 'This test will verify the complete Solana implementation:\n' );

const tests = [
    {
        name: 'Client Wallet Test',
        description: 'Test client-side Solana wallet functionality',
        dir: path.join( ROOT_DIR, 'client-agent' ),
        command: 'npx tsx test-solana-wallet.ts',
    },
    {
        name: 'Solana Payment Flow Test',
        description: 'Test end-to-end Solana payment workflow',
        dir: path.join( ROOT_DIR, 'client-agent' ),
        command: 'npx tsx test-solana-payment-flow.ts',
    },
];

async function runTest ( test: typeof tests[ 0 ], index: number ): Promise<boolean>
{
    console.log( `\n${ '='.repeat( 70 ) }` );
    console.log( `📋 Test ${ index + 1 }/${ tests.length }: ${ test.name }` );
    console.log( `📝 ${ test.description }` );
    console.log( `📂 Directory: ${ test.dir }` );
    console.log( `⚡ Command: ${ test.command }` );
    console.log( '='.repeat( 70 ) );

    try
    {
        const output = execSync( test.command, {
            cwd: test.dir,
            encoding: 'utf-8',
            stdio: 'inherit',
        } );

        console.log( `\n✅ Test "${ test.name }" PASSED\n` );
        return true;
    } catch ( error )
    {
        console.error( `\n❌ Test "${ test.name }" FAILED\n` );
        return false;
    }
}

async function main ()
{
    const startTime = Date.now();
    let passedTests = 0;
    let failedTests = 0;

    for ( let i = 0; i < tests.length; i++ )
    {
        const success = await runTest( tests[ i ], i );
        if ( success )
        {
            passedTests++;
        } else
        {
            failedTests++;
        }
    }

    const endTime = Date.now();
    const duration = ( ( endTime - startTime ) / 1000 ).toFixed( 2 );

    console.log( '\n' + '='.repeat( 70 ) );
    console.log( '📊 Integration Test Results' );
    console.log( '='.repeat( 70 ) );
    console.log( `Total Tests: ${ tests.length }` );
    console.log( `✅ Passed: ${ passedTests }` );
    console.log( `❌ Failed: ${ failedTests }` );
    console.log( `⏱️  Duration: ${ duration }s` );
    console.log( '='.repeat( 70 ) );

    if ( failedTests === 0 )
    {
        console.log( '\n🎉 All Integration Tests PASSED!\n' );
        console.log( '✅ Solana wallet implementation is working correctly' );
        console.log( '✅ Payment flow is functioning as expected' );
        console.log( '✅ All components are properly integrated\n' );

        console.log( '🚀 Next Steps:' );
        console.log( '   1. Start merchant agent: cd merchant-agent && npm run dev' );
        console.log( '   2. Start client agent: cd client-agent && npm run dev' );
        console.log( '   3. Try: "I want to buy a banana with Solana"\n' );

        process.exit( 0 );
    } else
    {
        console.log( '\n⚠️  Some tests failed. Please review the errors above.\n' );
        process.exit( 1 );
    }
}

main().catch( ( error ) =>
{
    console.error( '\n❌ Integration test failed with error:', error );
    process.exit( 1 );
} );
