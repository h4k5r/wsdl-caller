import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ServiceSidebar } from './components/ServiceSidebar';
import { RequestPane } from './components/RequestPane';
import { ResponsePane } from './components/ResponsePane';
import { HistoryModal } from './components/HistoryModal';
import {
  ParsedWsdl,
  WsdlService,
  WsdlPort,
  WsdlOperation,
  SoapResponsePayload,
  RequestHistoryItem,
  AuthConfig,
} from '../types/wsdl';

export const App: React.FC = () => {
  const [wsdlUrl, setWsdlUrl] = useState('');
  const [parsedWsdl, setParsedWsdl] = useState<ParsedWsdl | null>(null);
  const [isLoadingWsdl, setIsLoadingWsdl] = useState(false);
  const [ignoreSsl, setIgnoreSsl] = useState(true);

  const [selectedOperation, setSelectedOperation] = useState<{
    service: WsdlService;
    port: WsdlPort;
    operation: WsdlOperation;
  } | null>(null);

  const [response, setResponse] = useState<SoapResponsePayload | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Load history on startup
  useEffect(() => {
    if (window.wsdlApi) {
      window.wsdlApi
        .getHistory()
        .then(setHistory)
        .catch((err) => console.error('Failed to load history:', err));
    }
  }, []);

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  const handleLoadWsdl = async (urlOrPath: string, isLocal = false) => {
    if (!urlOrPath.trim()) return;

    setIsLoadingWsdl(true);
    setErrorToast(null);

    try {
      const parsed = await window.wsdlApi.loadWsdl({
        urlOrPath: urlOrPath.trim(),
        isLocal,
        ignoreSsl,
      });

      setParsedWsdl(parsed);

      // Auto-select first operation if available
      if (
        parsed.services.length > 0 &&
        parsed.services[0].ports.length > 0 &&
        parsed.services[0].ports[0].operations.length > 0
      ) {
        setSelectedOperation({
          service: parsed.services[0],
          port: parsed.services[0].ports[0],
          operation: parsed.services[0].ports[0].operations[0],
        });
      }
    } catch (err: any) {
      console.error('WSDL parse error:', err);
      showError(err.message || 'Failed to load and parse WSDL.');
    } finally {
      setIsLoadingWsdl(false);
    }
  };

  const handleSendRequest = async (params: {
    endpointUrl: string;
    body: string;
    headers: Record<string, string>;
    auth: AuthConfig;
  }) => {
    if (!selectedOperation) return;

    setIsSending(true);
    setResponse(null);
    setErrorToast(null);

    try {
      const res = await window.wsdlApi.sendSoapRequest({
        url: params.endpointUrl,
        soapAction: selectedOperation.operation.soapAction,
        soapVersion: selectedOperation.operation.soapVersion,
        body: params.body,
        headers: params.headers,
        auth: params.auth,
        ignoreSsl,
        timeoutMs: 30000,
      });

      setResponse(res);

      // Record History item
      const historyItem: RequestHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        serviceName: selectedOperation.service.name,
        portName: selectedOperation.port.name,
        operationName: selectedOperation.operation.name,
        endpointUrl: params.endpointUrl,
        soapVersion: selectedOperation.operation.soapVersion,
        requestXml: params.body,
        responseStatus: res.status,
        durationMs: res.durationMs,
        isFault: res.isFault,
      };

      const updatedHistory = await window.wsdlApi.saveHistoryItem(historyItem);
      setHistory(updatedHistory);
    } catch (err: any) {
      console.error('Request execution error:', err);
      showError(err.message || 'Error occurred while sending SOAP request.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectHistoryItem = (item: RequestHistoryItem) => {
    if (!parsedWsdl) return;

    for (const service of parsedWsdl.services) {
      for (const port of service.ports) {
        const found = port.operations.find((op) => op.name === item.operationName);
        if (found) {
          setSelectedOperation({
            service,
            port,
            operation: {
              ...found,
              sampleRequestXml: item.requestXml,
            },
          });
          return;
        }
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      const cleared = await window.wsdlApi.clearHistory();
      setHistory(cleared);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Top Navbar */}
      <Navbar
        wsdlUrl={wsdlUrl}
        onUrlChange={setWsdlUrl}
        onLoadWsdl={handleLoadWsdl}
        isLoading={isLoadingWsdl}
        ignoreSsl={ignoreSsl}
        onToggleIgnoreSsl={() => setIgnoreSsl((prev) => !prev)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
      />

      {/* Main Workspace (3 columns) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Services & Operations Explorer */}
        <ServiceSidebar
          parsedWsdl={parsedWsdl}
          selectedOperation={selectedOperation}
          onSelectOperation={(service, port, operation) => {
            setSelectedOperation({ service, port, operation });
            setResponse(null);
            setErrorToast(null);
          }}
        />

        {/* Center: Request Pane (Endpoint, Editor, Headers, Auth) */}
        <div className="flex-1 flex overflow-hidden">
          <RequestPane
            selected={selectedOperation}
            onSendRequest={handleSendRequest}
            isSending={isSending}
          />

          {/* Right: Response Pane (Formatted XML, Headers, Faults) */}
          <ResponsePane response={response} isLoading={isSending} />
        </div>
      </div>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
      />

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-rose-950 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 max-w-md animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
          <span className="flex-1">{errorToast}</span>
          <button
            onClick={() => setErrorToast(null)}
            className="text-rose-400 hover:text-rose-100 ml-2 font-bold"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
