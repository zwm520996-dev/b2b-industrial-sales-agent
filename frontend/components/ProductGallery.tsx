import { useState } from "react";
import Pagination from "./Pagination";

export interface Product {
  id: string;
  name: string;
  specs: string;
  price: string;
  highlights: string[];
}

interface ProductGalleryProps {
  products: Product[];
}

export default function ProductGallery({ products }: ProductGalleryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 2;
  const totalPages = Math.ceil(products.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const currentData = products.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-4 border-t border-neutral-800 pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-sm bg-red-600" />
            <h3 className="text-sm font-semibold text-white">推荐设备方案</h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            已匹配 {products.length} 个候选方案，支持按场景继续追问。
          </p>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-500">
          方案 {safeCurrentPage}/{totalPages}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {currentData.map((product) => (
          <article
            key={product.id}
            className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 transition-colors hover:border-red-900/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">{product.name}</h4>
                <p className="mt-2 text-xs leading-5 text-neutral-500">{product.specs}</p>
              </div>
              <div className="shrink-0 rounded-md border border-red-900/50 bg-red-950/20 px-2 py-1 text-[10px] font-semibold text-red-300">
                推荐
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {product.highlights.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-end justify-between border-t border-neutral-900 pt-3">
              <div>
                <div className="text-[11px] text-neutral-600">预估单价</div>
                <div className="mt-1 text-xs text-neutral-500">具体配置可继续确认</div>
              </div>
              <div className="font-mono text-sm font-bold text-red-400">{product.price}</div>
            </div>
          </article>
        ))}
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </section>
  );
}
