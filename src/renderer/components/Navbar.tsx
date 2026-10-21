import React, { useState } from 'react';
import {
  Globe,
  FolderOpen,
  History,
  Shield,
  ShieldAlert,
  Loader2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  wsdlUrl: string;
  onUrlChange: (url: string) => void;
  onLoadWsdl: (url: string, isLocal?: boolean) => void;
  isLoading: boolean;
  ignoreSsl: boolean;
  onToggleIgnoreSsl: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

const SAMPLE_WSDLS = [
  {
    name: '🛍️ Local Dummy Shop (Auth & JSON Store)',
    url: 'http://localhost:8001/ws/shop?wsdl',
  },
  {
    name: '🌍 Country Info Service',
    url: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL',
  },
  {
    name: '🔢 Number Conversion Service',
    url: 'https://www.dataaccess.com/webservicesserver/numberconversion.wso?WSDL',
  },
  {
    name: '🧮 Calculator Service',
    url: 'http://www.dneonline.com/calculator.asmx?wsdl',
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  wsdlUrl,
  onUrlChange,
  onLoadWsdl,
  isLoading,
  ignoreSsl,
  onToggleIgnoreSsl,
  onOpenHistory,
  historyCount,
}) => {
  const [selectedSample, setSelectedSample] = useState('');

  const handleSelectSample = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = e.target.value;
    setSelectedSample(url);
    if (url) {
      onUrlChange(url);
      onLoadWsdl(url, false);
    }
  };

  const handleOpenFile = async () => {
    try {
      const filePath = await window.wsdlApi.openFileDialog();
      if (filePath) {
        onUrlChange(filePath);
        onLoadWsdl(filePath, true);
      }
    } catch (err) {
      console.error('Failed to open local file:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsdlUrl.trim()) {
      onLoadWsdl(wsdlUrl.trim(), false);
    }
  };

  return (
    <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl px-4 flex items-center justify-between gap-4 z-20 shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-lg blur opacity-50 group-hover:opacity-80 transition duration-300"></div>
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white font-black text-sm tracking-tighter">
            W
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-zinc-100 tracking-tight">WSDL Caller</span>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
            SOAP Client
          </span>
        </div>
      </div>

      {/* URL Search & Load Form */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-3xl flex items-center gap-2">
        <div className="relative flex-1 group">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
          <input
            type="text"
            value={wsdlUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Paste WSDL URL (e.g. http://localhost:8001/ws/shop?wsdl) or local path..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/30 text-zinc-100 placeholder-zinc-500 font-mono transition-all shadow-inner"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !wsdlUrl.trim()}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-md shadow-violet-600/20 transition-all active:scale-[0.97] cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <span>Load WSDL</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleOpenFile}
          title="Open local .wsdl or .xml file"
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span>Local File</span>
        </button>

        {/* Sample WSDLs Dropdown */}
        <div className="relative">
          <select
            value={selectedSample}
            onChange={handleSelectSample}
            className="text-xs bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg py-1.5 pl-2.5 pr-7 appearance-none focus:outline-none focus:border-violet-500/60 cursor-pointer transition-colors"
          >
            <option value="" disabled>
              Sample WSDLs...
            </option>
            {SAMPLE_WSDLS.map((s) => (
              <option key={s.name} value={s.url}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-0.5 text-zinc-500">
            <Sparkles className="w-3 h-3 text-amber-400 mr-0.5" />
            <ChevronDown className="w-3 h-3" />
          </div>
        </div>
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleIgnoreSsl}
          title={ignoreSsl ? 'SSL validation disabled' : 'Strict SSL validation enabled'}
          className={`px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
            ignoreSsl
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
          }`}
        >
          {ignoreSsl ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Insecure SSL</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Strict SSL</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenHistory}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-zinc-400" />
          <span>History</span>
          {historyCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-mono border border-violet-500/30">
              {historyCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
