// Copyright 2025 Google LLC
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
 * Test Payment Flow - Demonstrates end-to-end x402 payment processing
 *
 * This script simulates a complete payment flow:
 * 1. Merchant agent receives product request
 * 2. Agent throws payment exception with requirements
 * 3. Client receives requirements and signs payment
 * 4. Merchant verifies and settles payment
 * 5. Merchant confirms order
 */

import { Wallet } from 'ethers';
import {
  x402Utils,
  processPayment,
  createPaymentSubmissionMessage,
  PaymentRequirements,
  Task,
  TaskState,
  Message,
} from 'x402-a2a-typescript';
import { MerchantServerExecutor } from './executor/MerchantServerExecutor';
import { createHash } from 'crypto';

// Mock agent executor for testing
class MockAgentExecutor {
  private paymentVerified = false;

  async execute(context: any, eventQueue: any): Promise<void> {
    console.log('\n📝 Mock Agent Executor: Processing request...');

    // If payment has been verified, confirm the order
    if (this.paymentVerified) {
      console.log('   ✅ Payment verified! Confirming order...');
      const message: Message = {
        messageId: 'msg-confirm',
        role: 'agent',
        parts: [{
          kind: 'text',
          text: 'Great! Your order for a banana has been confirmed! 🎉 Your product will be shipped soon!'
        }],
      };

      await eventQueue.enqueueEvent({
        id: context.taskId,
        status: {
          state: TaskState.COMPLETED,
          message,
        },
      });
      return;
    }

    // Simulate the agent tool being called
    const productName = "banana";
    const price = getProductPrice(productName);
    const priceUSDC = (parseInt(price) / 1_000_000).toFixed(6);

    console.log(`   Product: ${productName}`);
    console.log(`   Price: ${priceUSDC} USDC`);

    // Import to throw the exception
    const { x402PaymentRequiredException } = await import('x402-a2a-typescript');

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: "base-sepolia",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      maxAmountRequired: price,
      description: `Payment for: ${productName}`,
      resource: `https://example.com/product/${productName}`,
      mimeType: "application/json",
      maxTimeoutSeconds: 1200,
      extra: {
        name: "USDC",
        version: "2",
        product: {
          sku: `${productName}_sku`,
          name: productName,
          version: "1",
        },
      },
    };

    throw new x402PaymentRequiredException(
      `Payment required for ${productName}`,
      requirements
    );
  }

  markPaymentVerified(): void {
    this.paymentVerified = true;
  }
}

function getProductPrice(productName: string): string {
  const hash = createHash('sha256').update(productName.toLowerCase()).digest();
  const hashNumber = BigInt('0x' + hash.toString('hex'));
  const price = Number(hashNumber % 99900001n + 100000n);
  return price.toString();
}

// Mock event queue
class MockEventQueue {
  private events: Task[] = [];

  async enqueueEvent(task: Task): Promise<void> {
    this.events.push(task);
    console.log(`\n📨 Event Enqueued: Task ${task.id} - State: ${task.status.state}`);
    if (task.status.message?.metadata) {
      const status = task.status.message.metadata['x402.payment.status'];
      if (status) {
        console.log(`   Payment Status: ${status}`);
      }
    }
  }

  getEvents(): Task[] {
    return this.events;
  }

  getLatestTask(): Task | undefined {
    return this.events[this.events.length - 1];
  }
}

// Custom test executor that marks payment as verified
class TestMerchantExecutor extends MerchantServerExecutor {
  constructor(
    delegate: MockAgentExecutor,
    config?: any,
    facilitatorConfig?: any
  ) {
    super(delegate, config, facilitatorConfig);
    this.mockDelegate = delegate;
  }

  private mockDelegate: MockAgentExecutor;

  async verifyPayment(payload: any, requirements: any): Promise<any> {
    const result = await super.verifyPayment(payload, requirements);
    if (result.isValid) {
      // Mark the mock executor as having verified payment
      this.mockDelegate.markPaymentVerified();
    }
    return result;
  }
}

