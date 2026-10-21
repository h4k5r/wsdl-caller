export type SoapVersion = '1.1' | '1.2';

export interface WsdlOperation {
  name: string;
  soapAction?: string;
  style?: 'document' | 'rpc';
  soapVersion: SoapVersion;
  endpointUrl: string;
  documentation?: string;
  inputMessageName?: string;
  inputElementName?: string;
  outputMessageName?: string;
  outputElementName?: string;
  sampleRequestXml: string;
}

export interface WsdlPort {
  name: string;
  bindingName: string;
  soapVersion: SoapVersion;
  endpointUrl: string;
  operations: WsdlOperation[];
}

export interface WsdlService {
  name: string;
  ports: WsdlPort[];
}

export interface ParsedWsdl {
  targetNamespace?: string;
  services: WsdlService[];
  rawXml?: string;
  sourceUrl?: string;
}

export interface HttpHeaderItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'ws-security';
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
  };
  wsSecurity?: {
    username: string;
    password: string;
    passwordType: 'PasswordText' | 'PasswordDigest';
  };
}

export interface SoapRequestPayload {
  url: string;
  soapAction?: string;
  soapVersion: SoapVersion;
  body: string;
  headers: Record<string, string>;
  auth?: AuthConfig;
  ignoreSsl: boolean;
  timeoutMs: number;
}

export interface SoapFaultDetails {
  faultCode: string;
  faultString: string;
  faultActor?: string;
  detail?: string;
}

export interface SoapResponsePayload {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rawBody: string;
  formattedBody: string;
  durationMs: number;
  timestamp: string;
  isFault: boolean;
  faultDetails?: SoapFaultDetails;
}

export interface RequestHistoryItem {
  id: string;
  timestamp: string;
  serviceName: string;
  portName: string;
  operationName: string;
  endpointUrl: string;
  soapVersion: SoapVersion;
  requestXml: string;
  responseStatus?: number;
  durationMs?: number;
  isFault?: boolean;
}
