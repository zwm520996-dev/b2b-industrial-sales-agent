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
    <section className="mt-4 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-sm bg-red-600" />
          <h3 className="text-sm font-semibold text-white">知识库引用</h3>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          以下资料由企业知识库语义检索召回，用于支撑本轮回答。
        </p>
      </div>

      <div className="divide-y divide-neutral-900">
        {sources.map((source, index) => (
          <article key={`${source.title}-${index}`} className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <h4 className="text-sm font-semibold text-neutral-100">{source.title}</h4>

              {source.score !== null && (
                <div className="shrink-0 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px] text-neutral-500">
                  匹配度 {source.score}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs leading-6 text-neutral-500">{source.snippet}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
