import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getTranslator } from "@/lib/locale.server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getTranslator();
  if (locale !== "zh") {
    const title = "Flashant — Stunning Visuals. Generated in a Flash.";
    const description =
      "Upload a product photo, pick a style, and get images you can download in seconds. Connect Shopify when you want to publish.";
    return {
      title,
      description,
      icons: { icon: "/logo.svg" },
      openGraph: { title, description },
      twitter: { card: "summary", title, description },
    };
  }
  const title = "闪象 Flashant — 一键闪象，万象更新";
  const description =
    "上传一张商品图，选好风格，几秒就能下载成片。需要发布时，再连接 Shopify。";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getTranslator();
  return (
    <html lang={locale} className="scroll-smooth" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <body className="min-h-screen flex flex-col">
        <Providers locale={locale} messages={messages}>{children}</Providers>
      </body>
    </html>
  );
}
