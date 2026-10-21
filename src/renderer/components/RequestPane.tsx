import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { Play, RotateCcw, AlignLeft, Plus, Trash2, Key, Send, FileCode, Sliders } from 'lucide-react';
import {
  WsdlService,
  WsdlPort,
  WsdlOperation,
  HttpHeaderItem,
  AuthConfig,
} from '../../types/wsdl';

interface RequestPaneProps {
  selected: {
    service: WsdlService;
    port: WsdlPort;
    operation: WsdlOperation;
  } | null;
  onSendRequest: (params: {
    endpointUrl: string;
    body: string;
    headers: Record<string, string>;
    auth: AuthConfig;
  }) => void;
  isSending: boolean;
}

export const RequestPane: React.FC<RequestPaneProps> = ({
  selected,
  onSendRequest,
  isSending,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'auth'>('body');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [bodyXml, setBodyXml] = useState('');
  const [headers, setHeaders] = useState<HttpHeaderItem[]>([]);
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' });

  useEffect(() => {
    if (selected) {
      setEndpointUrl(selected.operation.endpointUrl || selected.port.endpointUrl || '');
      setBodyXml(selected.operation.sampleRequestXml);

      const defaultHeaders: HttpHeaderItem[] = [];

      if (selected.operation.soapVersion === '1.2') {
        const actionPart = selected.operation.soapAction
          ? `; action="${selected.operation.soapAction}"`
          : '';
        defaultHeaders.push({
          id: '1',
          key: 'Content-Type',
          value: `application/soap+xml; charset=utf-8${actionPart}`,
          enabled: true,
        });
      } else {
        defaultHeaders.push({
          id: '1',
          key: 'Content-Type',
          value: 'text/xml; charset=utf-8',
          enabled: true,
        });
        if (selected.operation.soapAction !== undefined) {
          defaultHeaders.push({
            id: '2',
            key: 'SOAPAction',
            value: `"${selected.operation.soapAction}"`,
            enabled: true,
          });
        }
      }

      setHeaders(defaultHeaders);
    }
  }, [selected]);

  const handleResetEnvelope = () => {
    if (selected) {
      setBodyXml(selected.operation.sampleRequestXml);
    }
  };

  const handleFormatXml = () => {
    try {
      let formatted = '';
      let indent = 0;
      const cleanXml = bodyXml.replace(/>\s*</g, '><').trim();
      const tokens = cleanXml.split(/(<[^>]+>)/g).filter(Boolean);

      for (const token of tokens) {
        if (token.startsWith('</')) {
          indent = Math.max(0, indent - 1);
          formatted += '  '.repeat(indent) + token + '\n';
        } else if (token.startsWith('<') && !token.startsWith('<?') && !token.endsWith('/>')) {
          formatted += '  '.repeat(indent) + token + '\n';
          indent++;
        } else if (token.startsWith('<') && token.endsWith('/>')) {
          formatted += '  '.repeat(indent) + token + '\n';
        } else if (token.trim()) {
          formatted = formatted.trimEnd() + token;
        }
      }
      setBodyXml(formatted.trim());
    } catch {
      // fallback
    }
  };

  const handleAddHeader = () => {
    setHeaders((prev) => [
      ...prev,
      { id: Date.now().toString(), key: '', value: '', enabled: true },
    ]);
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const handleDeleteHeader = (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSend = () => {
    if (!endpointUrl.trim()) return;

    const finalHeaders: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        finalHeaders[h.key.trim()] = h.value;
      }
    }

    onSendRequest({
      endpointUrl: endpointUrl.trim(),
      body: bodyXml,
      headers: finalHeaders,
      auth,
    });
  };

  if (!selected) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl">
          <Send className="w-7 h-7 text-violet-400 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">No Operation Selected</h3>
        <p className="text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">
          Select an operation from the sidebar to inspect its parameters, edit the SOAP XML envelope, and execute calls.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-zinc-950 border-r border-zinc-800/80 min-w-0">
      {/* Endpoint URL & Actions Bar */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-violet-300 font-mono tracking-tight bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-md truncate">
              {selected.operation.name}
            </span>
            <span className="text-[11px] text-zinc-400 truncate">
              {selected.service.name} <span className="text-zinc-600">/</span> {selected.port.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleFormatXml}
              title="Beautify XML"
              className="p-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all cursor-pointer"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetEnvelope}
              title="Reset Envelope to Default"
              className="p-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Endpoint Input & Send Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative group">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              POST
            </span>
            <input
              type="text"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://service-endpoint-url..."
              className="w-full pl-14 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500/70 rounded-lg text-zinc-100 font-mono focus:outline-none transition-colors shadow-inner"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={isSending || !endpointUrl.trim()}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all active:scale-[0.97] cursor-pointer shrink-0"
          >
            <Play className={`w-3.5 h-3.5 fill-zinc-950 ${isSending ? 'animate-pulse' : ''}`} />
            <span>{isSending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-800/80 px-3 py-1 bg-zinc-900/40 text-xs select-none">
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('body')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'body'
                ? 'bg-violet-500/20 text-violet-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3 h-3" />
            <span>SOAP Envelope</span>
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
              {headers.filter((h) => h.enabled && h.key).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'auth'
                ? 'bg-violet-500/20 text-violet-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>Auth</span>
            {auth.type !== 'none' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Body Editor Tab */}
        {activeTab === 'body' && (
          <div className="flex-1 overflow-auto bg-[#0d0d11] font-mono text-xs">
            <CodeMirror
              value={bodyXml}
              height="100%"
              extensions={[xml()]}
              theme="dark"
              onChange={(val) => setBodyXml(val)}
              className="h-full text-xs"
            />
          </div>
        )}

        {/* Headers Tab */}
        {activeTab === 'headers' && (
          <div className="p-4 flex-1 overflow-y-auto space-y-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-medium">HTTP Request Headers</span>
              <button
                onClick={handleAddHeader}
                className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Header</span>
              </button>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-semibold">
                  <tr>
                    <th className="p-2.5 w-8 text-center"></th>
                    <th className="p-2.5 w-1/3">Header Key</th>
                    <th className="p-2.5">Header Value</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {headers.map((h) => (
                    <tr key={h.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => handleUpdateHeader(h.id, 'enabled', e.target.checked)}
                          className="rounded bg-zinc-950 border-zinc-700 text-violet-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => handleUpdateHeader(h.id, 'key', e.target.value)}
                          placeholder="e.g. SOAPAction"
                          className="w-full bg-transparent px-2 py-1 text-zinc-200 focus:outline-none focus:bg-zinc-900 rounded transition-colors"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => handleUpdateHeader(h.id, 'value', e.target.value)}
                          placeholder="value"
                          className="w-full bg-transparent px-2 py-1 text-zinc-200 focus:outline-none focus:bg-zinc-900 rounded transition-colors"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          onClick={() => handleDeleteHeader(h.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {headers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-zinc-500 font-sans">
                        No custom headers configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div className="p-5 flex-1 overflow-y-auto space-y-4 max-w-md select-none">
            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1.5">
                Authentication Scheme
              </label>
              <select
                value={auth.type}
                onChange={(e) =>
                  setAuth((prev) => ({
                    ...prev,
                    type: e.target.value as any,
                  }))
                }
                className="w-full text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500/70 rounded-lg p-2.5 text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="none">No Auth (None)</option>
                <option value="basic">HTTP Basic Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="ws-security">WS-Security (UsernameToken)</option>
              </select>
            </div>

            {auth.type === 'basic' && (
              <div className="space-y-3.5 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs">
                <div>
                  <label className="text-zinc-300 block mb-1 font-medium">Username</label>
                  <input
                    type="text"
                    value={auth.basic?.username || ''}
                    onChange={(e) =>
                      setAuth((prev) => ({
                        ...prev,
                        basic: { username: e.target.value, password: prev.basic?.password || '' },
                      }))
                    }
                    placeholder="admin"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500/70 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 block mb-1 font-medium">Password</label>
                  <input
                    type="password"
                    value={auth.basic?.password || ''}
                    onChange={(e) =>
                      setAuth((prev) => ({
                        ...prev,
                        basic: { username: prev.basic?.username || '', password: e.target.value },
                      }))
                    }
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500/70 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {auth.type === 'bearer' && (
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs">
                <div>
                  <label className="text-zinc-300 block mb-1 font-medium">Bearer Token</label>
                  <textarea
                    rows={3}
                    value={auth.bearer?.token || ''}
                    onChange={(e) =>
                      setAuth((prev) => ({
                        ...prev,
                        bearer: { token: e.target.value },
                      }))
                    }
                    placeholder="eyJhbGciOi..."
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500/70 rounded-lg px-3 py-2 text-zinc-200 font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>
            )}

            {auth.type === 'ws-security' && (
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Injects standard OASIS WS-Security `&lt;wsse:UsernameToken&gt;` into the SOAP Header.
                </p>
                <div>
                  <label className="text-zinc-300 block mb-1 font-medium">Username</label>
                  <input
                    type="text"
                    value={auth.wsSecurity?.username || ''}
                    onChange={(e) =>
                      setAuth((prev) => ({
                        ...prev,
                        wsSecurity: {
                          username: e.target.value,
                          password: prev.wsSecurity?.password || '',
                          passwordType: prev.wsSecurity?.passwordType || 'PasswordText',
                        },
                      }))
                    }
                    placeholder="admin"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500/70 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 block mb-1 font-medium">Password</label>
                  <input
                    type="password"
                    value={auth.wsSecurity?.password || ''}
                    onChange={(e) =>
                      setAuth((prev) => ({
                        ...prev,
                        wsSecurity: {
                          username: prev.wsSecurity?.username || '',
                          password: e.target.value,
                          passwordType: prev.wsSecurity?.passwordType || 'PasswordText',
                        },
                      }))
                    }
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500/70 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
