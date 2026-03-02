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

/**
 * A declaration of a protocol extension supported by an Agent.
 * Aligned with A2A v0.3.0 AgentExtension.
 */
export interface AgentExtension {
  uri: string;
  description?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

/** @deprecated Use AgentExtension instead */
export type ExtensionDeclaration = AgentExtension;

/**
 * Represents a distinct capability or function that an agent can perform.
 * A2A v0.3.0 AgentSkill.
 */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  security?: Record<string, string[]>[];
}

/**
 * Defines optional capabilities supported by an agent.
 * A2A v0.3.0 AgentCapabilities.
 */
export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: AgentExtension[];
}

/**
 * Information about the agent's service provider.
 */
export interface AgentProvider {
  organization: string;
  url: string;
}

/**
 * Declares a combination of a target URL and a transport protocol.
 */
export interface AgentInterface {
  transport: string;
  url: string;
}

/**
 * Security scheme types following OpenAPI 3.0 Security Scheme Object.
 */
export type SecurityScheme =
  | APIKeySecurityScheme
  | HTTPAuthSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme
  | MutualTLSSecurityScheme;

export interface APIKeySecurityScheme {
  type: "apiKey";
  name: string;
  in: "cookie" | "header" | "query";
  description?: string;
}

export interface HTTPAuthSecurityScheme {
  type: "http";
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

export interface OAuth2SecurityScheme {
  type: "oauth2";
  flows: OAuthFlows;
  oauth2MetadataUrl?: string;
  description?: string;
}

export interface OAuthFlows {
  authorizationCode?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  implicit?: OAuthFlow;
  password?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenIdConnectSecurityScheme {
  type: "openIdConnect";
  openIdConnectUrl: string;
  description?: string;
}

export interface MutualTLSSecurityScheme {
  type: "mutualTLS";
  description?: string;
}

/**
 * The AgentCard is a self-describing manifest for an agent.
 * Updated to A2A v0.3.0 specification.
 */
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  capabilities: AgentCapabilities;
  skills: AgentSkill[];
  provider?: AgentProvider;
  documentationUrl?: string;
  iconUrl?: string;
  preferredTransport?: string;
  additionalInterfaces?: AgentInterface[];
  securitySchemes?: Record<string, SecurityScheme>;
  security?: Record<string, string[]>[];
  supportsAuthenticatedExtendedCard?: boolean;
}

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
 * The current A2A protocol version supported by this library.
 */
export const A2A_PROTOCOL_VERSION = "0.3.0";

/**
 * Create x402-enabled agent card conforming to A2A v0.3.0
 */
export function createX402AgentCard(
  name: string,
  description: string,
  url: string,
  version: string = "1.0.0",
  skills: AgentSkill[] = [],
  options?: {
    protocolVersion?: string;
    provider?: AgentProvider;
    preferredTransport?: string;
    additionalInterfaces?: AgentInterface[];
    securitySchemes?: Record<string, SecurityScheme>;
    security?: Record<string, string[]>[];
    supportsAuthenticatedExtendedCard?: boolean;
  }
): AgentCard {
  return {
    name,
    description,
    url,
    version,
    protocolVersion: options?.protocolVersion ?? A2A_PROTOCOL_VERSION,
    defaultInputModes: ["text", "text/plain"],
    defaultOutputModes: ["text", "text/plain"],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [
        getExtensionDeclaration("Supports payments using the x402 protocol.", true),
      ],
    },
    skills,
    ...(options?.provider && { provider: options.provider }),
    ...(options?.preferredTransport && { preferredTransport: options.preferredTransport }),
    ...(options?.additionalInterfaces && { additionalInterfaces: options.additionalInterfaces }),
    ...(options?.securitySchemes && { securitySchemes: options.securitySchemes }),
    ...(options?.security && { security: options.security }),
    ...(options?.supportsAuthenticatedExtendedCard !== undefined && {
      supportsAuthenticatedExtendedCard: options.supportsAuthenticatedExtendedCard,
    }),
  };
}
