import https from 'https';
import http from 'http';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { SoapRequestPayload, SoapResponsePayload, SoapFaultDetails } from '../types/wsdl';

export class SoapHttpClient {
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: false,
    });

    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
    });
  }

  public async sendRequest(payload: SoapRequestPayload): Promise<SoapResponsePayload> {
    const startTime = Date.now();
    const url = new URL(payload.url);
    const isHttps = url.protocol === 'https:';

    const reqHeaders: Record<string, string> = {
      ...payload.headers,
    };

    // Auto-set SOAP headers based on version
    if (payload.soapVersion === '1.2') {
      const actionPart = payload.soapAction ? `; action="${payload.soapAction}"` : '';
      if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = `application/soap+xml; charset=utf-8${actionPart}`;
      }
    } else {
      // SOAP 1.1
      if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = 'text/xml; charset=utf-8';
      }
      if (payload.soapAction !== undefined && !reqHeaders['SOAPAction'] && !reqHeaders['soapaction']) {
        // Enclose SOAPAction in quotes as per standard
        const cleanAction = payload.soapAction.startsWith('"') && payload.soapAction.endsWith('"')
          ? payload.soapAction
          : `"${payload.soapAction}"`;
        reqHeaders['SOAPAction'] = cleanAction;
      }
    }

    // Apply Auth
    if (payload.auth) {
      if (payload.auth.type === 'basic' && payload.auth.basic) {
        const credentials = Buffer.from(
          `${payload.auth.basic.username}:${payload.auth.basic.password}`
        ).toString('base64');
        reqHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (payload.auth.type === 'bearer' && payload.auth.bearer) {
        reqHeaders['Authorization'] = `Bearer ${payload.auth.bearer.token}`;
      }
    }

    // Prepare Request Body (handle WS-Security if requested)
    let finalBody = payload.body;
    if (payload.auth?.type === 'ws-security' && payload.auth.wsSecurity) {
      finalBody = this.injectWsSecurity(finalBody, payload.auth.wsSecurity);
    }

    const bodyBuffer = Buffer.from(finalBody, 'utf-8');
    reqHeaders['Content-Length'] = bodyBuffer.length.toString();

    return new Promise<SoapResponsePayload>((resolve, reject) => {
      const options: http.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: reqHeaders,
        timeout: payload.timeoutMs || 30000,
      };

      if (isHttps) {
        (options as https.RequestOptions).agent = new https.Agent({
          rejectUnauthorized: !payload.ignoreSsl,
        });
      }

      const transport = isHttps ? https : http;

      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          const resHeaders: Record<string, string> = {};

          for (const [key, val] of Object.entries(res.headers)) {
            if (val) {
              resHeaders[key] = Array.isArray(val) ? val.join(', ') : val;
            }
          }

          // Parse and format XML
          let formattedBody = rawBody;
          let isFault = false;
          let faultDetails: SoapFaultDetails | undefined;

          try {
            const parsed = this.xmlParser.parse(rawBody);
            formattedBody = this.xmlBuilder.build(parsed);
            const faultInfo = this.extractFault(parsed, res.statusCode);
            if (faultInfo) {
              isFault = true;
              faultDetails = faultInfo;
            }
          } catch {
            // Keep raw text if not valid XML
          }

          if (res.statusCode && res.statusCode >= 400) {
            isFault = true;
            if (!faultDetails) {
              faultDetails = {
                faultCode: `HTTP_${res.statusCode}`,
                faultString: res.statusMessage || `Server returned HTTP ${res.statusCode}`,
              };
            }
          }

          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: resHeaders,
            rawBody,
            formattedBody,
            durationMs,
            timestamp: new Date().toISOString(),
            isFault,
            faultDetails,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${payload.timeoutMs || 30000}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(bodyBuffer);
      req.end();
    });
  }

  public async fetchWsdl(urlStr: string, ignoreSsl = true): Promise<string> {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';

    return new Promise<string>((resolve, reject) => {
      const options: http.RequestOptions = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'User-Agent': 'WsdlCaller/1.0.0 (Desktop SOAP Client)',
          Accept: 'text/xml, application/xml, */*',
        },
      };

      if (isHttps) {
        (options as https.RequestOptions).agent = new https.Agent({
          rejectUnauthorized: !ignoreSsl,
        });
      }

      const transport = isHttps ? https : http;
      const req = transport.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          const redirectUrl = new URL(res.headers.location, urlStr).toString();
          this.fetchWsdl(redirectUrl, ignoreSsl).then(resolve).catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  private extractFault(parsedObj: any, statusCode?: number): SoapFaultDetails | undefined {
    if (!parsedObj || typeof parsedObj !== 'object') return undefined;

    // Look for SOAP Body node
    let bodyNode: any = null;
    for (const k of Object.keys(parsedObj)) {
      if (k.toLowerCase().endsWith('envelope')) {
        const env = parsedObj[k];
        if (env && typeof env === 'object') {
          for (const envK of Object.keys(env)) {
            if (envK.toLowerCase().endsWith('body')) {
              bodyNode = env[envK];
              break;
            }
          }
        }
      }
    }

    const searchRoot = bodyNode || parsedObj;
    let faultNode: any = null;

    if (searchRoot && typeof searchRoot === 'object') {
      for (const k of Object.keys(searchRoot)) {
        const lower = k.toLowerCase();
        if (lower === 'fault' || lower.endsWith(':fault')) {
          faultNode = searchRoot[k];
          break;
        }
      }
    }

    if (!faultNode) return undefined;

    const findKey = (obj: any, names: string[]): any => {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const k of Object.keys(obj)) {
        const clean = k.split(':').pop()?.toLowerCase();
        if (names.includes(clean || '')) {
          return typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : String(obj[k]);
        }
      }
      return undefined;
    };

    return {
      faultCode: findKey(faultNode, ['faultcode', 'code']) || (statusCode ? `HTTP_${statusCode}` : 'SOAP.Fault'),
      faultString: findKey(faultNode, ['faultstring', 'reason', 'text']) || 'SOAP Fault occurred',
      faultActor: findKey(faultNode, ['faultactor', 'node', 'role']),
      detail: findKey(faultNode, ['detail']),
    };
  }

  private injectWsSecurity(bodyXml: string, wsSecurity: NonNullable<SoapRequestPayload['auth']>['wsSecurity']) {
    if (!wsSecurity) return bodyXml;
    const wsSecurityHeader = `
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                   xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${wsSecurity.username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${wsSecurity.password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>`.trim();

    // Check if Header exists
    if (bodyXml.includes('<soapenv:Header/>') || bodyXml.includes('<soap:Header/>')) {
      return bodyXml
        .replace('<soapenv:Header/>', `<soapenv:Header>\n    ${wsSecurityHeader}\n  </soapenv:Header>`)
        .replace('<soap:Header/>', `<soap:Header>\n    ${wsSecurityHeader}\n  </soap:Header>`);
    } else if (bodyXml.includes('<soapenv:Header>') || bodyXml.includes('<soap:Header>')) {
      return bodyXml
        .replace('<soapenv:Header>', `<soapenv:Header>\n    ${wsSecurityHeader}`)
        .replace('<soap:Header>', `<soap:Header>\n    ${wsSecurityHeader}`);
    }

    return bodyXml;
  }
}
