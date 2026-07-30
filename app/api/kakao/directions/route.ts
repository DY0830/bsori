import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type Coordinate = {
  longitude: number;
  latitude: number;
  name?: string;
};

type DirectionsRequest = {
  origin?: Coordinate;
  destination?: Coordinate;
  waypoints?: Coordinate[];
};

function serializeCoordinate(point: Coordinate) {
  const name = point.name ? `,name=${point.name}` : "";
  return `${point.longitude},${point.latitude}${name}`;
}

export async function POST(request: Request) {
  const restKey = process.env.KAKAO_REST_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!restKey || !supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "카카오 Mobility 서버 설정이 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const accessToken = authorization.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile?.is_active ||
    !["driver", "admin"].includes(profile.role)
  ) {
    return Response.json({ error: "경로 조회 권한이 없습니다." }, { status: 403 });
  }

  let body: DirectionsRequest;
  try {
    body = (await request.json()) as DirectionsRequest;
  } catch {
    return Response.json(
      { error: "길찾기 요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!body.origin || !body.destination) {
    return Response.json(
      { error: "출발지와 목적지가 필요합니다." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    origin: serializeCoordinate(body.origin),
    destination: serializeCoordinate(body.destination),
    priority: "RECOMMEND",
    alternatives: "false",
    road_details: "false",
    summary: "false",
  });
  const waypoints = (body.waypoints ?? []).slice(0, 5);
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(serializeCoordinate).join("|"));
  }

  const kakaoResponse = await fetch(
    `https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`,
    {
      headers: {
        Authorization: `KakaoAK ${restKey}`,
        "Content-Type": "application/json",
      },
    },
  );
  const payload = (await kakaoResponse.json()) as {
    errorType?: string;
    message?: string;
    routes?: Array<{
      result_code: number;
      result_msg: string;
      summary?: { distance: number; duration: number };
      sections?: Array<{
        roads?: Array<{ vertexes?: number[] }>;
      }>;
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
            "카카오 길찾기를 사용할 수 없습니다. API 사용 설정을 확인해 주세요.",
      },
      { status: kakaoResponse.status },
    );
  }

  const route = payload.routes?.[0];
  if (!route || route.result_code !== 0 || !route.summary) {
    return Response.json(
      { error: route?.result_msg ?? "이동 경로를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const path =
    route.sections?.flatMap(
      (section) =>
        section.roads?.flatMap((road) => {
          const vertexes = road.vertexes ?? [];
          const points: Coordinate[] = [];
          for (let index = 0; index < vertexes.length; index += 2) {
            points.push({
              longitude: vertexes[index],
              latitude: vertexes[index + 1],
            });
          }
          return points;
        }) ?? [],
    ) ?? [];

  return Response.json({
    route: {
      distanceMeters: route.summary.distance,
      durationSeconds: route.summary.duration,
      path,
    },
  });
}
