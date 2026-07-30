import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B.SORI 수산 부산물 통합 관리 플랫폼",
    short_name: "B.SORI",
    description:
      "부산물 등록부터 수거, 반입, 처리까지 연결하는 통합 관리 시스템",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#102b20",
    lang: "ko",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
