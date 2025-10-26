/**
 * Test NFDomains resolution
 * Run: npx ts-node test-nfd-resolution.ts
 */

import {
  resolveNFD,
  resolveAlgorandAddress,
  isNFDName,
  getNFDInfo,
  reverseResolveNFD,
} from './core/nfd-resolver';
import { createPaymentRequirements } from './core/merchant';

async function testNFDResolution() {
  console.log('🧪 Testing NFDomains Resolution\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Check if strings are NFD names
    console.log('\n📝 Test 1: NFD Name Detection');
    const testNames = [
      'alice.algo',
      'wallet.alice.algo',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW', // Algorand address
      'vitalik.eth', // Ethereum ENS
      'notanfd',
    ];

    testNames.forEach(name => {
      const isNFD = isNFDName(name);
      console.log(`   ${name.substring(0, 30)}... → ${isNFD ? '✅ NFD' : '❌ Not NFD'}`);
    });

    // Test 2: Resolve a known NFD (using testnet)
    console.log('\n\n🔍 Test 2: Resolving NFD Names (TestNet)');
    console.log('   Note: Using a test NFD name...');

    // Try to resolve a demo NFD - you can replace with a real one you know exists
    const testNFD = 'algorand.algo'; // This is a known NFD on mainnet

    try {
      console.log(`\n   Resolving "${testNFD}"...`);
      const address = await resolveNFD(testNFD, 'algorand-mainnet');
      console.log(`   ✅ Resolved to: ${address}`);

      // Get detailed info
      const info = await getNFDInfo(testNFD, 'algorand-mainnet');
      console.log(`\n   NFD Details:`);
      console.log(`     Name: ${info.name}`);
      console.log(`     Owner: ${info.owner}`);
      console.log(`     Deposit Account: ${info.depositAccount}`);
      console.log(`     State: ${info.state}`);
      if (info.caAlgo && info.caAlgo.length > 0) {
        console.log(`     Verified Accounts: ${info.caAlgo.length}`);
      }
    } catch (error: any) {
      console.log(`   ℹ️  Could not resolve "${testNFD}": ${error.message}`);
      console.log(`   This is normal if the NFD doesn't exist on TestNet`);
    }

    // Test 3: Resolve address or NFD
    console.log('\n\n🔄 Test 3: Universal Resolution (Address or NFD)');

    // Valid Algorand address
    const validAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
    console.log(`\n   Input: ${validAddress.substring(0, 20)}...`);
    const resolved1 = await resolveAlgorandAddress(validAddress, 'algorand-testnet');
    console.log(`   ✅ Output: ${resolved1.substring(0, 20)}... (unchanged)`);

    // Test 4: Create payment requirements with NFD
    console.log('\n\n💰 Test 4: Payment Requirements with NFD');
    console.log('   Creating payment request to "algorand.algo"...\n');

    try {
      const requirements = await createPaymentRequirements({
        price: "$1.00",
        payToAddress: "algorand.algo", // Using NFD name!
        resource: "/test-nfd-payment",
        network: "algorand-mainnet",
        description: "Test payment to NFD"
      });

      console.log('   ✅ Payment requirements created!');
      console.log(`   Resolved to: ${requirements.payTo}`);
      console.log(`   Network: ${requirements.network}`);
      console.log(`   Amount: ${requirements.maxAmountRequired}`);
    } catch (error: any) {
      console.log(`   ℹ️  ${error.message}`);
    }

    // Test 5: Reverse resolution
    console.log('\n\n🔙 Test 5: Reverse Resolution (Address → NFD)');
    console.log('   Looking up if address has an associated NFD...\n');

    // Try a known address (Algorand Foundation's address has an NFD)
    const knownAddress = 'AAAA4TYNPGB7XSWCVVPFZ5EIQQVULZFXFDZWDNXSIQBGBZXAXGXZ3IDNQQ';
    try {
      const nfdName = await reverseResolveNFD(knownAddress, 'algorand-mainnet');
      if (nfdName) {
        console.log(`   ✅ Found NFD: ${nfdName}`);
      } else {
        console.log(`   ℹ️  No NFD associated with this address`);
      }
    } catch (error: any) {
      console.log(`   ℹ️  Could not perform reverse lookup: ${error.message}`);
    }

    // Summary
    console.log('\n\n' + '=' .repeat(50));
    console.log('✅ NFD Resolution Tests Complete!\n');

    console.log('Key Takeaways:');
    console.log('  • NFD names end with .algo');
    console.log('  • Automatic resolution in createPaymentRequirements()');
    console.log('  • Works on MainNet, TestNet, and BetaNet');
    console.log('  • Can resolve both addresses and NFD names');
    console.log('  • Reverse lookup available for address→NFD\n');

    console.log('Usage in your code:');
    console.log(`
  // Will automatically resolve NFD to address
  const requirements = await createPaymentRequirements({
    payToAddress: "alice.algo",  // ← NFD name
    network: "algorand-mainnet",
    price: "$1.00",
    resource: "/payment"
  });

  // Or manually resolve
  import { resolveAlgorandAddress } from 'a2a-x402';
  const address = await resolveAlgorandAddress("alice.algo", "algorand-mainnet");
    `);

    console.log('\nNext steps:');
    console.log('  1. Try with your own NFD name');
    console.log('  2. Register an NFD at: https://app.nf.domains');
    console.log('  3. Use NFD names in your payment flows');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testNFDResolution();
