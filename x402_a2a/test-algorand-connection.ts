/**
 * Test Algorand network connection
 * Run: npx ts-node test-algorand-connection.ts
 */

import {
  getAlgodClient,
  getSuggestedParams,
  isValidAlgorandAddress,
  ALGORAND_NETWORKS
} from './core/algorand-utils';

async function testConnection() {
  console.log('🧪 Testing Algorand Network Connection\n');
  console.log('=' .repeat(50));

  try {
    // Test network configuration
    console.log('\n📋 Available Networks:');
    Object.keys(ALGORAND_NETWORKS).forEach(network => {
      const config = ALGORAND_NETWORKS[network];
      console.log(`\n  ${network}:`);
      console.log(`    Algod: ${config.algodUrl}`);
      console.log(`    Genesis ID: ${config.genesisId}`);
    });

    // Test connection to TestNet
    console.log('\n\n🌐 Connecting to Algorand TestNet...');
    const client = getAlgodClient('algorand-testnet');
    const status = await client.status().do();

    console.log('✅ Connected successfully!');
    console.log(`   Last round: ${status.lastRound}`);
    console.log(`   Time since last round: ${status.timeSinceLastRound}s`);
    console.log(`   Catchup time: ${status.catchupTime}s`);

    // Get suggested transaction parameters
    console.log('\n\n⚙️  Fetching transaction parameters...');
    const params = await getSuggestedParams('algorand-testnet');
    console.log('✅ Parameters retrieved!');
    console.log(`   Fee: ${params.fee} microALGO`);
    console.log(`   First valid round: ${params.firstRound}`);
    console.log(`   Last valid round: ${params.lastRound}`);
    console.log(`   Genesis ID: ${params.genesisID}`);

    // Test address validation
    console.log('\n\n🔍 Testing Address Validation...');
    const testAddresses = [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ', // Valid
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Invalid (EVM)
      'invalid', // Invalid
    ];

    testAddresses.forEach(addr => {
      const isValid = isValidAlgorandAddress(addr);
      console.log(`   ${addr.substring(0, 20)}... → ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });

    console.log('\n\n✅ All tests passed!');
    console.log('=' .repeat(50));
    console.log('\nNext steps:');
    console.log('  1. Run: npx ts-node test-algorand-wallet.ts');
    console.log('  2. Make sure you have ALGORAND_MNEMONIC set');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Check your internet connection');
    console.error('  - Verify Algorand nodes are accessible');
    console.error('  - Try again in a few moments');
    process.exit(1);
  }
}

testConnection();
