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
  const title = "B.SORI | 부산 수산 부산물 AI 자원순환 플랫폼";
  const description =
    "부산 위판량 예측, 부산물 발생 분석, 수거 물류 최적화, 혼합소화와 바이오가스·ESS 운영을 연결하는 통합 관리 플랫폼";

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
          alt: "B.SORI 부산 수산 부산물 AI 자원순환 플랫폼",
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
