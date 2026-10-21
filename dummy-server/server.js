const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const WSDL_PATH = path.join(__dirname, 'shop.wsdl');
const DATA_PATH = path.join(__dirname, 'data.json');
const wsdlContent = fs.readFileSync(WSDL_PATH, 'utf-8');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to read data.json:', err);
    return { apiUsers: [], products: [], orders: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write data.json:', err);
  }
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<[^:]*?:?${tag}[^>]*>([\\s\\S]*?)<\\/[^:]*?:?${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function authenticate(xmlBody, data, req) {
  // 1. Check HTTP Basic Auth Header
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [u, p] = creds.split(':');
    const user = data.apiUsers.find(x => x.username === u && x.apiKey === p);
    if (user) return { authenticated: true, user };
    return { authenticated: false, reason: `Invalid HTTP Basic Auth credentials for '${u}'.` };
  }

  // 2. Check WS-Security UsernameToken in Header
  if (xmlBody.includes('wsse:UsernameToken')) {
    const u = extractTag(xmlBody, 'Username');
    const p = extractTag(xmlBody, 'Password');
    const user = data.apiUsers.find(x => x.username === u && x.apiKey === p);
    if (user) return { authenticated: true, user };
    return { authenticated: false, reason: `Invalid WS-Security credentials for '${u}'.` };
  }

  // 3. Check Body <auth> Block
  const authBlock = extractTag(xmlBody, 'auth');
  if (authBlock) {
    const username = extractTag(authBlock, 'username');
    const apiKey = extractTag(authBlock, 'apiKey');

    // Default template placeholder or empty -> accept as default admin
    if (!username || !apiKey || username === '?string?' || apiKey === '?string?') {
      return { authenticated: true, user: data.apiUsers[0] };
    }

    const user = data.apiUsers.find(u => u.username === username && u.apiKey === apiKey);
    if (user) {
      return { authenticated: true, user };
    }

    // Explicitly invalid credentials
    return {
      authenticated: false,
      reason: `Invalid credentials for user '${username}'. Valid test accounts: admin / secret123, tester / soap2026.`
    };
  }

  // If no auth element found, default to admin for smooth testing
  return { authenticated: true, user: data.apiUsers[0] };
}

