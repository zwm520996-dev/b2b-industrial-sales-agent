import React from "react";
interface PaginationProps{
    currentPage:number;
    totalPages:number;
    onPageChange:(page:number)=>void;
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange
}:PaginationProps){
    //如果只有一页或者没有数据，直接不渲染分页器
    if(totalPages<=1) return null;

    //生成页码数组的核心逻辑
    const pages=Array.from({length:totalPages},(_,i) => i+1)

    return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {/* 上一页按钮 */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-white hover:border-red-600 transition-colors disabled:opacity-30 disabled:hover:border-neutral-700 disabled:cursor-not-allowed"
        aria-label="Previous Page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 标准数字页码按钮 */}
      <div className="flex items-center gap-1 sm:gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded text-sm font-mono transition-all duration-200
              ${
                currentPage === page
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)] border border-red-500'
                  : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:border-red-600 hover:text-white'
              }
            `}
          >
            {page}
          </button>
        ))}
      </div>

      {/* 下一页按钮 */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-white hover:border-red-600 transition-colors disabled:opacity-30 disabled:hover:border-neutral-700 disabled:cursor-not-allowed"
        aria-label="Next Page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}