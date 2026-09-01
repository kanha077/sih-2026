import { History, X, Trash2, ArrowRight, Layers } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistory,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-topo-canvas/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-md h-full bg-topo-panel border-l border-topo-border p-5 flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-topo-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-topo-ochre" />
              <h3 className="text-sm font-mono font-bold uppercase text-topo-ink">
                CADASTRAL SURVEY ARCHIVE
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-sm bg-topo-canvas text-topo-inkMuted hover:text-topo-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="mt-4 space-y-2 font-mono">
            {history.length === 0 ? (
              <div className="text-center py-12 text-topo-inkDim">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No previous scans in session archive.</p>
                <p className="text-[10px] text-topo-inkDim mt-0.5">Synthesized elevation models will appear here.</p>
              </div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={item.job_id}
                  onClick={() => {
                    onSelectHistory(item);
                    onClose();
                  }}
                  className="group flex items-center gap-3 p-2.5 rounded-sm bg-topo-canvas border border-topo-border hover:border-topo-ochre cursor-pointer transition-colors"
                >
                  <div className="w-14 h-14 rounded-none overflow-hidden bg-topo-panel border border-topo-border shrink-0">
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-topo-ochre font-bold">REC #{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-[10px] text-topo-inkDim">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-topo-ink truncate group-hover:text-topo-ochre transition-colors mt-0.5">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-topo-inkMuted mt-0.5">
                      {item.stats.width}&times;{item.stats.height} px &bull; {item.stats.processing_time_ms} ms
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-topo-inkDim group-hover:text-topo-ochre group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="pt-3 border-t border-topo-border mt-4 flex justify-between items-center font-mono text-xs">
            <span className="text-topo-inkDim text-[11px]">
              {history.length} {history.length === 1 ? 'RECORD' : 'RECORDS'} SAVED
            </span>
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] text-red-400 hover:bg-red-950/40 border border-red-900/50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>PURGE ARCHIVE</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
