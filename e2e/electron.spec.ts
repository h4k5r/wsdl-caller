import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launch the Electron application
  electronApp = await electron.launch({
    args: ['--no-sandbox', path.join(__dirname, '..')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('WSDL Caller Electron App E2E', () => {
  test('1. App launches with correct title and initial UI layout', async () => {
    const title = await window.title();
    expect(title).toBe('WSDL Caller');

    // Check navbar branding
    await expect(window.locator('text=WSDL Caller')).toBeVisible();
    await expect(window.locator('text=SOAP Client')).toBeVisible();

    // Check explorer initial empty state
    await expect(window.locator('text=No WSDL loaded yet')).toBeVisible();
  });

  test('2. Load dummy WSDL and inspect services, ports, and operations', async () => {
    // Select local dummy shop from sample dropdown
    const select = window.locator('select');
    await select.selectOption('http://localhost:8001/ws/shop?wsdl');

    // Wait for services to parse and populate the sidebar
    const sidebar = window.locator('aside');
    await expect(sidebar.locator('text=ShopService')).toBeVisible({ timeout: 5000 });
    await expect(sidebar.locator('text=ShopSoap11Port')).toBeVisible();
    await expect(sidebar.locator('text=ShopSoap12Port')).toBeVisible();

    // Verify operations under SOAP 1.1 Port
    await expect(sidebar.locator('button:has-text("GetProductDetails")').first()).toBeVisible();
    await expect(sidebar.locator('button:has-text("PlaceOrder")').first()).toBeVisible();
    await expect(sidebar.locator('button:has-text("CalculateDiscount")').first()).toBeVisible();
    await expect(sidebar.locator('button:has-text("TriggerFault")').first()).toBeVisible();
  });

  test('3. Select GetProductDetails, inspect XML envelope, and execute request', async () => {
    const sidebar = window.locator('aside');
    // Click GetProductDetails in sidebar
    await sidebar.locator('button:has-text("GetProductDetails")').first().click();

    // Check endpoint input populated
    const endpointInput = window.locator('input[placeholder*="service-endpoint-url"]');
    await expect(endpointInput).toHaveValue('http://localhost:8001/ws/shop');

    // Check sample XML generated inside CodeMirror with auth block
    const editor = window.locator('.cm-content').first();
    await expect(editor).toContainText('GetProductDetailsRequest');
    await expect(editor).toContainText('apiKey');

    // Replace placeholders with real admin credentials & product KB-99
    await editor.click();
    await window.keyboard.press('Control+A');
    await window.keyboard.insertText(`<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <web:GetProductDetailsRequest>
      <web:auth>
        <web:username>admin</web:username>
        <web:apiKey>secret123</web:apiKey>
      </web:auth>
      <web:productId>KB-99</web:productId>
    </web:GetProductDetailsRequest>
  </soapenv:Body>
</soapenv:Envelope>`);

    // Click Send
    const sendButton = window.locator('button:has-text("Send")');
    await sendButton.click();

    // Verify 200 OK status badge
    await expect(window.locator('text=200 OK')).toBeVisible({ timeout: 5000 });

    // Verify response body rendered in response viewer from real data.json
    const responseView = window.locator('.cm-content').last();
    await expect(responseView).toContainText('Ultra Wireless Mechanical Keyboard');
    await expect(responseView).toContainText('129.99');
  });

  test('4. Execute TriggerFault and verify SOAP Fault diagnostics banner', async () => {
    const sidebar = window.locator('aside');
    // Click TriggerFault in sidebar
    await sidebar.locator('button:has-text("TriggerFault")').first().click();

    const editor = window.locator('.cm-content').first();
    await expect(editor).toContainText('TriggerFaultRequest');

    // Insert authenticated TriggerFault XML
    await editor.click();
    await window.keyboard.press('Control+A');
    await window.keyboard.insertText(`<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://dummy.shop.com/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <web:TriggerFaultRequest>
      <web:auth>
        <web:username>admin</web:username>
        <web:apiKey>secret123</web:apiKey>
      </web:auth>
      <web:reason>Item is out of stock</web:reason>
    </web:TriggerFaultRequest>
  </soapenv:Body>
</soapenv:Envelope>`);

    // Click Send
    await window.locator('button:has-text("Send")').click();

    // Verify 500 status and SOAP Fault banner appears
    await expect(window.locator('text=SOAP Fault')).toBeVisible({ timeout: 5000 });
    const faultBanner = window.locator('.bg-rose-950\\/40');
    await expect(faultBanner.locator('text=soapenv:Client.InvalidState')).toBeVisible();
    await expect(faultBanner.locator('text=Item is out of stock')).toBeVisible();
  });

  test('5. Verify Request History tracking modal', async () => {
    // Click History button in navbar
    await window.locator('button:has-text("History")').click();

    // Verify History modal appears with logged calls
    await expect(window.locator('h2:has-text("Request History")')).toBeVisible();

    // Verify logged operations are present in history modal
    const historyModal = window.locator('div[role="dialog"], .fixed.inset-0');
    await expect(historyModal.locator('span:has-text("GetProductDetails")').first()).toBeVisible();
    await expect(historyModal.locator('span:has-text("TriggerFault")').first()).toBeVisible();

    // Close history modal
    await window.locator('button:has(svg.lucide-x)').click();
    await expect(window.locator('h2:has-text("Request History")')).not.toBeVisible();
  });
});
