# WSDL Caller (Desktop Wizdler Alternative)

A modern, lightweight cross-platform Electron desktop application for discovering, inspecting, and executing SOAP web services from WSDL URLs or local files — without browser CORS limitations or SSL hurdles.

---

## Features

- **WSDL Ingestion:** Paste any remote WSDL URL or open local `.wsdl` / `.xml` files.
- **Service & Operation Explorer:** Hierarchical tree view displaying Services, Ports, and Operations with live search filter.
- **Automatic SOAP Request Generation:** Pre-generates standard SOAP 1.1 and SOAP 1.2 request envelopes populated with schema-aware typed placeholders.
- **XML Code Editor:** In-app XML editor powered by CodeMirror with syntax highlighting, bracket matching, and one-click XML beautification.
- **CORS-Free Execution:** Dispatches HTTP/HTTPS requests from Node.js, completely bypassing browser CORS restrictions.
- **Custom Headers & Authentication:** Configure custom headers, SOAPAction, HTTP Basic Auth, Bearer Token, and WS-Security (UsernameToken).
- **SSL / TLS Flexibility:** Toggle between strict SSL validation and developer-friendly insecure mode (for internal servers with self-signed certificates).
- **Response Diagnostics:** View formatted response XML, raw response, response headers, latency in ms, payload size, and dedicated **SOAP Fault** alert callouts.
- **Call History:** Automatic tracking and reload of recent SOAP invocations.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- `npm`

### Installation

```bash
npm install
```

### Running in Development

To start the Vite development server with Electron hot reload:

```bash
npm run dev
```

### Building for Production

Compile the Electron main process, preload script, and React renderer:

```bash
npm run build
```

To run the built production package:

```bash
npm start
```

### Starting the Dummy SOAP Server

To test operations, complex types, and SOAP Faults with the local mock service:

```bash
# Start just the dummy server (http://localhost:8001/ws/shop?wsdl):
npm run dummy-server
# or: npm run start:dummy

# Or start both the dummy server AND the desktop app together:
npm run start:all
```

#### Dummy Server Features:
- **Body Authentication:** Validates `<auth>` block in the request body. Valid credentials configured in `dummy-server/data.json`:
  - **Username:** `admin` | **API Key:** `secret123`
  - **Username:** `tester` | **API Key:** `soap2026`
- **JSON Data Source ([`data.json`](dummy-server/data.json)):**
  - Live catalogue querying (`KB-99`, `MS-01`, `MN-4K`, `HD-700`).
  - Real-time stock decrementing and order persistence upon executing `PlaceOrder`.
  - Realistic SOAP Faults if unauthenticated or if product IDs do not exist.

---

### Running Tests

- **Run all E2E Electron tests:**
  ```bash
  npm run test:e2e
  ```

- **Run E2E tests in Headed Mode (watches the real Electron window live on screen):**
  ```bash
  npm run test:e2e:headed
  ```

- **Run Dummy WSDL Service standalone unit test:**
  ```bash
  npm test
  ```

---

## Built With

- **Shell:** Electron
- **UI:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **XML Editor:** `@uiw/react-codemirror` with `@codemirror/lang-xml`
- **WSDL / XML Engine:** `fast-xml-parser`
- **Bundler:** Vite + esbuild
