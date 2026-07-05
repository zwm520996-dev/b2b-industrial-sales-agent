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

export default function QuoteTable({ quote }: QuoteTableProps) {
  const rows = [
    { label: "设备类型", value: quote.device },
    { label: "厂房面积", value: `${quote.area}㎡` },
    { label: "核算单价", value: `${quote.unitPrice} 元/㎡` },
    { label: "预估总价", value: formatCurrency(quote.totalCost) },
  ];

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <span className="w-1 h-3 bg-red-600 rounded-sm inline-block"></span>
        <h4 className="text-sm font-bold text-neutral-300">报价核算明细</h4>
      </div>

      <div className="divide-y divide-neutral-900">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-2 px-4 py-3 text-sm">
            <span className="text-neutral-500">{row.label}</span>
            <span
              className={`text-right font-mono ${
                row.label === "预估总价" ? "text-red-500 font-bold" : "text-neutral-200"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-neutral-900 text-[11px] text-neutral-500 leading-relaxed">
        该结果为智能售前预估报价，最终价格需结合现场工况、安装距离和品牌配置确认。
      </div>
    </div>
  );
}