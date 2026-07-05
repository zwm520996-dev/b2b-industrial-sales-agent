import React, { useState } from 'react';
import Pagination from './Pagination';

export interface Product{
    id:string;
    name:string;
    specs:string;
    price:string;
    highlights:string[];
}

interface ProductGalleryProps{
    products:Product[];
}

export default function ProductGallery({products}:ProductGalleryProps){
    //1、内部状态机：独立管理画廊的当前页码
    const [currentPage,setCurrentPage]=useState(1);

    //2、分页算法
    const pageSize=2;// 考虑到聊天气泡的空间，每页只展示 2 个核心设备
    const totalPages=Math.ceil(products.length/pageSize);

    //切割数组，只提取当前页面需要展示的数据
    const currentData = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    //防御性编程：如果没有数据，直接不渲染
    if(!products || products.length===0) return null;

    return (
    <div className="mt-4 pt-4 border-t border-neutral-800 w-full">
      <h4 className="text-sm font-bold text-neutral-400 mb-4 flex items-center gap-2">
        <span className="w-1 h-3 bg-red-600 rounded-sm inline-block"></span>
        为您匹配到 {products.length} 款设备方案
      </h4>

      {/* 结构化卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentData.map((product) => (
          <div 
            key={product.id} 
            className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 hover:border-red-900/50 transition-colors group relative overflow-hidden"
          >
            {/* 顶部的极细红线装饰，呼应红黑主题 */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <h5 className="text-base font-bold text-white mb-1">{product.name}</h5>
            <p className="text-xs text-neutral-500 font-mono mb-3">{product.specs}</p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {product.highlights.map((tag, idx) => (
                <span key={idx} className="text-[10px] px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex justify-between items-end mt-auto pt-2 border-t border-neutral-900">
              <span className="text-xs text-neutral-500">预估单价</span>
              <span className="text-sm font-bold text-red-500 font-mono">{product.price}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={setCurrentPage} 
      />
    </div>
  );

}