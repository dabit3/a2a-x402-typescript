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
 * Simple logger utility that respects X402_DEBUG environment variable
 */

const isDebugEnabled = process.env.X402_DEBUG === 'true' || process.env.X402_DEBUG === '1';

export const logger = {
  log: (...args: any[]) => {
    if (isDebugEnabled) {
      console.log('[x402]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDebugEnabled) {
      console.warn('[x402]', ...args);
    }
  },
  error: (...args: any[]) => {
    // Always show errors
    console.error('[x402]', ...args);
  },
};
