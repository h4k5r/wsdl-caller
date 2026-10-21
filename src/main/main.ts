import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { WsdlParser } from './wsdlParser';
import { SoapHttpClient } from './httpClient';
import { ParsedWsdl, SoapRequestPayload, SoapResponsePayload, RequestHistoryItem } from '../types/wsdl';

let mainWindow: BrowserWindow | null = null;
const parser = new WsdlParser();
const httpClient = new SoapHttpClient();

function getHistoryFilePath(): string {
  try {
    return path.join(app.getPath('userData'), 'wsdl_caller_history.json');
  } catch {
    return path.join(process.cwd(), '.wsdl_caller_history.json');
  }
}

function loadHistory(): RequestHistoryItem[] {
  try {
    const historyPath = getHistoryFilePath();
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
  return [];
}

function saveHistory(history: RequestHistoryItem[]) {
  try {
    const historyPath = getHistoryFilePath();
    fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 100), null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'WSDL Caller',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('load-wsdl', async (_, { urlOrPath, isLocal, ignoreSsl = true }): Promise<ParsedWsdl> => {
  let xmlContent = '';
  let sourceUrl = urlOrPath;

  if (isLocal) {
    xmlContent = fs.readFileSync(urlOrPath, 'utf-8');
  } else {
    xmlContent = await httpClient.fetchWsdl(urlOrPath, ignoreSsl);
  }

  return parser.parse(xmlContent, sourceUrl);
});

ipcMain.handle('send-soap-request', async (_, payload: SoapRequestPayload): Promise<SoapResponsePayload> => {
  return httpClient.sendRequest(payload);
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'WSDL / XML Files', extensions: ['wsdl', 'xml', 'xsd'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-history', async (): Promise<RequestHistoryItem[]> => {
  return loadHistory();
});

ipcMain.handle('save-history-item', async (_, item: RequestHistoryItem) => {
  const history = loadHistory();
  const updated = [item, ...history.filter((h) => h.id !== item.id)];
  saveHistory(updated);
  return updated;
});

ipcMain.handle('clear-history', async () => {
  saveHistory([]);
  return [];
});
