export interface QuotePayload {
  device: string;
  area: number;
  unitPrice: number;
  totalCost: number;
}

interface QuoteTableProps {
  quote: QuotePayload;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

const quoteMetrics = [
  { key: "device", label: "设备类型" },
  { key: "area", label: "厂房面积" },
  { key: "unitPrice", label: "核算单价" },
] as const;

export default function QuoteTable({ quote }: QuoteTableProps) {
  const metricValue = (key: (typeof quoteMetrics)[number]["key"]) => {
    if (key === "device") return quote.device;
    if (key === "area") return `${quote.area} m²`;
    return `${quote.unitPrice} 元/m²`;
  };

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-1 rounded-sm bg-red-600" />
              <h3 className="text-sm font-semibold text-white">智能报价单</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              基于设备类型、面积与内置报价规则生成，最终价格需结合现场工况复核。
            </p>
          </div>

          <div className="rounded-md border border-red-900/50 bg-red-950/20 px-4 py-3 text-right">
            <div className="text-[11px] text-neutral-500">预估总价</div>
            <div className="mt-1 font-mono text-xl font-bold text-red-400">
              {formatCurrency(quote.totalCost)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-neutral-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {quoteMetrics.map((metric) => (
          <div key={metric.key} className="px-4 py-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-600">
              {metric.label}
            </div>
            <div className="mt-2 font-mono text-sm font-semibold text-neutral-100">
              {metricValue(metric.key)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-900 px-4 py-3 text-[11px] leading-5 text-neutral-500">
        该结果用于售前快速估算，正式报价还需结合安装距离、品牌配置、运输和施工环境确认。
      </div>
    </section>
  );
}
