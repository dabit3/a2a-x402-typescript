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
import type { PaymentRequirements, SupportedNetworks } from "../types/state";
import type { Price } from "../types/config";
import { createPaymentRequirements } from "./merchant";
import type { Task } from "@a2a-js/sdk";

/**
 * Create a payment required exception for immediate raising
 */
export function requirePayment(
  options: PaymentRequiredExceptionOptions
): x402PaymentRequiredException {
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

    descriptor.value = async function (..._args: unknown[]) {
      // For now, always require payment on first call
      // In a real implementation, you might check payment status from context
      const effectiveResource = options.resource || `/${propertyKey}`;

      throw x402PaymentRequiredException.forService({
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
export function createTieredPaymentOptions(
  basePrice: Price,
  payToAddress: string,
  resource: string,
  tiers?: TierDefinition[],
  network: SupportedNetworks = "base"
): PaymentRequirements[] {
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

    const option = createPaymentRequirements({
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
export function checkPaymentContext(context: unknown): string | null {
  const task = (context as { task?: Task } | null | undefined)?.task;
  const status = task?.status?.message?.metadata?.["x402.payment.status"];
  return typeof status === "string" ? status : null;
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

    descriptor.value = async function (...args: unknown[]) {
      // Try to detect context from arguments
      let context: unknown = null;
      for (const arg of args) {
        if ((arg as { task?: unknown } | null | undefined)?.task) {
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

      throw x402PaymentRequiredException.forService({
        ...options,
        resource: effectiveResource,
      });
    };

    return descriptor;
  };
}
