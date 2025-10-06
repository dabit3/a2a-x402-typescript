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
 * Base executor for x402 payment middleware
 */

import {
  AgentExecutor,
  RequestContext,
  EventQueue,
} from "../types/state";
import { x402ExtensionConfig, DEFAULT_X402_EXTENSION_CONFIG } from "../types/config";
import { x402Utils } from "../core/utils";
import { checkExtensionActivation } from "../core/agent";

export abstract class x402BaseExecutor implements AgentExecutor {
  protected _delegate: AgentExecutor;
  protected config: x402ExtensionConfig;
  protected utils: x402Utils;

  constructor(delegate: AgentExecutor, config?: Partial<x402ExtensionConfig>) {
    this._delegate = delegate;
    this.config = { ...DEFAULT_X402_EXTENSION_CONFIG, ...config };
    this.utils = new x402Utils();
  }

  /**
   * Check if x402 extension is active for this request
   */
  protected isActive(context: RequestContext): boolean {
    // For now, assume always active
    // In a full implementation, this would check request headers
    return true;
  }

  abstract execute(context: RequestContext, eventQueue: EventQueue): Promise<void>;
}
