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
 * Production Facilitator Client for real payment processing
 */

import {
  FacilitatorClient,
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
} from 'a2a-x402';

export class ProductionFacilitatorClient implements FacilitatorClient {
  private config: FacilitatorConfig;

  constructor(config: FacilitatorConfig) {
    this.config = config;
    console.log(`📡 Production Facilitator Client initialized: ${config.url}`);
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    console.log('--- PRODUCTION FACILITATOR: VERIFY ---');
    console.log(`Calling facilitator at: ${this.config.url}/verify`);

    try {
      const response = await fetch(`${this.config.url}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          payload,
          requirements,
        }),
      });

      if (!response.ok) {
        console.error(`❌ Facilitator verify failed: ${response.status}`);
        return {
          isValid: false,
          invalidReason: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json() as any;
      console.log(`✅ Verification result:`, result);

      return {
        isValid: result.is_valid || result.isValid || false,
        payer: result.payer,
        invalidReason: result.invalid_reason || result.invalidReason,
      };
    } catch (error) {
      console.error('❌ Facilitator verify error:', error);
      return {
        isValid: false,
        invalidReason: `Network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    console.log('--- PRODUCTION FACILITATOR: SETTLE ---');
    console.log(`Calling facilitator at: ${this.config.url}/settle`);

    try {
      const response = await fetch(`${this.config.url}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          payload,
          requirements,
        }),
      });

      if (!response.ok) {
        console.error(`❌ Facilitator settle failed: ${response.status}`);
        return {
          success: false,
          network: requirements.network,
          errorReason: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json() as any;
      console.log(`✅ Settlement result:`, result);

      return {
        success: result.success || false,
        transaction: result.transaction || result.transactionHash,
        network: result.network || requirements.network,
        payer: result.payer,
        errorReason: result.error_reason || result.errorReason,
      };
    } catch (error) {
      console.error('❌ Facilitator settle error:', error);
      return {
        success: false,
        network: requirements.network,
        errorReason: `Network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
