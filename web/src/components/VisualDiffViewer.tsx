import { useState, useMemo } from 'react';
import { Check, Clipboard, FileCode, Rows, Search, Split } from 'lucide-react';

interface SideBySideLine {
  left: {
    lineNum?: number;
    content: string;
    type: 'removed' | 'unchanged' | 'empty';
  };
  right: {
    lineNum?: number;
    content: string;
    type: 'added' | 'unchanged' | 'empty';
  };
}

interface VisualDiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  filename: string;
  onAccept?: () => void;
  onRevert?: () => void;
}

export function VisualDiffViewer({
  originalContent,
  modifiedContent,
  filename,
  onAccept,
  onRevert,
}: VisualDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSide, setCopiedSide] = useState<'left' | 'right' | null>(null);

  // 1. Calculate side-by-side aligned diff lines
  const { alignedLines, addedCount, removedCount } = useMemo(() => {
    const origLines = originalContent.split('\n');
    const modLines = modifiedContent.split('\n');

    // LCS Matrix
    const dp: number[][] = Array(origLines.length + 1)
      .fill(0)
      .map(() => Array(modLines.length + 1).fill(0));

    for (let i = 1; i <= origLines.length; i++) {
      for (let j = 1; j <= modLines.length; j++) {
        if (origLines[i - 1] === modLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = origLines.length;
    let j = modLines.length;
    const reversedRows: SideBySideLine[] = [];
    let added = 0;
    let removed = 0;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
        reversedRows.push({
          left: { lineNum: i, content: origLines[i - 1], type: 'unchanged' },
          right: { lineNum: j, content: modLines[j - 1], type: 'unchanged' },
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        reversedRows.push({
          left: { content: '', type: 'empty' },
          right: { lineNum: j, content: modLines[j - 1], type: 'added' },
        });
        added++;
        j--;
      } else {
        reversedRows.push({
          left: { lineNum: i, content: origLines[i - 1], type: 'removed' },
          right: { content: '', type: 'empty' },
        });
        removed++;
        i--;
      }
    }

    const aligned = reversedRows.reverse();

    // Optimize staggered changes (removed + empty followed by empty + added) into side-by-side pairs
    const optimized: SideBySideLine[] = [];
    let k = 0;
    while (k < aligned.length) {
      const current = aligned[k];
      if (
        k + 1 < aligned.length &&
        current.left.type === 'removed' &&
        current.right.type === 'empty' &&
        aligned[k + 1].left.type === 'empty' &&
        aligned[k + 1].right.type === 'added'
      ) {
        optimized.push({
          left: { lineNum: current.left.lineNum, content: current.left.content, type: 'removed' },
          right: { lineNum: aligned[k + 1].right.lineNum, content: aligned[k + 1].right.content, type: 'added' },
        });
        k += 2;
      } else {
        optimized.push(current);
        k++;
      }
    }

    return { alignedLines: optimized, addedCount: added, removedCount: removed };
  }, [originalContent, modifiedContent]);

  // 2. Filter lines based on search query
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return alignedLines;
    const query = searchQuery.toLowerCase();
    return alignedLines.filter(
      (line) =>
        line.left.content.toLowerCase().includes(query) ||
        line.right.content.toLowerCase().includes(query)
    );
  }, [alignedLines, searchQuery]);

  const handleCopy = (side: 'left' | 'right', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07080a]/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
      {/* ─── Control Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-[#0b0c10]/80 border-b border-white/5 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-200 tracking-wide font-sans">{filename}</div>
            <div className="flex items-center space-x-2 mt-0.5 font-mono text-[10px]">
              <span className="text-emerald-400 font-semibold">+{addedCount} additions</span>
              <span className="text-gray-600">•</span>
              <span className="text-rose-400 font-semibold">-{removedCount} deletions</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search differences..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 bg-[#10121a]/80 border border-white/5 focus:border-blue-500/50 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-gray-300 placeholder-gray-500 focus:outline-none transition-all duration-300 font-sans"
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-[#10121a]/80 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Split className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Rows className="w-3 h-3" />
              <span>Unified</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Diff Rendering Body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-[#040507] font-mono text-[11.5px] leading-[22px] select-text scrollbar-thin">
        {viewMode === 'split' ? (
          /* ─── SIDE-BY-SIDE SPLIT VIEW ───────────────────────────────── */
          <div className="min-w-[800px] flex h-full">
            {/* Original Left Pane */}
            <div className="flex-1 border-r border-white/5 relative">
              <div className="absolute top-2.5 right-3 z-10 opacity-30 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy('left', originalContent)}
                  className="p-1.5 bg-[#0b0c10]/90 rounded-md border border-white/5 text-gray-400 hover:text-white"
                  title="Copy original file"
                >
                  {copiedSide === 'left' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="py-2">
                {filteredLines.map((row, idx) => {
                  const isRemoved = row.left.type === 'removed';
                  const isEmpty = row.left.type === 'empty';

                  return (
                    <div
                      key={idx}
                      className={`flex w-full group ${
                        isRemoved
                          ? 'bg-rose-950/20 text-rose-300/90 border-l-2 border-rose-500/80'
                          : isEmpty
                          ? 'bg-striped text-transparent select-none'
                          : 'text-gray-400 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="w-10 text-right pr-3 text-[10px] text-gray-600 font-semibold select-none border-r border-white/5 shrink-0 bg-[#07080a]/30">
                        {!isEmpty ? row.left.lineNum : ''}
                      </div>
                      <div className="w-6 text-center select-none font-bold text-[10px] text-rose-500/50 shrink-0">
                        {isRemoved ? '-' : ''}
                      </div>
                      <div className="flex-1 pl-3 whitespace-pre overflow-x-auto scrollbar-none font-medium">
                        {!isEmpty ? row.left.content : '\u00A0'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modified Right Pane */}
            <div className="flex-1 relative">
              <div className="absolute top-2.5 right-3 z-10 opacity-30 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy('right', modifiedContent)}
                  className="p-1.5 bg-[#0b0c10]/90 rounded-md border border-white/5 text-gray-400 hover:text-white"
                  title="Copy modified file"
                >
                  {copiedSide === 'right' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="py-2">
                {filteredLines.map((row, idx) => {
                  const isAdded = row.right.type === 'added';
                  const isEmpty = row.right.type === 'empty';

                  return (
                    <div
                      key={idx}
                      className={`flex w-full group ${
                        isAdded
                          ? 'bg-emerald-950/20 text-emerald-300 border-l-2 border-emerald-500/80'
                          : isEmpty
                          ? 'bg-striped text-transparent select-none'
                          : 'text-gray-300 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="w-10 text-right pr-3 text-[10px] text-gray-600 font-semibold select-none border-r border-white/5 shrink-0 bg-[#07080a]/30">
                        {!isEmpty ? row.right.lineNum : ''}
                      </div>
                      <div className="w-6 text-center select-none font-bold text-[10px] text-emerald-500/50 shrink-0">
                        {isAdded ? '+' : ''}
                      </div>
                      <div className="flex-1 pl-3 whitespace-pre overflow-x-auto scrollbar-none font-medium">
                        {!isEmpty ? row.right.content : '\u00A0'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ─── UNIFIED VERTICAL VIEW ─────────────────────────────────── */
          <div className="py-2">
            {filteredLines.map((row, idx) => {
              // In unified view, we render deletions first if they are pairs, or render individually.
              const showLeft = row.left.type === 'removed';
              const showRight = row.right.type === 'added';
              const showBoth = row.left.type === 'unchanged' && row.right.type === 'unchanged';

              if (showBoth) {
                return (
                  <div key={idx} className="flex hover:bg-white/[0.02] text-gray-400">
                    <div className="w-10 text-right pr-2.5 text-[10px] text-gray-600 select-none border-r border-white/5 bg-[#07080a]/20 shrink-0">
                      {row.left.lineNum}
                    </div>
                    <div className="w-10 text-right pr-2.5 text-[10px] text-gray-600 select-none border-r border-white/5 bg-[#07080a]/20 shrink-0">
                      {row.right.lineNum}
                    </div>
                    <div className="w-6 text-center select-none text-gray-700 shrink-0"> </div>
                    <div className="flex-1 pl-3 whitespace-pre overflow-x-auto font-medium">{row.left.content}</div>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex flex-col">
                  {showLeft && (
                    <div className="flex bg-rose-950/20 text-rose-300 border-l-2 border-rose-500/80">
                      <div className="w-10 text-right pr-2.5 text-[10px] text-rose-700/80 select-none border-r border-white/5 bg-rose-950/10 shrink-0 font-bold">
                        {row.left.lineNum}
                      </div>
                      <div className="w-10 text-right pr-2.5 text-[10px] text-rose-700/80 select-none border-r border-white/5 bg-rose-950/10 shrink-0">
                        {'\u00A0'}
                      </div>
                      <div className="w-6 text-center select-none font-bold text-[10px] text-rose-500 shrink-0">-</div>
                      <div className="flex-1 pl-3 whitespace-pre overflow-x-auto font-medium">{row.left.content}</div>
                    </div>
                  )}
                  {showRight && (
                    <div className="flex bg-emerald-950/20 text-emerald-300 border-l-2 border-emerald-500/80">
                      <div className="w-10 text-right pr-2.5 text-[10px] text-emerald-700/80 select-none border-r border-white/5 bg-emerald-950/10 shrink-0">
                        {'\u00A0'}
                      </div>
                      <div className="w-10 text-right pr-2.5 text-[10px] text-emerald-700/80 select-none border-r border-white/5 bg-emerald-950/10 shrink-0 font-bold">
                        {row.right.lineNum}
                      </div>
                      <div className="w-6 text-center select-none font-bold text-[10px] text-emerald-500 shrink-0">+</div>
                      <div className="flex-1 pl-3 whitespace-pre overflow-x-auto font-medium">{row.right.content}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Footer Controls (Optional Action Buttons) ─────────────────── */}
      {(onAccept || onRevert) && (
        <div className="flex items-center justify-end px-5 py-3 bg-[#0b0c10]/80 border-t border-white/5 space-x-3 shrink-0">
          {onRevert && (
            <button
              onClick={onRevert}
              className="px-4 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-xs font-bold transition-all duration-200"
            >
              Revert Changes
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/15 hover:shadow-emerald-500/25 transition-all duration-200"
            >
              Accept Modifications
            </button>
          )}
        </div>
      )}

      {/* Striped pattern for blank empty spaces in split view */}
      <style>{`
        .bg-striped {
          background-color: #040507;
          background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 8px);
        }
      `}</style>
    </div>
  );
}
