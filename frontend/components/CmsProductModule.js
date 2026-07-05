/**
 * 现代企业级 CMS 动态渲染模块规范
 * @param {Object} siteData - 全站全局配置环境（如主题色、SEO、站点名称等）
 * @param {Object} data - 大模型或后端动态流入的结构化数据（对应我们的 products 数据包）
 * @param {Object} util - CMS 平台底层的通用工具库（如数据脱敏、货币格式化等）
 */
module.exports = function (siteData, data, util) {
  // 1. 从 CMS 注入环境提取系统默认配置，未传则优雅降级到我们的经典红黑工业风
  const themeColor = siteData.themeColor || '#dc2626'; // 工业红
  const borderBg = siteData.borderBg || '#262626';     // 灰框

  // 2. 提取并校验大模型/后端流入的数据源
  const rawProducts = data.products || [];
  if (rawProducts.length === 0) {
    return `<div style="color: #737373; font-size: 12px; text-align: center; padding: 20px;">暂无匹配设备方案</div>`;
  }

  // 3. 模拟 CMS 环境下的纯前端高性能数据分片与 HTML 骨架渲染
  // 在实际低代码或自定义模块中，我们通过原生模板字符串或 Alpine.js 绑定来保证在任何环境下都能脱离 React 引擎独立运行
  let productCardsHtml = '';
  
  // 默认展示前 2 个核心设备（契合我们一排展示两个的克制、紧凑布局）
  const displayProducts = rawProducts.slice(0, 2); 

  displayProducts.forEach(product => {
    // 利用 CMS 注入的 util 工具函数库进行价格的标准化格式输出
    const formattedPrice = util && util.formatPrice ? util.formatPrice(product.price) : product.price;

    productCardsHtml += `
      <div class="cms-product-card" style="background: #000000; border: 1px solid ${borderBg}; border-radius: 8px; padding: 16px; position: relative; overflow: hidden; transition: all 0.2s;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(to right, ${themeColor}, transparent);"></div>
        <h5 style="color: #ffffff; font-size: 16px; font-weight: bold; margin-bottom: 4px;">${product.name}</h5>
        <p style="color: #737373; font-size: 12px; font-family: monospace; margin-bottom: 12px;">${product.specs}</p>
        
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
          ${product.highlights.map(tag => `
            <span style="font-size: 10px; px; padding: 2px 8px; id: 'tag'; border-radius: 4px; bg: #0a0a0a; border: 1px solid ${borderBg}; color: #a3a3a3;">
              ${tag}
            </span>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px; border-t: 1px solid #171717;">
          <span style="font-size: 12px; color: #737373;">预估单价</span>
          <span style="font-size: 14px; font-weight: bold; color: ${themeColor}; font-family: monospace;">${formattedPrice}</span>
        </div>
      </div>
    `;
  });

  // 4. 返回标准模块 HTML 封装，完美嵌入企业售前系统的对话数据流中
  return `
    <div class="cms-gallery-wrapper" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #171717; width: 100%;">
      <h4 style="font-size: 14px; font-weight: bold; color: #a3a3a3; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
        <span style="width: 4px; height: 12px; background: ${themeColor}; border-radius: 2px; display: inline-block;"></span>
        为您匹配到 ${rawProducts.length} 款设备方案 (CMS 规范动态渲染)
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        ${productCardsHtml}
      </div>
    </div>
  `;
};
