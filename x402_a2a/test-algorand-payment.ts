/**
 * Test Algorand payment signing and settlement
 * Run: ALGORAND_MNEMONIC="your mnemonic" npx ts-node test-algorand-payment.ts
 */

import {
  accountFromMnemonic,
  processAlgorandPayment,
} from './core/algorand-wallet';
import {
  verifyAlgorandPayment,
  settleAlgorandPayment,
} from './core/algorand-facilitator';
import { createPaymentRequirements } from './core/merchant';
import { PaymentRequirements } from './types/state';

async function testPayment() {
  console.log('🧪 Testing Algorand Payment Flow\n');
  console.log('=' .repeat(50));

  try {
    // Step 0: Setup
    const mnemonic = process.env.ALGORAND_MNEMONIC;
    if (!mnemonic) {
      console.error('❌ ALGORAND_MNEMONIC environment variable not set\n');
      console.log('Usage:');
      console.log('  ALGORAND_MNEMONIC="your 25 word phrase" npx ts-node test-algorand-payment.ts\n');
      process.exit(1);
    }

    const account = accountFromMnemonic(mnemonic);
    console.log(`\n💼 Using account: ${account.address}\n`);

    // Step 1: Create payment requirements (pay to self for testing)
    console.log('📝 Step 1: Creating Payment Requirements...');
    const requirements: PaymentRequirements = await createPaymentRequirements({
      price: "$0.01", // Very small amount for testing
      payToAddress: account.address, // Pay to self for testing
      resource: "/test-payment",
      network: "algorand-testnet",
      description: "Test payment - self transfer",
    });

    console.log('✅ Requirements created!');
    console.log(`   Network: ${requirements.network}`);
    console.log(`   Asset: ${requirements.asset} (USDC ASA ID)`);
    console.log(`   Amount: ${requirements.maxAmountRequired} micro-units ($0.01)`);
    console.log(`   From: ${account.address}`);
    console.log(`   To: ${requirements.payTo}`);

    // Step 2: Sign the payment
    console.log('\n\n✍️  Step 2: Signing Payment...');
    const paymentPayload = await processAlgorandPayment(
      requirements,
      account
    );

    console.log('✅ Payment signed!');
    console.log(`   Transaction ID: ${(paymentPayload.payload as any).txnId}`);
    console.log(`   Signature: ${(paymentPayload.payload as any).signature.substring(0, 40)}...`);

    // Step 3: Verify the payment locally
    console.log('\n\n🔍 Step 3: Verifying Payment Signature...');
    const verifyResult = await verifyAlgorandPayment(
      paymentPayload,
      requirements
    );

    if (!verifyResult.isValid) {
      console.error('❌ Verification failed:', verifyResult.invalidReason);
      process.exit(1);
    }

    console.log('✅ Payment verified!');
    console.log(`   Payer: ${verifyResult.payer}`);
    console.log(`   Valid: ${verifyResult.isValid}`);

    // Step 4: Confirm before settlement
    console.log('\n\n⚠️  Step 4: Ready to Submit to Blockchain');
    console.log('   This will:');
    console.log('   - Submit the transaction to Algorand TestNet');
    console.log('   - Deduct transaction fees (~0.001 ALGO)');
    console.log('   - Transfer 0.01 USDC to yourself (if opted in)');
    console.log('   - May trigger ASA opt-in (~0.1 ALGO if needed)');

    // Auto-proceed for testing (in production, you'd want user confirmation)
    console.log('\n   Proceeding with settlement...\n');

    // Step 5: Settle (submit to blockchain)
    console.log('🚀 Step 5: Submitting to Blockchain...');
    const settleResult = await settleAlgorandPayment(
      paymentPayload,
      requirements
    );

    if (!settleResult.success) {
      console.error('❌ Settlement failed:', settleResult.errorReason);
      console.error('\nCommon issues:');
      console.error('  - Insufficient ALGO balance (need ~0.5 ALGO)');
      console.error('  - Not opted into USDC ASA (0.1 ALGO required)');
      console.error('  - Transaction expired (regenerate payment)');
      process.exit(1);
    }

    console.log('✅ Transaction submitted and confirmed!');
    console.log(`   Transaction ID: ${settleResult.transaction}`);
    console.log(`   Network: ${settleResult.network}`);
    console.log(`   Payer: ${settleResult.payer}`);

    // Success!
    console.log('\n\n' + '=' .repeat(50));
    console.log('🎉 Payment Flow Complete!\n');
    console.log('View transaction on explorer:');
    console.log(`https://testnet.algoexplorer.io/tx/${settleResult.transaction}\n`);

    console.log('What happened:');
    console.log('  1. Created payment requirements for 0.01 USDC');
    console.log('  2. Signed transaction with your private key');
    console.log('  3. Verified signature locally');
    console.log('  4. Submitted to Algorand TestNet');
    console.log('  5. Transaction confirmed on-chain\n');

    console.log('Next steps:');
    console.log('  - View your transaction on the explorer');
    console.log('  - Try with different amounts');
    console.log('  - Test with different recipient addresses');
    console.log('  - Integrate into your agents');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);

    if (error.message.includes('underfunded')) {
      console.error('\nInsufficient Funds:');
      console.error('  Get test ALGO: https://bank.testnet.algorand.network/');
    } else if (error.message.includes('asset') || error.message.includes('opt')) {
      console.error('\nASA Opt-in Issue:');
      console.error('  You may need to opt into the USDC ASA');
      console.error('  The library should handle this automatically');
      console.error('  Ensure you have at least 0.1 ALGO for opt-in');
    } else if (error.message.includes('expired')) {
      console.error('\nTransaction Expired:');
      console.error('  Run the test again to generate a new transaction');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testPayment();
