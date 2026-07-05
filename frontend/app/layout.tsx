// 必须确保这行存在！它负责把 Tailwind 的指令注入进整个网站
import "./globals.css"; 

export const metadata = {
  title: "MOMENTUM AI - 工业智能售前系统",
  description: "企业级 B2B 智能售前与报价 Agent 工作台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      {/* 这里的 className 保持干净，或者直接去掉多余的 module 类 */}
      <body className="antialiased">{children}</body>
    </html>
  );
}