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

import { HTTP_EXTENSION_HEADER } from "@a2a-js/sdk";
import type { AgentCard, AgentExtension, AgentSkill } from "@a2a-js/sdk";
import { X402_EXTENSION_URI } from "../types/config";

/**
 * Creates extension declaration for AgentCard
 */
export function getExtensionDeclaration(
  description: string = "Supports x402 payments",
  required: boolean = true
): AgentExtension {
  return {
    uri: X402_EXTENSION_URI,
    description,
    required,
  };
}

/**
 * Check if x402 extension is activated via HTTP headers
 */
export function checkExtensionActivation(
  requestHeaders: Record<string, string>
): boolean {
  const extensions =
    requestHeaders[HTTP_EXTENSION_HEADER.toLowerCase()] ||
    requestHeaders[HTTP_EXTENSION_HEADER] ||
    "";
  return extensions.includes(X402_EXTENSION_URI);
}

/**
 * Echo extension URI in response header to confirm activation
 */
export function addExtensionActivationHeader(
  responseHeaders: Record<string, string>
): Record<string, string> {
  responseHeaders[HTTP_EXTENSION_HEADER] = X402_EXTENSION_URI;
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
  skills: AgentSkill[] = []
): AgentCard {
  return {
    protocolVersion: "0.3.0",
    name,
    description,
    url,
    preferredTransport: "JSONRPC",
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
