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
 * Configuration types for x402_a2a
 */

export const X402_EXTENSION_URI = 'https://github.com/google-a2a/a2a-x402/v0.1';

export interface TokenAmount {
  value: string;
  asset: string;
  network: string;
}

export type Price = string | number | TokenAmount;

export interface x402ExtensionConfig {
  extensionUri?: string;
  version?: string;
  x402Version?: number;
  required?: boolean;
}

export const DEFAULT_X402_EXTENSION_CONFIG: x402ExtensionConfig = {
  extensionUri: X402_EXTENSION_URI,
  version: '0.1',
  x402Version: 1,
  required: true,
};

export interface x402ServerConfig {
  price: Price;
  payToAddress: string;
  network?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  resource?: string;
  assetAddress?: string;
}
