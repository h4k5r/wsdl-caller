import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { ParsedWsdl, WsdlService, WsdlPort, WsdlOperation, SoapVersion } from '../types/wsdl';

interface SchemaElement {
  name: string;
  type?: string;
  minOccurs?: string;
  maxOccurs?: string;
  isComplex?: boolean;
  children?: SchemaElement[];
}

interface SchemaType {
  name: string;
  isComplex: boolean;
  elements?: SchemaElement[];
  baseType?: string;
  enums?: string[];
}

export class WsdlParser {
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: false, // Keep prefixes to detect soap11 vs soap12 vs xs
      trimValues: true,
      isArray: (name) => {
        const leaf = name.split(':').pop() || name;
        return [
          'service',
          'port',
          'binding',
          'portType',
          'operation',
          'message',
          'part',
          'schema',
          'element',
          'complexType',
          'simpleType',
          'sequence',
          'choice',
          'all',
          'enumeration',
        ].includes(leaf);
      },
    });

    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
    });
  }

  public parse(wsdlXml: string, sourceUrl?: string): ParsedWsdl {
    const parsedObj = this.xmlParser.parse(wsdlXml);
    const definitions = this.findFirstNode(parsedObj, ['definitions', 'wsdl:definitions']);

    if (!definitions) {
      throw new Error('Invalid WSDL: Root <definitions> or <wsdl:definitions> node not found.');
    }

    const targetNamespace =
      definitions['@_targetNamespace'] ||
      definitions['@_xmlns:tns'] ||
      definitions['@_xmlns'] ||
      'http://tempuri.org/';

    // 1. Index Schemas (Elements & ComplexTypes)
    const elementsMap = new Map<string, SchemaElement>();
    const typesMap = new Map<string, SchemaType>();
    this.extractSchemas(definitions, elementsMap, typesMap);

    // 2. Index Messages
    const messagesMap = new Map<string, any>();
    const messages = this.findAllNodes(definitions, ['message', 'wsdl:message']);
    for (const msg of messages) {
      const name = msg['@_name'];
      if (name) {
        messagesMap.set(this.stripPrefix(name), msg);
      }
    }

    // 3. Index PortTypes
    const portTypesMap = new Map<string, any>();
    const portTypes = this.findAllNodes(definitions, ['portType', 'wsdl:portType']);
    for (const pt of portTypes) {
      const name = pt['@_name'];
      if (name) {
        portTypesMap.set(this.stripPrefix(name), pt);
      }
    }

    // 4. Index Bindings
    const bindingsMap = new Map<string, any>();
    const bindings = this.findAllNodes(definitions, ['binding', 'wsdl:binding']);
    for (const b of bindings) {
      const name = b['@_name'];
      if (name) {
        bindingsMap.set(this.stripPrefix(name), b);
      }
    }

    // 5. Extract Services & Ports
    const services: WsdlService[] = [];
    const serviceNodes = this.findAllNodes(definitions, ['service', 'wsdl:service']);

    for (const sNode of serviceNodes) {
      const serviceName = sNode['@_name'] || 'DefaultService';
      const ports: WsdlPort[] = [];
      const portNodes = this.findAllNodes(sNode, ['port', 'wsdl:port']);

      for (const pNode of portNodes) {
        const portName = pNode['@_name'] || 'DefaultPort';
        const bindingAttr = pNode['@_binding'] || '';
        const bindingName = this.stripPrefix(bindingAttr);
        const bindingObj = bindingsMap.get(bindingName);

        // Find endpoint address
        let endpointUrl = sourceUrl || '';
        const addressNode = this.findAddressNode(pNode);
        if (addressNode && addressNode['@_location']) {
          endpointUrl = addressNode['@_location'];
        }

        // Determine SOAP Version (1.1 vs 1.2)
        const soapVersion = this.determineSoapVersion(pNode, bindingObj);

        // Find operations in binding
        const operations: WsdlOperation[] = [];
        if (bindingObj) {
          const bindingOps = this.findAllNodes(bindingObj, ['operation', 'wsdl:operation']);
          const portTypeName = this.stripPrefix(bindingObj['@_type'] || '');
          const portTypeObj = portTypesMap.get(portTypeName);

          for (const bOp of bindingOps) {
            const opName = bOp['@_name'];
            if (!opName) continue;

            // SOAP Action
            const soapOpNode = this.findFirstNode(bOp, ['soap:operation', 'soap12:operation', 'operation']);
            const soapAction = soapOpNode ? (soapOpNode['@_soapAction'] || soapOpNode['@_action'] || '') : '';
            const style = (soapOpNode && soapOpNode['@_style']) || 'document';

            // Find corresponding portType operation for input/output messages
            let inputMessageName: string | undefined;
            let outputMessageName: string | undefined;
            let doc: string | undefined;

            if (portTypeObj) {
              const ptOps = this.findAllNodes(portTypeObj, ['operation', 'wsdl:operation']);
              const matchedPtOp = ptOps.find((o: any) => o['@_name'] === opName);
              if (matchedPtOp) {
                const inputNode = this.findFirstNode(matchedPtOp, ['input', 'wsdl:input']);
                if (inputNode && inputNode['@_message']) {
                  inputMessageName = this.stripPrefix(inputNode['@_message']);
                }

                const outputNode = this.findFirstNode(matchedPtOp, ['output', 'wsdl:output']);
                if (outputNode && outputNode['@_message']) {
                  outputMessageName = this.stripPrefix(outputNode['@_message']);
                }

                const docNode = this.findFirstNode(matchedPtOp, ['documentation', 'wsdl:documentation']);
                if (docNode) {
                  doc = typeof docNode === 'string' ? docNode : (docNode['#text'] || '');
                }
              }
            }

            // Generate Sample SOAP Request XML
            const sampleRequestXml = this.generateSampleRequestXml({
              opName,
              soapVersion,
              targetNamespace,
              inputMessageName,
              messagesMap,
              elementsMap,
              typesMap,
              style,
            });

            operations.push({
              name: opName,
              soapAction,
              style: style as 'document' | 'rpc',
              soapVersion,
              endpointUrl,
              documentation: doc,
              inputMessageName,
              outputMessageName,
              sampleRequestXml,
            });
          }
        }

        ports.push({
          name: portName,
          bindingName,
          soapVersion,
          endpointUrl,
          operations,
        });
      }

      services.push({
        name: serviceName,
        ports,
      });
    }

    return {
      targetNamespace,
      services,
      rawXml: wsdlXml,
      sourceUrl,
    };
  }

  private extractSchemas(
    definitions: any,
    elementsMap: Map<string, SchemaElement>,
    typesMap: Map<string, SchemaType>
  ) {
    const typesNode = this.findFirstNode(definitions, ['types', 'wsdl:types']);
    if (!typesNode) return;

    const schemaNodes = this.findAllNodes(typesNode, ['schema', 'xs:schema', 'xsd:schema']);
    for (const schema of schemaNodes) {
      // 1. Process top-level complexTypes & simpleTypes
      const complexTypes = this.findAllNodes(schema, ['complexType', 'xs:complexType', 'xsd:complexType']);
      for (const ct of complexTypes) {
        const ctName = ct['@_name'];
        if (ctName) {
          const children = this.parseSequenceOrAll(ct);
          typesMap.set(this.stripPrefix(ctName), {
            name: ctName,
            isComplex: true,
            elements: children,
          });
        }
      }

      const simpleTypes = this.findAllNodes(schema, ['simpleType', 'xs:simpleType', 'xsd:simpleType']);
      for (const st of simpleTypes) {
        const stName = st['@_name'];
        if (stName) {
          const restriction = this.findFirstNode(st, ['restriction', 'xs:restriction', 'xsd:restriction']);
          const enums: string[] = [];
          if (restriction) {
            const enumNodes = this.findAllNodes(restriction, ['enumeration', 'xs:enumeration', 'xsd:enumeration']);
            for (const en of enumNodes) {
              if (en['@_value']) enums.push(en['@_value']);
            }
          }
          typesMap.set(this.stripPrefix(stName), {
            name: stName,
            isComplex: false,
            enums,
            baseType: restriction ? restriction['@_base'] : undefined,
          });
        }
      }

      // 2. Process top-level elements
      const elements = this.findAllNodes(schema, ['element', 'xs:element', 'xsd:element']);
      for (const el of elements) {
        const elName = el['@_name'];
        if (elName) {
          const parsedEl = this.parseSchemaElement(el);
          elementsMap.set(this.stripPrefix(elName), parsedEl);
        }
      }
    }
  }

  private parseSchemaElement(elNode: any): SchemaElement {
    const name = elNode['@_name'] || '';
    const type = elNode['@_type'] ? this.stripPrefix(elNode['@_type']) : undefined;
    const minOccurs = elNode['@_minOccurs'];
    const maxOccurs = elNode['@_maxOccurs'];

    // Check inline complexType
    const inlineCt = this.findFirstNode(elNode, ['complexType', 'xs:complexType', 'xsd:complexType']);
    if (inlineCt) {
      const children = this.parseSequenceOrAll(inlineCt);
      return {
        name,
        isComplex: true,
        children,
        minOccurs,
        maxOccurs,
      };
    }

    return {
      name,
      type,
      minOccurs,
      maxOccurs,
      isComplex: false,
    };
  }

  private parseSequenceOrAll(container: any): SchemaElement[] {
    const list: SchemaElement[] = [];
    const seq = this.findFirstNode(container, [
      'sequence',
      'xs:sequence',
      'xsd:sequence',
      'all',
      'xs:all',
      'xsd:all',
      'choice',
      'xs:choice',
      'xsd:choice',
    ]);
    if (!seq) return list;

    const elements = this.findAllNodes(seq, ['element', 'xs:element', 'xsd:element']);
    for (const el of elements) {
      list.push(this.parseSchemaElement(el));
    }
    return list;
  }

  private generateSampleRequestXml(params: {
    opName: string;
    soapVersion: SoapVersion;
    targetNamespace: string;
    inputMessageName?: string;
    messagesMap: Map<string, any>;
    elementsMap: Map<string, SchemaElement>;
    typesMap: Map<string, SchemaType>;
    style: string;
  }): string {
    const { opName, soapVersion, targetNamespace, inputMessageName, messagesMap, elementsMap, typesMap } = params;

    let bodyInnerXml = '';

    // Attempt to resolve root element from input message
    let rootElementName = opName;
    let rootElement: SchemaElement | undefined;

    if (inputMessageName && messagesMap.has(inputMessageName)) {
      const msgObj = messagesMap.get(inputMessageName);
      const parts = this.findAllNodes(msgObj, ['part', 'wsdl:part']);
      if (parts.length > 0) {
        const firstPart = parts[0];
        const elAttr = firstPart['@_element'];
        const typeAttr = firstPart['@_type'];

        if (elAttr) {
          const elKey = this.stripPrefix(elAttr);
          rootElementName = elKey;
          rootElement = elementsMap.get(elKey);
        } else if (typeAttr) {
          const typeKey = this.stripPrefix(typeAttr);
          const typeDef = typesMap.get(typeKey);
          if (typeDef) {
            rootElement = {
              name: firstPart['@_name'] || opName,
              isComplex: typeDef.isComplex,
              children: typeDef.elements,
            };
          }
        }
      }
    }

    if (!rootElement && elementsMap.has(opName)) {
      rootElement = elementsMap.get(opName);
    }

    if (rootElement) {
      bodyInnerXml = this.renderElementXml(rootElement, 'web', 2, elementsMap, typesMap, new Set());
    } else {
      // Fallback: render basic operation wrapper
      bodyInnerXml = `    <web:${opName}>\n      <!-- Add parameters here -->\n    </web:${opName}>`;
    }

    if (soapVersion === '1.2') {
      return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:web="${targetNamespace}">
  <soap:Header/>
  <soap:Body>
${bodyInnerXml}
  </soap:Body>
</soap:Envelope>`.trim();
    } else {
      return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${targetNamespace}">
  <soapenv:Header/>
  <soapenv:Body>
${bodyInnerXml}
  </soapenv:Body>
</soapenv:Envelope>`.trim();
    }
  }

  private renderElementXml(
    el: SchemaElement,
    nsPrefix: string,
    indent: number,
    elementsMap: Map<string, SchemaElement>,
    typesMap: Map<string, SchemaType>,
    visited: Set<string>
  ): string {
    const pad = '  '.repeat(indent);
    const tag = `${nsPrefix}:${el.name}`;

    // Cycle detection for recursive schemas
    if (el.type && visited.has(el.type)) {
      return `${pad}<${tag}><!-- recursive reference to ${el.type} --></${tag}>`;
    }

    // If element has direct children
    if (el.children && el.children.length > 0) {
      const childXml = el.children
        .map((child) => this.renderElementXml(child, nsPrefix, indent + 1, elementsMap, typesMap, visited))
        .join('\n');
      return `${pad}<${tag}>\n${childXml}\n${pad}</${tag}>`;
    }

    // If element references a complexType in typesMap
    if (el.type && typesMap.has(el.type)) {
      const typeDef = typesMap.get(el.type)!;
      if (typeDef.isComplex && typeDef.elements && typeDef.elements.length > 0) {
        const nextVisited = new Set(visited).add(el.type);
        const childXml = typeDef.elements
          .map((child) => this.renderElementXml(child, nsPrefix, indent + 1, elementsMap, typesMap, nextVisited))
          .join('\n');
        return `${pad}<${tag}>\n${childXml}\n${pad}</${tag}>`;
      }
      if (typeDef.enums && typeDef.enums.length > 0) {
        return `${pad}<${tag}>${typeDef.enums[0]}</${tag}>`;
      }
    }

    // Smart context-aware default values for common enterprise fields
    const elName = el.name.toLowerCase();
    if (elName === 'username') return `${pad}<${tag}>admin</${tag}>`;
    if (elName === 'apikey' || elName === 'api_key') return `${pad}<${tag}>secret123</${tag}>`;
    if (elName === 'productid' || elName === 'product_id') return `${pad}<${tag}>KB-99</${tag}>`;
    if (elName === 'quantity' || elName === 'qty') return `${pad}<${tag}>1</${tag}>`;
    if (elName === 'price' || elName === 'unitprice') return `${pad}<${tag}>129.99</${tag}>`;
    if (elName === 'discountpercent') return `${pad}<${tag}>15.0</${tag}>`;
    if (elName === 'name') return `${pad}<${tag}>John Doe</${tag}>`;
    if (elName === 'email') return `${pad}<${tag}>john@example.com</${tag}>`;
    if (elName === 'shippingaddress') return `${pad}<${tag}>123 Main Street</${tag}>`;

    // Simple placeholder based on type
    const placeholder = this.getPlaceholderForType(el.type);
    return `${pad}<${tag}>${placeholder}</${tag}>`;
  }

  private getPlaceholderForType(typeName?: string): string {
    if (!typeName) return '?string?';
    const cleanType = typeName.toLowerCase().replace(/^(xs:|xsd:)/, '');

    switch (cleanType) {
      case 'int':
      case 'integer':
      case 'short':
      case 'long':
      case 'byte':
        return '100';
      case 'decimal':
      case 'float':
      case 'double':
        return '0.00';
      case 'boolean':
        return 'true';
      case 'datetime':
        return new Date().toISOString();
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'time':
        return '12:00:00';
      case 'base64binary':
        return 'U09BUFRlc3Q=';
      default:
        return `?${cleanType}?`;
    }
  }

  private determineSoapVersion(pNode: any, bindingObj: any): SoapVersion {
    // Check port address
    if (pNode['soap12:address']) return '1.2';
    if (pNode['soap:address']) return '1.1';

    // Check binding
    if (bindingObj) {
      if (bindingObj['soap12:binding']) return '1.2';
      if (bindingObj['soap:binding']) return '1.1';
      const raw = JSON.stringify(bindingObj);
      if (raw.includes('http://schemas.xmlsoap.org/wsdl/soap12/')) return '1.2';
    }

    return '1.1';
  }

  private findAddressNode(pNode: any): any {
    return (
      pNode['soap:address'] ||
      pNode['soap12:address'] ||
      pNode['address'] ||
      this.findFirstNode(pNode, ['soap:address', 'soap12:address', 'address'])
    );
  }

  private findFirstNode(obj: any, candidates: string[]): any {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const key of Object.keys(obj)) {
      const strippedKey = this.stripPrefix(key);
      const isMatch = candidates.some((cand) => key === cand || strippedKey === this.stripPrefix(cand));
      if (isMatch) {
        const val = obj[key];
        return Array.isArray(val) ? val[0] : val;
      }
    }
    return undefined;
  }

  private findAllNodes(obj: any, candidates: string[]): any[] {
    const results: any[] = [];
    if (!obj || typeof obj !== 'object') return results;

    for (const key of Object.keys(obj)) {
      const strippedKey = this.stripPrefix(key);
      const isMatch = candidates.some((cand) => key === cand || strippedKey === this.stripPrefix(cand));
      if (isMatch) {
        const val = obj[key];
        if (Array.isArray(val)) {
          results.push(...val);
        } else if (val !== undefined && val !== null) {
          results.push(val);
        }
      }
    }
    return results;
  }

  private stripPrefix(name: string): string {
    const parts = name.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : name;
  }
}
