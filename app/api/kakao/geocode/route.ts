import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(request: Request) {
  const restKey = process.env.KAKAO_REST_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!restKey || !supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "카카오 API 서버 설정이 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const accessToken = authorization.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return Response.json(
      { error: "로그인 세션이 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();
  if (!query) {
    return Response.json({ error: "검색할 주소를 입력해 주세요." }, { status: 400 });
  }

  const kakaoResponse = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `KakaoAK ${restKey}` },
    },
  );
  const payload = (await kakaoResponse.json()) as {
    errorType?: string;
    message?: string;
    documents?: Array<{
      address_name: string;
      x: string;
      y: string;
      road_address?: { address_name?: string } | null;
    }>;
  };

  if (!kakaoResponse.ok) {
    const disabled =
      payload.message?.includes("OPEN_MAP_AND_LOCAL") ?? false;
    return Response.json(
      {
        error: disabled
          ? "카카오디벨로퍼스에서 카카오맵 사용 설정을 ON으로 변경해 주세요."
          : payload.message ??
            "카카오 주소 검색을 사용할 수 없습니다. 카카오맵 사용 설정을 확인해 주세요.",
      },
      { status: kakaoResponse.status },
    );
  }

  const result = payload.documents?.[0];
  if (!result) {
    return Response.json(
      { error: "일치하는 주소를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return Response.json({
    result: {
      address:
        result.road_address?.address_name || result.address_name || query,
      longitude: Number(result.x),
      latitude: Number(result.y),
    },
  });
}
