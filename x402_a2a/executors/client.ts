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
 * Client-side executor for wallet/signing implementations
 */

import { Wallet } from "ethers";
import { x402BaseExecutor } from "./base";
import {
  AgentExecutor,
  RequestContext,
  EventQueue,
  PaymentStatus,
  SettleResponse,
} from "../types/state";
import { x402ExtensionConfig } from "../types/config";
import { processPayment } from "../core/wallet";
import { x402ErrorCode } from "../types/errors";

export class x402ClientExecutor extends x402BaseExecutor {
  private wallet: Wallet;
  private maxValue?: number;
  private autoPay: boolean;

  constructor(
    delegate: AgentExecutor,
    wallet: Wallet,
    config?: Partial<x402ExtensionConfig>,
    maxValue?: number,
    autoPay: boolean = true
  ) {
    super(delegate, config);
    this.wallet = wallet;
    this.maxValue = maxValue;
    this.autoPay = autoPay;
  }

  async execute(context: RequestContext, eventQueue: EventQueue): Promise<void> {
    if (!this.isActive(context)) {
      return this._delegate.execute(context, eventQueue);
    }

    // Execute the service request first
    const result = await this._delegate.execute(context, eventQueue);

    // Check if payment is required after execution
    const task = context.currentTask;
    if (!task) {
      return result;
    }

    const status = this.utils.getPaymentStatus(task);

    // If payment required, auto-process and resubmit
    if (status === PaymentStatus.PAYMENT_REQUIRED && this.autoPay) {
      await this._autoPay(task, eventQueue);
      return;
    }

    return result;
  }

  private async _autoPay(task: any, eventQueue: EventQueue): Promise<void> {
    const paymentRequired = this.utils.getPaymentRequirements(task);
    if (!paymentRequired) {
      return; // No payment requirements found
    }

    try {
      // Process payment using wallet functions
      const paymentPayload = await processPayment(
        paymentRequired.accepts[0],
        this.wallet,
        this.maxValue
      );

      // Submit payment authorization
      this.utils.recordPaymentSubmission(task, paymentPayload);
      await eventQueue.enqueueEvent(task);
    } catch (e) {
      // Payment processing failed
      const error = e as Error;
      const failureResponse: SettleResponse = {
        success: false,
        network: "base",
        errorReason: `Payment failed: ${error.message}`,
      };
      this.utils.recordPaymentFailure(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        failureResponse
      );
      await eventQueue.enqueueEvent(task);
    }
  }
}
