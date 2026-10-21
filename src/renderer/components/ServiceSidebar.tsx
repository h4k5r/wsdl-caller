import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Server,
  Layers,
  Zap,
  Search,
  BookOpen,
  X,
  Compass,
} from 'lucide-react';
import { ParsedWsdl, WsdlService, WsdlPort, WsdlOperation } from '../../types/wsdl';

interface ServiceSidebarProps {
  parsedWsdl: ParsedWsdl | null;
  selectedOperation: {
    service: WsdlService;
    port: WsdlPort;
    operation: WsdlOperation;
  } | null;
  onSelectOperation: (service: WsdlService, port: WsdlPort, operation: WsdlOperation) => void;
}

export const ServiceSidebar: React.FC<ServiceSidebarProps> = ({
  parsedWsdl,
  selectedOperation,
  onSelectOperation,
}) => {
  const [filterText, setFilterText] = useState('');
  const [collapsedServices, setCollapsedServices] = useState<Record<string, boolean>>({});
  const [collapsedPorts, setCollapsedPorts] = useState<Record<string, boolean>>({});

  const toggleService = (name: string) => {
    setCollapsedServices((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const togglePort = (key: string) => {
    setCollapsedPorts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredServices = useMemo(() => {
    if (!parsedWsdl) return [];
    if (!filterText.trim()) return parsedWsdl.services;

    const query = filterText.toLowerCase();

    return parsedWsdl.services
      .map((service) => {
        const matchesService = service.name.toLowerCase().includes(query);
        const filteredPorts = service.ports
          .map((port) => {
            const matchesPort = port.name.toLowerCase().includes(query);
            const filteredOps = port.operations.filter((op) =>
              op.name.toLowerCase().includes(query)
            );

            if (matchesService || matchesPort || filteredOps.length > 0) {
              return {
                ...port,
                operations: matchesService || matchesPort ? port.operations : filteredOps,
              };
            }
            return null;
          })
          .filter(Boolean) as WsdlPort[];

        if (filteredPorts.length > 0) {
          return {
            ...service,
            ports: filteredPorts,
          };
        }
        return null;
      })
      .filter(Boolean) as WsdlService[];
  }, [parsedWsdl, filterText]);

  const totalOperations = useMemo(() => {
    if (!parsedWsdl) return 0;
    return parsedWsdl.services.reduce(
      (sum, s) => sum + s.ports.reduce((pSum, p) => pSum + p.operations.length, 0),
      0
    );
  }, [parsedWsdl]);

  return (
    <aside className="w-80 h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col shrink-0 select-none">
      {/* Header & Filter */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-violet-400" />
            WSDL Explorer
          </span>
          {parsedWsdl && (
            <span className="text-[10px] text-violet-300 font-mono bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-semibold">
              {totalOperations} ops
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter operations..."
            disabled={!parsedWsdl}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500/60 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Services List / Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {!parsedWsdl && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-violet-400">
              <Compass className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-semibold text-zinc-300">No WSDL loaded yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed">
              Paste a URL or choose a sample to inspect operations.
            </p>
          </div>
        )}

        {parsedWsdl && filteredServices.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-xs">
            No operations match "<span className="text-zinc-300">{filterText}</span>"
          </div>
        )}

        {filteredServices.map((service) => {
          const isServiceCollapsed = collapsedServices[service.name];

          return (
            <div key={service.name} className="space-y-0.5">
              {/* Service Node */}
              <button
                onClick={() => toggleService(service.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium text-zinc-200 hover:bg-zinc-900 transition-colors group cursor-pointer"
              >
                {isServiceCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0 transition-transform" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0 transition-transform" />
                )}
                <Server className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate text-xs font-semibold tracking-tight">{service.name}</span>
              </button>

              {/* Ports */}
              {!isServiceCollapsed && (
                <div className="ml-3 pl-2.5 border-l border-zinc-800 space-y-1 mt-0.5">
                  {service.ports.map((port) => {
                    const portKey = `${service.name}-${port.name}`;
                    const isPortCollapsed = collapsedPorts[portKey];

                    return (
                      <div key={port.name}>
                        <button
                          onClick={() => togglePort(portKey)}
                          className="w-full flex items-center justify-between px-2 py-1 rounded-md text-left text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isPortCollapsed ? (
                              <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                            )}
                            <Layers className="w-3 h-3 text-cyan-400/80 shrink-0" />
                            <span className="truncate text-[11px] font-medium">{port.name}</span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold tracking-wider ${
                              port.soapVersion === '1.2'
                                ? 'bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            }`}
                          >
                            SOAP {port.soapVersion}
                          </span>
                        </button>

                        {/* Operations */}
                        {!isPortCollapsed && (
                          <div className="ml-3 pl-2 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                            {port.operations.map((op) => {
                              const isSelected =
                                selectedOperation?.operation.name === op.name &&
                                selectedOperation?.port.name === port.name;

                              return (
                                <button
                                  key={op.name}
                                  onClick={() => onSelectOperation(service, port, op)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 group cursor-pointer ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-violet-200 border-l-2 border-violet-400 font-semibold shadow-sm'
                                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                                  }`}
                                >
                                  <Zap
                                    className={`w-3 h-3 shrink-0 transition-transform ${
                                      isSelected
                                        ? 'text-violet-400 fill-violet-400/30 scale-110'
                                        : 'text-zinc-600 group-hover:text-amber-400 group-hover:scale-105'
                                    }`}
                                  />
                                  <span className="truncate text-xs font-mono">{op.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
