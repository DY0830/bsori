import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type KakaoAddressDocument = {
  address_name: string;
  x: string;
  y: string;
  road_address?: { address_name?: string } | null;
};

type KakaoKeywordDocument = {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
};

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

  const headers = { Authorization: `KakaoAK ${restKey}` };
  const [addressResponse, keywordResponse] = await Promise.all([
    fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=6`,
      { headers },
    ),
    fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=8`,
      { headers },
    ),
  ]);

  const addressPayload = (await addressResponse.json()) as {
    message?: string;
    documents?: KakaoAddressDocument[];
  };
  const keywordPayload = (await keywordResponse.json()) as {
    message?: string;
    documents?: KakaoKeywordDocument[];
  };

  if (!addressResponse.ok && !keywordResponse.ok) {
    const message = addressPayload.message || keywordPayload.message;
    const disabled = message?.includes("OPEN_MAP_AND_LOCAL") ?? false;
    return Response.json(
      {
        error: disabled
          ? "카카오 디벨로퍼스에서 카카오맵 사용 설정을 ON으로 변경해 주세요."
          : message || "카카오 주소 검색을 사용할 수 없습니다.",
      },
      { status: addressResponse.status || keywordResponse.status },
    );
  }

  const candidates = [
    ...(addressPayload.documents ?? []).map((document) => ({
      name: document.road_address?.address_name || document.address_name,
      address: document.road_address?.address_name || document.address_name,
      longitude: Number(document.x),
      latitude: Number(document.y),
    })),
    ...(keywordPayload.documents ?? []).map((document) => ({
      name: document.place_name,
      address:
        document.road_address_name || document.address_name || document.place_name,
      longitude: Number(document.x),
      latitude: Number(document.y),
    })),
  ];

  const uniqueResults = candidates
    .filter(
      (candidate, index, all) =>
        Number.isFinite(candidate.longitude) &&
        Number.isFinite(candidate.latitude) &&
        all.findIndex(
          (item) =>
            item.longitude === candidate.longitude &&
            item.latitude === candidate.latitude,
        ) === index,
    )
    .slice(0, 8);

  if (uniqueResults.length === 0) {
    return Response.json(
      { error: "일치하는 주소나 장소를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return Response.json({ result: uniqueResults[0], results: uniqueResults });
}
