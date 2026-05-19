import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "闪象 Flashant — 一键闪象，万象更新",
  description:
    "闪象 Flashant，AI 商品图生成管线。上传产品图，一键生成白底图、场景图、模特图，发布到 Shopify / Amazon / TikTok Shop。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={cn("font-sans scroll-smooth", geist.variable)}>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
