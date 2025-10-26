/**
 * Test Algorand wallet functions
 * Run: ALGORAND_MNEMONIC="your mnemonic" npx ts-node test-algorand-wallet.ts
 */

import {
  generateAccount,
  accountFromMnemonic,
} from './core/algorand-wallet';
import {
  getAlgodClient,
} from './core/algorand-utils';

async function testWallet() {
  console.log('🧪 Testing Algorand Wallet Functions\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Generate new account
    console.log('\n🔑 Test 1: Generating New Account...');
    const newAccount = generateAccount();
    console.log('✅ Account generated!');
    console.log(`   Address: ${newAccount.address}`);
    console.log(`   Mnemonic: ${newAccount.mnemonic.substring(0, 50)}...`);
    console.log('\n   ⚠️  Save this mnemonic if you want to use this account!');

    // Test 2: Restore from mnemonic
    console.log('\n\n🔓 Test 2: Restoring Account from Mnemonic...');
    const mnemonic = process.env.ALGORAND_MNEMONIC;

    if (!mnemonic) {
      console.log('⚠️  ALGORAND_MNEMONIC not set, using generated account');
      console.log('   To test with your account, run:');
      console.log('   ALGORAND_MNEMONIC="your 25 word phrase" npx ts-node test-algorand-wallet.ts\n');
      return;
    }

    const account = accountFromMnemonic(mnemonic);
    console.log('✅ Account restored!');
    console.log(`   Address: ${account.address}`);

    // Test 3: Check balance
    console.log('\n\n💰 Test 3: Checking Account Balance...');
    const client = getAlgodClient('algorand-testnet');
    const accountInfo = await client.accountInformation(account.address).do();

    const algoBalance = Number(accountInfo.amount) / 1_000_000;
    const minBalance = Number(accountInfo.minBalance) / 1_000_000;

    console.log('✅ Balance retrieved!');
    console.log(`   ALGO Balance: ${algoBalance.toFixed(6)} ALGO`);
    console.log(`   Min Balance: ${minBalance.toFixed(6)} ALGO`);
    console.log(`   Available: ${(algoBalance - minBalance).toFixed(6)} ALGO`);

    if (algoBalance < 0.1) {
      console.log('\n   ⚠️  Low balance! Get test ALGO from:');
      console.log('   https://bank.testnet.algorand.network/');
    }

    // Test 4: Check ASA holdings
    console.log('\n\n🪙  Test 4: Checking ASA Holdings...');
    const assets = accountInfo.assets || [];

    if (assets.length === 0) {
      console.log('   No ASAs held');
      console.log('   💡 The wallet will auto opt-in to USDC when making a payment');
    } else {
      console.log(`   Total ASAs: ${assets.length}`);
      assets.forEach((asset: any) => {
        const assetId = asset['asset-id'];
        const amount = asset.amount;
        let assetName = `ASA ${assetId}`;

        // Known assets
        if (assetId === 10458941) assetName = 'USDC (TestNet)';
        if (assetId === 31566704) assetName = 'USDC (MainNet)';

        console.log(`   - ${assetName}: ${amount} units`);
      });
    }

    // Summary
    console.log('\n\n' + '=' .repeat(50));
    console.log('✅ All wallet tests passed!');
    console.log('\nAccount Summary:');
    console.log(`  Address: ${account.address}`);
    console.log(`  Balance: ${algoBalance.toFixed(6)} ALGO`);
    console.log(`  ASAs: ${assets.length}`);
    console.log(`  TestNet Explorer: https://testnet.algoexplorer.io/address/${account.address}`);

    console.log('\nNext steps:');
    console.log('  1. Ensure you have at least 0.5 ALGO');
    console.log('  2. Run: npx ts-node test-algorand-payment.ts');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);

    if (error.message.includes('mnemonic')) {
      console.error('\nMnemonic Error:');
      console.error('  - Ensure your mnemonic has exactly 25 words');
      console.error('  - Words should be lowercase and space-separated');
    } else if (error.message.includes('account not found')) {
      console.error('\nAccount Not Found:');
      console.error('  - This account may not be funded yet');
      console.error('  - Get test ALGO: https://bank.testnet.algorand.network/');
    }

    process.exit(1);
  }
}

testWallet();
