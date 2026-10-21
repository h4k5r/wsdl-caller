import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import {
  Copy,
  Check,
  Download,
  AlertTriangle,
  Clock,
  Layers,
  Inbox,
  Code2,
  FileText,
  Sliders,
} from 'lucide-react';
import { SoapResponsePayload } from '../../types/wsdl';

interface ResponsePaneProps {
  response: SoapResponsePayload | null;
  isLoading: boolean;
}

export const ResponsePane: React.FC<ResponsePaneProps> = ({ response, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw' | 'headers'>('formatted');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!response) return;
    const text = activeTab === 'raw' ? response.rawBody : response.formattedBody;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!response) return;
    const blob = new Blob([response.formattedBody], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soap-response-${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-zinc-950 p-8 text-zinc-400 select-none">
        <div className="relative mb-4">
          <div className="w-12 h-12 border-2 border-violet-500/20 border-t-violet-400 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-violet-400 rounded-full animate-ping opacity-75" />
          </div>
        </div>
        <p className="text-sm font-semibold text-zinc-200">Dispatching SOAP Request...</p>
        <span className="text-xs text-zinc-500 mt-1">Awaiting response from endpoint</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl">
          <Inbox className="w-7 h-7 text-zinc-600 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">Ready to Send</h3>
        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs leading-relaxed">
          Click the <strong className="text-emerald-400 font-semibold">Send</strong> button to execute the request and inspect the formatted XML response and headers.
        </p>
      </div>
    );
  }

  const isSuccess = response.status >= 200 && response.status < 300 && !response.isFault;

  return (
    <div className="flex-1 h-full flex flex-col bg-zinc-950 min-w-0">
      {/* Response Status Bar */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          {/* Status Badge */}
          <span
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow-sm ${
              isSuccess
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSuccess
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse'
                  : 'bg-rose-400 shadow-sm shadow-rose-400/80'
              }`}
            />
            <span>{response.status} {response.statusText}</span>
          </span>

          {/* Latency */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{response.durationMs} ms</span>
          </div>

          {/* Size */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-mono">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>{(response.rawBody.length / 1024).toFixed(2)} KB</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            title="Copy response body"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all cursor-pointer"
            title="Download XML response"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SOAP Fault Alert Box (Only shown if isFault is true) */}
      {response.isFault && response.faultDetails && (
        <div className="m-3 p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start gap-3 backdrop-blur-sm shadow-lg shadow-rose-950/20">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-semibold text-rose-200 flex items-center gap-2 mb-1">
              <span>SOAP Fault</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-200 border border-rose-700/50">
                {response.faultDetails.faultCode}
              </span>
            </div>
            <p className="text-rose-200/90 font-mono text-[11px] leading-relaxed break-words">
              {response.faultDetails.faultString}
            </p>
            {response.faultDetails.detail && (
              <div className="mt-2 text-[10px] text-rose-300/90 bg-black/40 p-2.5 rounded-lg border border-rose-900/50 font-mono overflow-x-auto max-h-24">
                {response.faultDetails.detail}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-800/80 px-3 py-1 bg-zinc-900/40 text-xs select-none">
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('formatted')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'formatted'
                ? 'bg-violet-500/20 text-violet-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>Formatted XML</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-violet-500/20 text-violet-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Raw Response</span>
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'headers'
                ? 'bg-violet-500/20 text-violet-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Headers</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded-full font-mono">
              {Object.keys(response.headers).length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'formatted' && (
          <div className="flex-1 overflow-auto bg-[#0d0d11] font-mono text-xs">
            <CodeMirror
              value={response.formattedBody}
              height="100%"
              extensions={[xml()]}
              theme="dark"
              editable={false}
              className="h-full text-xs"
            />
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="flex-1 overflow-auto bg-[#0d0d11] font-mono text-xs p-4 text-zinc-200 whitespace-pre-wrap select-text leading-relaxed">
            {response.rawBody}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="p-4 flex-1 overflow-y-auto select-none">
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-semibold">
                  <tr>
                    <th className="p-2.5 w-1/3">Header Name</th>
                    <th className="p-2.5">Header Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {Object.entries(response.headers).map(([key, val]) => (
                    <tr key={key} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="p-2.5 text-violet-400 font-medium select-text">{key}</td>
                      <td className="p-2.5 text-zinc-300 break-all select-text">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
