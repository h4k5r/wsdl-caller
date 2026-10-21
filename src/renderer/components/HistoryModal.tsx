import React, { useState } from 'react';
import { X, Clock, Trash2, ArrowUpRight, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { RequestHistoryItem } from '../../types/wsdl';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: RequestHistoryItem[];
  onSelectHistoryItem: (item: RequestHistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory,
}) => {
  const [filterText, setFilterText] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const q = filterText.toLowerCase();
    return (
      item.operationName.toLowerCase().includes(q) ||
      item.serviceName.toLowerCase().includes(q) ||
      item.endpointUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Request History</h2>
              <p className="text-[11px] text-zinc-500 font-sans">
                Review and replay past SOAP invocations
              </p>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono ml-2 border border-zinc-700">
              {history.length} {history.length === 1 ? 'call' : 'calls'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/40">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by operation, service, or endpoint..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 focus:border-violet-500/60 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No matching request history found.
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-violet-300 truncate">
                      {item.operationName}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded font-mono">
                      SOAP {item.soapVersion}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 truncate mt-1">
                    {item.serviceName} &rarr; {item.portName}
                  </div>

                  <div className="text-[10px] text-zinc-600 font-mono truncate mt-0.5">
                    {item.endpointUrl}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {item.responseStatus !== undefined && (
                    <div
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                        !item.isFault && item.responseStatus < 400
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {!item.isFault && item.responseStatus < 400 ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                      )}
                      <span>{item.responseStatus}</span>
                      {item.durationMs && <span>({item.durationMs}ms)</span>}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      onSelectHistoryItem(item);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Replay</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
