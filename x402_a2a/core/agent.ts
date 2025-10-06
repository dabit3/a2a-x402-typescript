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
 * Agent utilities for x402 protocol
 */

import { X402_EXTENSION_URI } from "../types/config";

export interface ExtensionDeclaration {
  uri: string;
  description: string;
  required: boolean;
}

/**
 * Creates extension declaration for AgentCard
 */
export function getExtensionDeclaration(
  description: string = "Supports x402 payments",
  required: boolean = true
): ExtensionDeclaration {
  return {
    uri: X402_EXTENSION_URI,
    description,
    required,
  };
}

/**
 * Check if x402 extension is activated via HTTP headers
 */
export function checkExtensionActivation(requestHeaders: Record<string, string>): boolean {
  const extensions = requestHeaders["x-a2a-extensions"] || requestHeaders["X-A2A-Extensions"] || "";
  return extensions.includes(X402_EXTENSION_URI);
}

/**
 * Echo extension URI in response header to confirm activation
 */
export function addExtensionActivationHeader(
  responseHeaders: Record<string, string>
): Record<string, string> {
  responseHeaders["X-A2A-Extensions"] = X402_EXTENSION_URI;
  return responseHeaders;
}

/**
 * Create x402-enabled agent card
 */
export function createX402AgentCard(
  name: string,
  description: string,
  url: string,
  version: string = "1.0.0",
  skills: any[] = []
): any {
  return {
    name,
    description,
    url,
    version,
    defaultInputModes: ["text", "text/plain"],
    defaultOutputModes: ["text", "text/plain"],
    capabilities: {
      streaming: false,
      extensions: [
        getExtensionDeclaration("Supports payments using the x402 protocol.", true),
      ],
    },
    skills,
  };
}