function buildSoapFault(isSoap12, faultCode, faultString, detail) {
  if (isSoap12) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:shop="http://dummy.shop.com/webservices">
  <soap:Body>
    <soap:Fault>
      <soap:Code><soap:Value>${faultCode}</soap:Value></soap:Code>
      <soap:Reason><soap:Text xml:lang="en">${faultString}</soap:Text></soap:Reason>
      ${detail ? `<soap:Detail>${detail}</soap:Detail>` : ''}
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`.trim();
  } else {
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shop="http://dummy.shop.com/webservices">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>${faultCode}</faultcode>
      <faultstring>${faultString}</faultstring>
      ${detail ? `<detail>${detail}</detail>` : ''}
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`.trim();
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[DummyServer] ${req.method} ${url.pathname}${url.search}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve WSDL
  if (req.method === 'GET' && (url.pathname.includes('/ws/shop') || url.pathname === '/')) {
    res.writeHead(200, {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(wsdlContent),
    });
    res.end(wsdlContent);
    return;
  }

  // Handle SOAP Requests
  if (req.method === 'POST' && url.pathname.startsWith('/ws/shop')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      const isSoap12 = (req.headers['content-type'] || '').includes('application/soap+xml');
      const soapAction = req.headers['soapaction'] || '';
      const data = loadData();

      const contentType = isSoap12
        ? 'application/soap+xml; charset=utf-8'
        : 'text/xml; charset=utf-8';

      // 1. Authenticate Request Body
      const authResult = authenticate(body, data, req);
      if (!authResult.authenticated) {
        console.log(`[DummyServer] Auth Failed: ${authResult.reason}`);
        const faultXml = buildSoapFault(
          isSoap12,
          isSoap12 ? 'soap:Sender.AuthenticationFailed' : 'soapenv:Client.AuthenticationFailed',
          authResult.reason,
          `<shop:AuthError>Provide valid credentials (username: 'admin', apiKey: 'secret123')</shop:AuthError>`
        );
        res.writeHead(500, { 'Content-Type': contentType });
        res.end(faultXml);
        return;
      }

      console.log(`[DummyServer] Authenticated user: ${authResult.user.username} (${authResult.user.role})`);

      // 2. TriggerFault Operation (For testing faults explicitly)
      if (body.includes('TriggerFault') || soapAction.includes('TriggerFault')) {
        const reason = extractTag(body, 'reason') || 'Manual fault test';
        const faultXml = buildSoapFault(
          isSoap12,
          isSoap12 ? 'soap:Sender.InvalidState' : 'soapenv:Client.InvalidState',
          reason,
          `<shop:ErrorDetail><shop:ErrorCode>ERR_MANUAL_TRIGGER</shop:ErrorCode></shop:ErrorDetail>`
        );
        res.writeHead(500, { 'Content-Type': contentType });
        res.end(faultXml);
        return;
      }

      // 3. GetProductDetails (Real JSON Lookup)
      if (body.includes('GetProductDetails') || soapAction.includes('GetProductDetails')) {
        let productId = extractTag(body, 'productId') || 'KB-99';
        if (productId === '?string?' || !productId.trim()) {
          productId = 'KB-99';
        }
        const product = data.products.find(p => p.id.toLowerCase() === productId.toLowerCase());

        if (!product) {
          const faultXml = buildSoapFault(
            isSoap12,
            isSoap12 ? 'soap:Sender.ProductNotFound' : 'soapenv:Client.ProductNotFound',
            `Product with ID '${productId}' was not found in data.json.`,
            `<shop:ProductError><shop:RequestedId>${productId}</shop:RequestedId><shop:AvailableIds>${data.products.map(p => p.id).join(', ')}</shop:AvailableIds></shop:ProductError>`
          );
          res.writeHead(500, { 'Content-Type': contentType });
          res.end(faultXml);
          return;
        }

        const responseXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shop="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <shop:GetProductDetailsResponse>
      <shop:productId>${product.id}</shop:productId>
      <shop:title>${product.title}</shop:title>
      <shop:price>${product.price.toFixed(2)}</shop:price>
      <shop:inStock>${product.inStock}</shop:inStock>
      <shop:stockCount>${product.stockCount}</shop:stockCount>
      <shop:rating>${product.rating.toFixed(1)}</shop:rating>
      <shop:category>${product.category}</shop:category>
    </shop:GetProductDetailsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(responseXml.trim());
        return;
      }

      // 4. ListProducts (Real JSON Query)
      if (body.includes('ListProducts') || soapAction.includes('ListProducts')) {
        const categoryFilter = extractTag(body, 'category');
        let filtered = data.products;
        if (categoryFilter && categoryFilter !== '?string?') {
          filtered = data.products.filter(p => p.category.toLowerCase().includes(categoryFilter.toLowerCase()));
        }

        const productsXml = filtered.map(p => `
        <shop:product>
          <shop:id>${p.id}</shop:id>
          <shop:title>${p.title}</shop:title>
          <shop:price>${p.price.toFixed(2)}</shop:price>
          <shop:inStock>${p.inStock}</shop:inStock>
          <shop:category>${p.category}</shop:category>
        </shop:product>`).join('');

        const responseXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shop="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <shop:ListProductsResponse>
      <shop:totalFound>${filtered.length}</shop:totalFound>
      <shop:products>${productsXml}
      </shop:products>
    </shop:ListProductsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(responseXml.trim());
        return;
      }

      // 5. PlaceOrder (Persists to data.json & Decrements Stock)
      if (body.includes('PlaceOrder') || soapAction.includes('PlaceOrder')) {
        const itemBlock = extractTag(body, 'item') || '';
        const customerBlock = extractTag(body, 'customer') || '';

        let productId = extractTag(itemBlock, 'productId') || 'KB-99';
        if (productId === '?string?' || !productId.trim()) productId = 'KB-99';

        let quantity = parseInt(extractTag(itemBlock, 'quantity') || '1', 10);
        if (isNaN(quantity) || quantity > 20 || quantity <= 0) quantity = 1;

        const customerName = extractTag(customerBlock, 'name') || 'Valued Customer';
        const customerEmail = extractTag(customerBlock, 'email') || 'customer@example.com';

        const product = data.products.find(p => p.id.toLowerCase() === productId.toLowerCase()) || data.products[0];
        if (!product) {
          const faultXml = buildSoapFault(
            isSoap12,
            isSoap12 ? 'soap:Sender.OrderError' : 'soapenv:Client.OrderError',
            `Cannot place order: Product '${productId}' does not exist.`,
            null
          );
          res.writeHead(500, { 'Content-Type': contentType });
          res.end(faultXml);
          return;
        }

        if (product.stockCount < quantity) {
          const faultXml = buildSoapFault(
            isSoap12,
            isSoap12 ? 'soap:Sender.InsufficientStock' : 'soapenv:Client.InsufficientStock',
            `Insufficient stock for '${product.title}'. Requested: ${quantity}, Available: ${product.stockCount}`,
            `<shop:StockDetail><shop:Available>${product.stockCount}</shop:Available></shop:StockDetail>`
          );
          res.writeHead(500, { 'Content-Type': contentType });
          res.end(faultXml);
          return;
        }

        // Deduct inventory
        product.stockCount -= quantity;
        if (product.stockCount <= 0) {
          product.inStock = false;
        }

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const totalAmount = parseFloat((product.price * quantity).toFixed(2));
        const estimatedDelivery = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

        // Append to data.json orders
        data.orders.push({
          orderId,
          customerName,
          customerEmail,
          productId: product.id,
          quantity,
          totalAmount,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString()
        });

        saveData(data);
        console.log(`[DummyServer] New order placed & persisted: ${orderId} (total: $${totalAmount})`);

        const responseXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shop="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <shop:PlaceOrderResponse>
      <shop:orderId>${orderId}</shop:orderId>
      <shop:status>CONFIRMED</shop:status>
      <shop:productTitle>${product.title}</shop:productTitle>
      <shop:quantity>${quantity}</shop:quantity>
      <shop:totalAmount>${totalAmount.toFixed(2)}</shop:totalAmount>
      <shop:estimatedDelivery>${estimatedDelivery}</shop:estimatedDelivery>
    </shop:PlaceOrderResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(responseXml.trim());
        return;
      }

      // 6. CalculateDiscount
      if (body.includes('CalculateDiscount') || soapAction.includes('CalculateDiscount')) {
        const price = parseFloat(extractTag(body, 'price') || '100');
        const discountPercent = parseFloat(extractTag(body, 'discountPercent') || '20');
        const saved = (price * (discountPercent / 100)).toFixed(2);
        const discounted = (price - parseFloat(saved)).toFixed(2);

        const responseXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shop="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <shop:CalculateDiscountResponse>
      <shop:discountedPrice>${discounted}</shop:discountedPrice>
      <shop:savedAmount>${saved}</shop:savedAmount>
    </shop:CalculateDiscountResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(responseXml.trim());
        return;
      }

      // Generic
      const genericXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body><Status>OK</Status></soapenv:Body>
</soapenv:Envelope>`;
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(genericXml);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[DummyServer] Real JSON SOAP WSDL Service running on http://localhost:${PORT}/ws/shop?wsdl`);
});
