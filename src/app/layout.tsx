import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 视频工厂",
  description: "电商短视频 AI 内容工作流",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
