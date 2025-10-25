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
 * Helper functions for easy x402 payment integration
 */

import {
  x402PaymentRequiredException,
  PaymentRequiredExceptionOptions,
} from "../types/errors";
import { PaymentRequirements, SupportedNetworks } from "../types/state";
import { Price, TokenAmount } from "../types/config";
import { createPaymentRequirements } from "./merchant";

/**
 * Create a payment required exception for immediate raising
 */
export async function requirePayment(
  options: PaymentRequiredExceptionOptions
): Promise<x402PaymentRequiredException> {
  return x402PaymentRequiredException.forService(options);
}

/**
 * Create a payment required exception with multiple payment options
 */
export function requirePaymentChoice(
  paymentOptions: PaymentRequirements[],
  message: string = "Multiple payment options available"
): x402PaymentRequiredException {
  return new x402PaymentRequiredException(message, paymentOptions);
}

/**
 * Decorator to automatically require payment for a function or method
 */
export function paidService(options: PaymentRequiredExceptionOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // For now, always require payment on first call
      // In a real implementation, you might check payment status from context
      const effectiveResource = options.resource || `/${propertyKey}`;

      throw await x402PaymentRequiredException.forService({
        ...options,
        resource: effectiveResource,
      });
    };

    return descriptor;
  };
}

interface TierDefinition {
  multiplier: number;
  suffix: string;
  description: string;
}

/**
 * Create multiple payment options with different tiers/features
 */
export async function createTieredPaymentOptions(
  basePrice: Price,
  payToAddress: string,
  resource: string,
  tiers?: TierDefinition[],
  network: SupportedNetworks = "base"
): Promise<PaymentRequirements[]> {
  const defaultTiers: TierDefinition[] = [
    { multiplier: 1, suffix: "basic", description: "Basic service" },
    { multiplier: 2, suffix: "premium", description: "Premium service" },
  ];

  const tiersToUse = tiers || defaultTiers;
  const options: PaymentRequirements[] = [];

  for (const tier of tiersToUse) {
    const { multiplier, suffix, description } = tier;

    // Calculate tier price
    let tierPrice: Price;
    if (typeof basePrice === "string" && basePrice.startsWith("$")) {
      const baseAmount = parseFloat(basePrice.slice(1));
      tierPrice = `$${(baseAmount * multiplier).toFixed(2)}`;
    } else if (typeof basePrice === "number") {
      tierPrice = basePrice * multiplier;
    } else {
      // TokenAmount - would need to implement multiplication
      tierPrice = basePrice;
    }

    const tierResource = suffix ? `${resource}/${suffix}` : resource;

    const option = await createPaymentRequirements({
      price: tierPrice,
      payToAddress,
      resource: tierResource,
      network,
      description,
    });

    options.push(option);
  }

  return options;
}

/**
 * Check if current context has payment information
 */
export function checkPaymentContext(context: any): string | null {
  // Placeholder implementation
  if (context?.currentTask) {
    const task = context.currentTask;
    if (task?.status?.message?.metadata) {
      return task.status.message.metadata["x402.payment.status"] || null;
    }
  }
  return null;
}

/**
 * Smart decorator that only requires payment if not already paid
 */
export function smartPaidService(options: PaymentRequiredExceptionOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Try to detect context from arguments
      let context = null;
      for (const arg of args) {
        if (arg?.currentTask) {
          context = arg;
          break;
        }
      }

      // Check if payment already exists in context
      if (context) {
        const paymentStatus = checkPaymentContext(context);
        if (
          paymentStatus === "payment-completed" ||
          paymentStatus === "payment-submitted"
        ) {
          // Payment exists, proceed with function
          return originalMethod.apply(this, args);
        }
      }

      // No payment found, require payment
      const effectiveResource = options.resource || `/${propertyKey}`;

      throw await x402PaymentRequiredException.forService({
        ...options,
        resource: effectiveResource,
      });
    };

    return descriptor;
  };
}
