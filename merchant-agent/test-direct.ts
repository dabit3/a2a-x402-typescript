/**
 * Direct test of the merchant agent without HTTP server
 */

import { merchantAgent } from './agent';
import { Session } from 'adk-typescript/sessions';
import { InvocationContext } from 'adk-typescript/agents';
import { Content } from 'adk-typescript/models';

async function test() {
  const session = new Session({ id: 'test-session' });
  const userContent: Content = {
    role: 'user',
    parts: [{ text: 'I want to buy a banana' }],
  };

  session.addAgent(merchantAgent);

  const invocationContext = new InvocationContext({
    invocationId: 'test-invocation',
    session,
    agent: merchantAgent,
    userContent,
  });

  console.log('Running agent with userContent:', JSON.stringify(userContent, null, 2));
  console.log('InvocationContext.userContent:', invocationContext.userContent);

  try {
    for await (const event of merchantAgent.runAsync(invocationContext)) {
      console.log('\nEvent received:');
      console.log('  Author:', event.author);
      console.log('  Content:', event.content);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test().catch(console.error);
