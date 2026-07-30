export const runtime = "edge";

export async function GET() {
  const apiKey =
    process.env.KAKAO_JAVASCRIPT_KEY ??
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "카카오 JavaScript 키가 설정되지 않았습니다." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(
    { apiKey },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
