import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "闪象 — AI 视频工厂",
  description: "闪象 AI 视频工厂，一键生成电商短视频，自动发布到抖音和快手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
