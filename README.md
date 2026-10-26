# WSDL Caller (Desktop Wizdler Alternative)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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

## Packaging & Standalone Binaries

Build standalone executables and distributable packages using `electron-builder`:

```bash
# Package Debian Linux (.deb) & AppImage
npm run package:deb
# or
npm run package:linux

# Package Windows Standalone (.exe) & NSIS Setup Installer
npm run package:win

# Pack unpacked directory for local verification
npm run package:dir
```

All built artifacts will be located in the `release/` directory:
- **Debian (.deb):** `release/wsdl-caller_<version>_amd64.deb`
- **Linux AppImage:** `release/WSDL-Caller-<version>.AppImage`
- **Windows Standalone (.exe):** `release/WSDL-Caller-<version>-windows-standalone.exe` (portable, no install required)
- **Windows Setup (.exe):** `release/WSDL-Caller-<version>-windows-setup.exe`

---

## Continuous Integration & Automated Builds (GitHub Actions)

A full multi-platform CI/CD pipeline is configured in [`.github/workflows/build.yml`](.github/workflows/build.yml):

- **Triggers:** Automatically runs on pushes to `main`/`master`, pull requests, tag pushes (`v*`), or via manual trigger (`workflow_dispatch`).
- **Linux Job (`ubuntu-latest`):** Builds the Debian `.deb` package and Linux `AppImage`.
- **Windows Job (`windows-latest`):** Builds the Windows standalone portable executable (`.exe`) and NSIS installer (`.exe`).
- **Release Automation:** Pushing a version tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) automatically creates a GitHub Release and attaches the Debian `.deb` and Windows standalone `.exe` binaries as downloadable assets.

---

## Built With

- **Shell:** Electron
- **UI:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **XML Editor:** `@uiw/react-codemirror` with `@codemirror/lang-xml`
- **WSDL / XML Engine:** `fast-xml-parser`
- **Bundler:** Vite + esbuild

---

## License

This project is licensed under the [MIT License](LICENSE).

