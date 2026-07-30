import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "B.SORI | 수산 부산물 통합 관리 플랫폼";
  const description =
    "배출업체, 수거기사, 자원화시설, 관리자를 연결하는 수산 부산물 등록·수거·반입·처리 통합 웹 시스템";

  return {
    title,
    description,
    applicationName: "B.SORI",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1717,
          height: 916,
          alt: "B.SORI 수산 부산물 통합 관리 플랫폼",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
