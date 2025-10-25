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
 * Default FacilitatorClient implementation
 * Connects to https://x402.org/facilitator by default (matches Python behavior)
 */

import {
  FacilitatorClient,
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
} from '../types/state';

/**
 * Default FacilitatorClient that connects to https://x402.org/facilitator
 * This matches the Python implementation behavior where FacilitatorClient(None)
 * creates a default client pointing to the official facilitator service.
 */
export class DefaultFacilitatorClient implements FacilitatorClient {
  private config: FacilitatorConfig;

  constructor(config?: FacilitatorConfig) {
    // Default to x402.org facilitator if no config provided
    const url = config?.url || 'https://x402.org/facilitator';

    // Validate and normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(
        `Invalid URL ${url}, must start with http:// or https://`
      );
    }

    this.config = {
      url: url.endsWith('/') ? url.slice(0, -1) : url,
      apiKey: config?.apiKey,
    };
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${this.config.url}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify({
          x402Version: payload.x402Version,
          paymentPayload: payload,
          paymentRequirements: requirements,
        }),
      });

      if (!response.ok) {
        return {
          isValid: false,
          invalidReason: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as any;
      return {
        isValid: data.isValid || data.is_valid || false,
        payer: data.payer,
        invalidReason: data.invalidReason || data.invalid_reason,
      };
    } catch (error) {
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
    try {
      const response = await fetch(`${this.config.url}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify({
          x402Version: payload.x402Version,
          paymentPayload: payload,
          paymentRequirements: requirements,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          network: requirements.network,
          errorReason: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as any;
      return {
        success: data.success || false,
        transaction: data.transaction || data.transactionHash,
        network: data.network || requirements.network,
        payer: data.payer,
        errorReason: data.errorReason || data.error_reason,
      };
    } catch (error) {
      return {
        success: false,
        network: requirements.network,
        errorReason: `Network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
