export interface SourceItem {
  title: string;
  snippet: string;
  score: number | null;
}

interface SourceListProps {
  sources: SourceItem[];
}

export default function SourceList({ sources }: SourceListProps) {
  if (!sources.length) return null;

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <span className="w-1 h-3 bg-red-600 rounded-sm inline-block"></span>
        <h4 className="text-sm font-bold text-neutral-300">知识库参考资料</h4>
      </div>

      <div className="divide-y divide-neutral-900">
        {sources.map((source, index) => (
          <div key={`${source.title}-${index}`} className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm font-bold text-neutral-200">
                {source.title}
              </div>

              {source.score !== null && (
                <div className="shrink-0 rounded border border-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-500">
                  score {source.score}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              {source.snippet}
            </p>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-neutral-900 text-[11px] text-neutral-500 leading-relaxed">
        以上资料来自企业知识库语义检索，用于辅助回答；最终推荐会结合面积、预算和现场工况进一步筛选。
       </div>
    </div>
  );
}