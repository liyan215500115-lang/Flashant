import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getServerLocale } from "@/lib/server-t";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  if (locale === "en") {
    return {
      title: "Flashant — Stunning Visuals. Generated in a Flash.",
      description:
        "Flashant — AI product image generation pipeline. Upload product photos, generate white-background, scene, and model images. Publish to Shopify, Amazon, TikTok Shop.",
      icons: { icon: "/logo.svg" },
    };
  }
  return {
    title: "闪象 Flashant — 一键闪象，万象更新",
    description:
      "闪象 Flashant，AI 商品图生成管线。上传产品图，一键生成白底图、场景图、模特图，发布到 Shopify / Amazon / TikTok Shop。",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
