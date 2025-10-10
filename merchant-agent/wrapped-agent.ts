/**
 * Wrapped Merchant Agent with x402 Exception Handling
 *
 * This intercepts x402PaymentRequiredException at the tool level
 */

import { merchantAgent } from './agent';
import { x402PaymentRequiredException } from 'a2a-x402';

// Store the last payment exception
export let lastPaymentException: x402PaymentRequiredException | null = null;

// Wrap each tool function to catch x402 exceptions
const originalTools = merchantAgent.tools;
const wrappedTools = originalTools.map((tool: any) => {
  if (typeof tool === 'function') {
    // Create a wrapper function with the same name
    const wrappedTool = async function(params: any, context: any) {
      try {
        return await tool(params, context);
      } catch (error) {
        if (error instanceof x402PaymentRequiredException) {
          console.log('🎯 Caught x402PaymentRequiredException in tool wrapper');
          lastPaymentException = error;
          // Return empty string so ADK doesn't error
          return '';
        }
        throw error;
      }
    };
    // Copy function name for ADK tool detection
    Object.defineProperty(wrappedTool, 'name', { value: tool.name });
    return wrappedTool;
  }
  return tool;
});

// Replace the tools array (mutate the original agent)
merchantAgent.tools = wrappedTools as any;

export const wrappedMerchantAgent = merchantAgent;

export function clearLastPaymentException() {
  lastPaymentException = null;
}
