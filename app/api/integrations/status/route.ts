import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "Supabase 서버 설정이 완료되지 않았습니다." },
      { status: 503 },
    );
  }
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(authorization.slice("Bearer ".length));

  if (!user) {
    return Response.json(
      { error: "로그인 세션이 올바르지 않습니다." },
      { status: 401 },
    );
  }

  return Response.json(
    {
      supabase: true,
      gemini: Boolean(process.env.GEMINI_API_KEY),
      kakaoMaps: Boolean(
        process.env.KAKAO_JAVASCRIPT_KEY ??
          process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY,
      ),
      kakaoMobility: Boolean(process.env.KAKAO_REST_API_KEY),
      weather: true,
      resend: Boolean(
        process.env.RESEND_API_KEY &&
          process.env.RESEND_FROM_EMAIL &&
          process.env.RESEND_NOTIFICATION_TO,
      ),
      auctionData: false,
      digestionPlc: false,
      essBms: false,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
