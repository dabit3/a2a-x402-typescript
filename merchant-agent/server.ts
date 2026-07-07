#!/usr/bin/env node
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
 * Production Server for x402 Merchant Agent
 *
 * This starts an HTTP API server with full x402 payment processing.
 * The server wraps the agent with MerchantServerExecutor to handle payments.
 */

import { createServer } from 'http';
import { wrappedMerchantAgent, lastPaymentException, clearLastPaymentException } from './wrapped-agent';
import { MerchantServerExecutor } from './src/executor/MerchantServerExecutor';
import { x402PaymentRequiredException } from 'a2a-x402';
import * as path from 'path';

// adk-typescript's compiled output references module paths with inconsistent
// casing (e.g. '../sessions/State' vs 'state.js'), which breaks both its
// package exports and type resolution on case-sensitive filesystems. Resolve
// the compiled modules directly from the installed package instead.
const adkDist = path.join(path.dirname(require.resolve('adk-typescript/agents')), '..');
const { Runner } = require(path.join(adkDist, 'runners'));
const { InMemorySessionService } = require(path.join(adkDist, 'sessions', 'inMemorySessionService'));
const { InMemoryArtifactService } = require(path.join(adkDist, 'artifacts', 'inMemoryArtifactService'));
const { InMemoryMemoryService } = require(path.join(adkDist, 'memory', 'inMemoryMemoryService'));

const PORT = Number(process.env.PORT) || 10000;

// Create ADK services for proper session management
const sessionService = new InMemorySessionService();
const artifactService = new InMemoryArtifactService();
const memoryService = new InMemoryMemoryService();

// Create ADK Runner with wrapped agent
const runner = new Runner({
  appName: 'x402_merchant_agent',
  agent: wrappedMerchantAgent,
  sessionService,
  artifactService,
  memoryService,
});

// AgentExecutor adapter that uses ADK Runner
class AgentExecutorAdapter {
  async execute(context: any, eventBus: any): Promise<void> {
    try {
      console.log('\n=== AgentExecutorAdapter Debug ===');
      console.log('Context ID:', context.contextId);
      console.log('Message:', JSON.stringify(context.userMessage, null, 2));

      clearLastPaymentException(); // Clear any previous exception

      // Use ADK Runner to execute the agent with proper session management
      for await (const event of runner.runAsync({
        userId: 'client-user',
        sessionId: context.contextId,
        newMessage: context.userMessage,
      })) {
        eventBus.publish({
          id: context.taskId,
          status: {
            state: 'input-required',
            message: event,
          },
        });
      }

      // After execution, check if a payment exception was caught
      if (lastPaymentException) {
        console.log('💳 Found payment exception after execution, re-throwing...');
        throw lastPaymentException;
      }
    } catch (error) {
      // If it's a payment exception, re-throw so executor can catch it
      if (error instanceof x402PaymentRequiredException) {
        throw error;
      }
      // Other errors get logged
      console.error('Agent execution error:', error);
      throw error;
    }
  }

  async cancelTask(_taskId: string, _eventBus: any): Promise<void> {
    // No-op: this adapter does not support task cancellation
  }
}

// Wrap agent with x402 payment executor
const agentAdapter = new AgentExecutorAdapter();
const paymentExecutor = new MerchantServerExecutor(agentAdapter as any);

console.log('🚀 Starting x402 Merchant Agent Server...');
console.log(`🌐 Using default facilitator (https://x402.org/facilitator)`);

// Create HTTP server
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'x402-merchant-agent',
      timestamp: Date.now(),
      uptime: process.uptime(),
    }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read request body
  let body = '';
  req.on('data', chunk => body += chunk);

  req.on('end', async () => {
    try {
      const request = JSON.parse(body);

      console.log('\n=== Received request ===');
      console.log('URL:', req.url);
      console.log('Request body:', JSON.stringify(request, null, 2));

      // Support ADK /run endpoint format
      if (req.url === '/run' && request.newMessage) {
        // ADK format: { appName, userId, sessionId, newMessage: { role, parts } }
        const context: any = {
          taskId: `task-${Date.now()}`,
          contextId: request.sessionId || `context-${Date.now()}`,
          userMessage: request.newMessage,
        };

        const events: any[] = [];
        const eventBus = {
          publish: (event: any) => {
            console.log('Event published:', JSON.stringify(event, null, 2));
            events.push(event);
          },
        };

        // Execute through payment executor
        await paymentExecutor.execute(context, eventBus as any);

        // Transform events for ADK response format
        const adkEvents = events.map(e => {
          // Check for payment requirements in the message metadata (x402 format)
          const paymentReqs = e.status?.message?.metadata?.['x402.payment.required'];
          if (e.status?.state === 'input-required' && paymentReqs) {
            // Transform x402 payment exception to ADK error event format
            console.log('💳 Transforming payment requirement to ADK format');
            return {
              invocationId: context.taskId,
              errorCode: 'x402_payment_required',
              errorData: {
                paymentRequirements: paymentReqs,
              },
              content: {
                role: 'model',
                parts: [{
                  text: paymentReqs.error || 'Payment required'
                }],
              },
            };
          }
          // Regular event - transform to ADK format
          return e.status?.message || e;
        });

        // Return ADK-compatible response (array of events)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(adkEvents));
        return;
      }

      // Legacy format support
      const context: any = {
        taskId: request.taskId || `task-${Date.now()}`,
        contextId: request.contextId || `context-${Date.now()}`,
        userMessage: request.message || {
          kind: 'message',
          messageId: `msg-${Date.now()}`,
          role: 'user',
          parts: [{ kind: 'text', text: request.text || request.input || '' }],
        },
      };

      const events: any[] = [];
      const eventBus = {
        publish: (event: any) => {
          events.push(event);
        },
      };

      // Execute through payment executor
      await paymentExecutor.execute(context, eventBus as any);

      // Check if any events contain payment requirements
      const hasPaymentRequired = events.some(e =>
        e.status?.state === 'payment-required' ||
        e.status?.paymentRequirements
      );

      // Return response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        events,
        taskId: context.taskId,
        paymentRequired: hasPaymentRequired,
      }));

    } catch (error) {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📡 Ready to process x402 payments`);
  console.log(`\nTest with:`);
  console.log(`curl -X POST http://localhost:${PORT} \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"text": "I want to buy a banana"}'`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