async function testPaymentFlow() {
  console.log('\n🚀 ===== x402 Payment Flow Test =====\n');

  // Step 1: Setup
  console.log('📋 Step 1: Setup');
  const privateKey = '0x' + '1'.repeat(64); // Test private key
  const wallet = new Wallet(privateKey);
  console.log(`   Client Wallet: ${wallet.address}`);

  const utils = new x402Utils();
  const mockAgentExecutor = new MockAgentExecutor();
  const merchantExecutor = new TestMerchantExecutor(mockAgentExecutor);

  // Step 2: Initial request (will throw payment exception)
  console.log('\n📋 Step 2: Merchant receives product request');

  const taskId = 'test-task-123';
  const context: any = {
    taskId,
    contextId: 'test-context-123',
    message: {
      messageId: 'msg-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'I want to buy a banana' }],
    },
  };

  const eventQueue = new MockEventQueue();

  try {
    await merchantExecutor.execute(context, eventQueue as any);
  } catch (error) {
    // Expected to catch payment exception
  }

  // Step 3: Client receives payment requirements
  console.log('\n📋 Step 3: Client receives payment requirements');

  const task = eventQueue.getLatestTask();
  if (!task) {
    throw new Error('No task found');
  }

  const paymentRequired = utils.getPaymentRequirements(task);
  if (!paymentRequired) {
    throw new Error('No payment requirements found');
  }

  console.log(`   Requirements received:`);
  console.log(`   - Network: ${paymentRequired.accepts[0].network}`);
  console.log(`   - Asset: ${paymentRequired.accepts[0].asset}`);
  console.log(`   - Amount: ${paymentRequired.accepts[0].maxAmountRequired}`);
  console.log(`   - Pay To: ${paymentRequired.accepts[0].payTo}`);

  // Step 4: Client signs payment
  console.log('\n📋 Step 4: Client signs payment');

  const paymentPayload = await processPayment(
    paymentRequired.accepts[0],
    wallet
  );

  console.log(`   ✅ Payment signed by: ${wallet.address}`);
  console.log(`   Signature: ${paymentPayload.payload.signature.substring(0, 20)}...`);

  // Step 5: Client submits payment
  console.log('\n📋 Step 5: Client submits payment to merchant');

  const paymentMessage = createPaymentSubmissionMessage(
    taskId,
    paymentPayload,
    'Payment authorization provided'
  );

  const paymentContext: any = {
    taskId,
    contextId: 'test-context-123',
    currentTask: task,
    message: paymentMessage,
  };

  // Update task with payment submission
  task.status.message = paymentMessage;

  // Step 6: Merchant processes payment
  console.log('\n📋 Step 6: Merchant verifies and settles payment');

  await merchantExecutor.execute(paymentContext, eventQueue as any);

  // Step 7: Check final result
  console.log('\n📋 Step 7: Check final result');

  const finalTask = eventQueue.getLatestTask();
  if (!finalTask) {
    throw new Error('No final task found');
  }

  const finalStatus = utils.getPaymentStatus(finalTask);
  console.log(`   Final Payment Status: ${finalStatus}`);

  if (finalStatus === 'payment-completed') {
    console.log('\n✅ ===== Payment Flow Test PASSED! =====\n');
    console.log('   🎉 Order has been confirmed!');
    console.log('   📦 Product will be shipped soon!');
  } else {
    console.log('\n⛔ ===== Payment Flow Test FAILED =====\n');
    console.log(`   Status: ${finalStatus}`);
  }

  // Display all events
  console.log('\n📊 Event Timeline:');
  eventQueue.getEvents().forEach((event, index) => {
    const status = event.status.message?.metadata?.['x402.payment.status'];
    console.log(`   ${index + 1}. Task ${event.id} - ${event.status.state} - ${status || 'N/A'}`);
  });
}

// Run the test
if (require.main === module) {
  testPaymentFlow().catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
}

export { testPaymentFlow };
