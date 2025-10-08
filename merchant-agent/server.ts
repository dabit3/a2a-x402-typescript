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
import { merchantAgent } from './agent';
import { MerchantServerExecutor } from './src/executor/MerchantServerExecutor';
import {
  x402PaymentRequiredException,
  PaymentStatus,
  x402Utils,
  TaskState,
} from 'x402-a2a-typescript';
import { InvocationContext } from 'adk-typescript/agents';
import { Session } from 'adk-typescript/sessions';
import { Content } from 'adk-typescript/models';

const PORT = process.env.PORT || 10000;
const utils = new x402Utils();

// Simple AgentExecutor wrapper that runs the ADK agent
class AgentExecutorAdapter {
  constructor(private agent: any) {}

  async execute(context: any, eventQueue: any): Promise<void> {
    try {
      // Create proper ADK InvocationContext
      const session = new Session({ id: context.contextId });
      const userContent: Content = {
        role: 'user',
        parts: context.message.parts,
      };

      const invocationContext = new InvocationContext({
        invocationId: context.taskId,
        session,
        agent: this.agent,
        userContent,
      });

      // Set user content on the agent
      this.agent.setUserContent(userContent, invocationContext);

      // Run the agent and collect events
      for await (const event of this.agent.runAsync(invocationContext)) {
        await eventQueue.enqueueEvent({
          id: context.taskId,
          status: {
            state: 'input-required',
            message: event,
          },
        });
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
}

// Wrap agent with x402 payment executor
const agentAdapter = new AgentExecutorAdapter(merchantAgent);
const paymentExecutor = new MerchantServerExecutor(agentAdapter as any);

console.log('🚀 Starting x402 Merchant Agent Server...');
console.log(`🌐 Using default facilitator (https://x402.org/facilitator)`);

// Create HTTP server
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

      // Create mock context and event queue
      const context: any = {
        taskId: request.taskId || `task-${Date.now()}`,
        contextId: request.contextId || `context-${Date.now()}`,
        message: request.message || {
          messageId: `msg-${Date.now()}`,
          role: 'user',
          parts: [{ kind: 'text', text: request.text || request.input || '' }],
        },
      };

      const events: any[] = [];
      const eventQueue = {
        enqueueEvent: async (event: any) => {
          events.push(event);
        },
      };

      // Execute through payment executor
      await paymentExecutor.execute(context, eventQueue);

      // Return response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        events,
        taskId: context.taskId,
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
