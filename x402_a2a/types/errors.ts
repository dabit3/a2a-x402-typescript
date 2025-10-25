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
 * Protocol error types and error code mapping
 */

import { PaymentRequirements, SupportedNetworks } from "./state";
import { Price, TokenAmount } from "./config";

export class x402Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "x402Error";
  }
}

export class MessageError extends x402Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageError";
  }
}

export class ValidationError extends x402Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PaymentError extends x402Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export class StateError extends x402Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export interface PaymentRequiredExceptionOptions {
  price: Price;
  payToAddress: string;
  resource: string;
  network?: SupportedNetworks;
  description?: string;
  message?: string;
}

export class x402PaymentRequiredException extends x402Error {
  public readonly paymentRequirements: PaymentRequirements[];
  public readonly errorCode?: string;

  constructor(
    message: string,
    paymentRequirements: PaymentRequirements | PaymentRequirements[],
    errorCode?: string
  ) {
    super(message);
    this.name = "x402PaymentRequiredException";

    // Normalize to array format for consistency
    if (Array.isArray(paymentRequirements)) {
      this.paymentRequirements = paymentRequirements;
    } else {
      this.paymentRequirements = [paymentRequirements];
    }

    this.errorCode = errorCode;
  }

  getAcceptsArray(): PaymentRequirements[] {
    return this.paymentRequirements;
  }

  static async forService(
    options: PaymentRequiredExceptionOptions
  ): Promise<x402PaymentRequiredException> {
    // Import here to avoid circular imports
    const { createPaymentRequirements } = await import("../core/merchant");

    const requirements = await createPaymentRequirements({
      price: options.price,
      payToAddress: options.payToAddress,
      resource: options.resource,
      network: options.network,
      description: options.description || "Payment required for this service",
    });

    return new x402PaymentRequiredException(
      options.message || options.description || "Payment required",
      requirements
    );
  }
}

export class x402ErrorCode {
  static readonly INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS";
  static readonly INVALID_SIGNATURE = "INVALID_SIGNATURE";
  static readonly EXPIRED_PAYMENT = "EXPIRED_PAYMENT";
  static readonly DUPLICATE_NONCE = "DUPLICATE_NONCE";
  static readonly NETWORK_MISMATCH = "NETWORK_MISMATCH";
  static readonly INVALID_AMOUNT = "INVALID_AMOUNT";
  static readonly SETTLEMENT_FAILED = "SETTLEMENT_FAILED";

  static getAllCodes(): string[] {
    return [
      this.INSUFFICIENT_FUNDS,
      this.INVALID_SIGNATURE,
      this.EXPIRED_PAYMENT,
      this.DUPLICATE_NONCE,
      this.NETWORK_MISMATCH,
      this.INVALID_AMOUNT,
      this.SETTLEMENT_FAILED,
    ];
  }
}

export function mapErrorToCode(error: Error): string {
  if (error instanceof ValidationError) {
    return x402ErrorCode.INVALID_SIGNATURE;
  }
  if (error instanceof PaymentError) {
    return x402ErrorCode.SETTLEMENT_FAILED;
  }
  return "UNKNOWN_ERROR";
}
