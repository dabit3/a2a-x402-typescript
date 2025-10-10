/**
 * Export the merchant agent with the expected module name
 * This file is required for the ADK API server to find the agent
 * ADK expects: agentModule.agent.rootAgent
 */

import { rootAgent, merchantAgent } from './agent';

// Export in the structure ADK expects
export const agent = {
  rootAgent: rootAgent,
  merchantAgent: merchantAgent,
};
