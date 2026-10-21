import { contextBridge, ipcRenderer } from 'electron';
import {
  ParsedWsdl,
  SoapRequestPayload,
  SoapResponsePayload,
  RequestHistoryItem,
} from '../types/wsdl';

export interface WsdlApi {
  loadWsdl: (params: { urlOrPath: string; isLocal: boolean; ignoreSsl?: boolean }) => Promise<ParsedWsdl>;
  sendSoapRequest: (payload: SoapRequestPayload) => Promise<SoapResponsePayload>;
  openFileDialog: () => Promise<string | null>;
  getHistory: () => Promise<RequestHistoryItem[]>;
  saveHistoryItem: (item: RequestHistoryItem) => Promise<RequestHistoryItem[]>;
  clearHistory: () => Promise<RequestHistoryItem[]>;
}

const wsdlApi: WsdlApi = {
  loadWsdl: (params) => ipcRenderer.invoke('load-wsdl', params),
  sendSoapRequest: (payload) => ipcRenderer.invoke('send-soap-request', payload),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistoryItem: (item) => ipcRenderer.invoke('save-history-item', item),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
};

contextBridge.exposeInMainWorld('wsdlApi', wsdlApi);

declare global {
  interface Window {
    wsdlApi: WsdlApi;
  }
}
