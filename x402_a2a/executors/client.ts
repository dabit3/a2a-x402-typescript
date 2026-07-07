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

import { BaseWallet } from "ethers";
import type { Task } from "@a2a-js/sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from "@a2a-js/sdk/server";
import { x402BaseExecutor } from "./base";
import { PaymentStatus, SettleResponse } from "../types/state";
import { x402ExtensionConfig } from "../types/config";
import { processPayment } from "../core/wallet";
import { x402ErrorCode } from "../types/errors";

export class x402ClientExecutor extends x402BaseExecutor {
  private wallet: BaseWallet;
  private maxValue?: number;
  private autoPay: boolean;

  constructor(
    delegate: AgentExecutor,
    wallet: BaseWallet,
    config?: Partial<x402ExtensionConfig>,
    maxValue?: number,
    autoPay: boolean = true
  ) {
    super(delegate, config);
    this.wallet = wallet;
    this.maxValue = maxValue;
    this.autoPay = autoPay;
  }

  async execute(
    context: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    if (!this.isActive(context)) {
      return this._delegate.execute(context, eventBus);
    }

    // Execute the service request first
    await this._delegate.execute(context, eventBus);

    // Check if payment is required after execution
    const task = context.task;
    if (!task) {
      return;
    }

    const status = this.utils.getPaymentStatus(task);

    // If payment required, auto-process and resubmit
    if (status === PaymentStatus.PAYMENT_REQUIRED && this.autoPay) {
      await this._autoPay(task, eventBus);
    }
  }

  private async _autoPay(task: Task, eventBus: ExecutionEventBus): Promise<void> {
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
      eventBus.publish(task);
    } catch (e) {
      // Payment processing failed
      const error = e as Error;
      const failureResponse: SettleResponse = {
        success: false,
        network: paymentRequired.accepts[0]?.network || "unknown",
        errorReason: `Payment failed: ${error.message}`,
      };
      this.utils.recordPaymentFailure(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        failureResponse
      );
      eventBus.publish(task);
    }
  }
}
