import { WsdlParser } from '../src/main/wsdlParser';
import { SoapHttpClient } from '../src/main/httpClient';
import fs from 'fs';
import path from 'path';

async function testDummyWsdl() {
  console.log('========================================================');
  console.log('TESTING WSDL CALLER APP: BODY AUTH & JSON DATA SOURCE');
  console.log('========================================================\n');

  const parser = new WsdlParser();
  const client = new SoapHttpClient();

  // 1. Fetch and Parse WSDL
  console.log('[Step 1] Fetching updated WSDL from http://localhost:8001/ws/shop?wsdl ...');
  const wsdlContent = await client.fetchWsdl('http://localhost:8001/ws/shop?wsdl');
  console.log(`✓ Fetched WSDL: ${wsdlContent.length} bytes`);

  const parsed = parser.parse(wsdlContent, 'http://localhost:8001/ws/shop?wsdl');
  console.log(`✓ Services Found: ${parsed.services.map((s) => s.name).join(', ')}`);

  const soap11Port = parsed.services[0].ports.find((p) => p.soapVersion === '1.1')!;
  console.log(`✓ Operations: ${soap11Port.operations.map((o) => o.name).join(', ')}\n`);

  // 2. Test Auth Failure (Invalid credentials in body)
  console.log('[Step 2] Testing Request Body Auth Failure (Invalid credentials)');
  const getProductOp = soap11Port.operations.find((o) => o.name === 'GetProductDetails')!;
  const badAuthXml = getProductOp.sampleRequestXml.replace(
    '<web:apiKey>secret123</web:apiKey>',
    '<web:apiKey>wrong_password</web:apiKey>'
  );

  const unauthRes = await client.sendRequest({
    url: getProductOp.endpointUrl,
    soapAction: getProductOp.soapAction,
    soapVersion: getProductOp.soapVersion,
    body: badAuthXml,
    headers: {},
    ignoreSsl: true,
    timeoutMs: 5000,
  });
  console.log(`Response Status: ${unauthRes.status} (Expected 500 Authentication Failed)`);
  console.log(`Fault Code: ${unauthRes.faultDetails?.faultCode}`);
  console.log(`Fault String: ${unauthRes.faultDetails?.faultString}`);
  if (unauthRes.isFault && unauthRes.faultDetails?.faultCode.includes('AuthenticationFailed')) {
    console.log('✓ Body Authentication rejection SUCCESS!\n');
  } else {
    throw new Error('Expected authentication failure but received success');
  }

  // 3. Test Auth Success & Real JSON Data Lookup (GetProductDetails)
  console.log('[Step 3] Testing Valid Auth + Real JSON Lookup for product "KB-99"');
  const authenticatedXml = getProductOp.sampleRequestXml
    .replace('<web:username>?string?</web:username>', '<web:username>admin</web:username>')
    .replace('<web:apiKey>?string?</web:apiKey>', '<web:apiKey>secret123</web:apiKey>')
    .replace('<web:productId>?string?</web:productId>', '<web:productId>KB-99</web:productId>');

  const authRes = await client.sendRequest({
    url: getProductOp.endpointUrl,
    soapAction: getProductOp.soapAction,
    soapVersion: getProductOp.soapVersion,
    body: authenticatedXml,
    headers: {},
    ignoreSsl: true,
    timeoutMs: 5000,
  });
  console.log(`Response Status: ${authRes.status} ${authRes.statusText} (${authRes.durationMs}ms)`);
  console.log('Response Body:\n' + authRes.formattedBody);
  if (!authRes.isFault && authRes.formattedBody.includes('Ultra Wireless Mechanical Keyboard') && authRes.formattedBody.includes('129.99')) {
    console.log('✓ Authenticated JSON catalogue lookup SUCCESS!\n');
  } else {
    throw new Error('GetProductDetails failed JSON verification');
  }

  // 4. Test ListProducts (Querying JSON catalogue)
  console.log('[Step 4] Testing Operation: ListProducts (Query all from data.json)');
  const listOp = soap11Port.operations.find((o) => o.name === 'ListProducts')!;
  const listXml = listOp.sampleRequestXml
    .replace('<web:username>?string?</web:username>', '<web:username>admin</web:username>')
    .replace('<web:apiKey>?string?</web:apiKey>', '<web:apiKey>secret123</web:apiKey>')
    .replace('<web:category>?string?</web:category>', '<web:category>Peripherals</web:category>');

  const listRes = await client.sendRequest({
    url: listOp.endpointUrl,
    soapAction: listOp.soapAction,
    soapVersion: listOp.soapVersion,
    body: listXml,
    headers: {},
    ignoreSsl: true,
    timeoutMs: 5000,
  });
  console.log(`Response Status: ${listRes.status} ${listRes.statusText}`);
  console.log('Response Body:\n' + listRes.formattedBody);
  if (!listRes.isFault && listRes.formattedBody.includes('totalFound')) {
    console.log('✓ ListProducts JSON query SUCCESS!\n');
  } else {
    throw new Error('ListProducts failed');
  }

  // 5. Test PlaceOrder (Persisting into data.json & inventory check)
  console.log('[Step 5] Testing Operation: PlaceOrder (Persisting new order to data.json)');
  const placeOrderOp = soap11Port.operations.find((o) => o.name === 'PlaceOrder')!;
  const orderXml = placeOrderOp.sampleRequestXml
    .replace('<web:username>?string?</web:username>', '<web:username>admin</web:username>')
    .replace('<web:apiKey>?string?</web:apiKey>', '<web:apiKey>secret123</web:apiKey>')
    .replace('<web:name>?string?</web:name>', '<web:name>John Doe</web:name>')
    .replace('<web:email>?string?</web:email>', '<web:email>john@example.com</web:email>')
    .replace('<web:productId>?string?</web:productId>', '<web:productId>MS-01</web:productId>')
    .replace('<web:quantity>100</web:quantity>', '<web:quantity>2</web:quantity>')
    .replace('<web:shippingAddress>?string?</web:shippingAddress>', '<web:shippingAddress>123 Main St</web:shippingAddress>');

  const orderRes = await client.sendRequest({
    url: placeOrderOp.endpointUrl,
    soapAction: placeOrderOp.soapAction,
    soapVersion: placeOrderOp.soapVersion,
    body: orderXml,
    headers: {},
    ignoreSsl: true,
    timeoutMs: 5000,
  });
  console.log(`Response Status: ${orderRes.status} ${orderRes.statusText}`);
  console.log('Response Body:\n' + orderRes.formattedBody);

  // Check data.json to verify persistence!
  const dbData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dummy-server/data.json'), 'utf-8'));
  const foundOrder = dbData.orders.find((o: any) => o.customerName === 'John Doe' && o.productId === 'MS-01');
  if (foundOrder) {
    console.log(`✓ Order successfully verified in data.json file! Order ID: ${foundOrder.orderId}, Total: $${foundOrder.totalAmount}\n`);
  } else {
    throw new Error('Order was not persisted in data.json');
  }

  console.log('========================================================');
  console.log('ALL AUTH & JSON DATA SOURCE TESTS PASSED! 🚀');
  console.log('========================================================');
}

testDummyWsdl().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
