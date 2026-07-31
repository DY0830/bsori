import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
  };
};

function weatherDescription(code: number) {
  if (code === 0) return { label: "맑음", symbol: "☀" };
  if (code <= 3) return { label: "구름", symbol: "☁" };
  if ([45, 48].includes(code)) return { label: "안개", symbol: "≋" };
  if (code <= 67 || [80, 81, 82].includes(code)) {
    return { label: "비", symbol: "☂" };
  }
  if (code <= 77 || [85, 86].includes(code)) {
    return { label: "눈", symbol: "❄" };
  }
  if (code >= 95) return { label: "뇌우", symbol: "⚡" };
  return { label: "흐림", symbol: "☁" };
}

function windDirection(degrees: number) {
  const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  return directions[Math.round(degrees / 45) % 8] ?? "확인 중";
}

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

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search = new URLSearchParams({
    latitude: "35.1796",
    longitude: "129.0756",
    current:
      "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "precipitation_probability",
    timezone: "Asia/Seoul",
    forecast_days: "1",
    wind_speed_unit: "ms",
  }).toString();

  try {
    const forecastResponse = await fetch(forecastUrl, {
      headers: { Accept: "application/json" },
    });
    const payload = (await forecastResponse.json()) as OpenMeteoResponse;
    if (!forecastResponse.ok || !payload.current) {
      throw new Error("날씨 제공 서버에서 예보를 받지 못했습니다.");
    }

    const current = payload.current;
    const currentIndex = Math.max(
      0,
      payload.hourly?.time?.findIndex((time) => time === current.time) ?? 0,
    );
    const precipitationProbability = Math.round(
      payload.hourly?.precipitation_probability?.[currentIndex] ?? 0,
    );
    const temperatureC = Number(current.temperature_2m ?? 0);
    const windSpeed = Number(current.wind_speed_10m ?? 0);
    const precipitation = Number(current.precipitation ?? 0);
    const description = weatherDescription(Number(current.weather_code ?? 3));

    let riskTone: "low" | "medium" | "high" = "low";
    let riskLevel = "낮음";
    let riskReason = "수거 운행에 큰 기상 위험이 없습니다.";
    if (
      precipitationProbability >= 70 ||
      precipitation >= 5 ||
      windSpeed >= 14
    ) {
      riskTone = "high";
      riskLevel = "높음";
      riskReason = "강수 또는 강풍 가능성이 높아 운행 전 안전 점검이 필요합니다.";
    } else if (
      precipitationProbability >= 40 ||
      precipitation > 0 ||
      windSpeed >= 9 ||
      temperatureC >= 30
    ) {
      riskTone = "medium";
      riskLevel = "주의";
      riskReason = "강수·바람·고온 가능성을 고려해 수거 시간을 조정하세요.";
    }

    return Response.json(
      {
        location: "부산광역시",
        temperatureC,
        precipitationProbability,
        weather: description.label,
        symbol: description.symbol,
        windDirection: `${windDirection(Number(current.wind_direction_10m ?? 0))}풍 ${windSpeed.toFixed(1)}m/s`,
        riskLevel,
        riskTone,
        riskReason,
        forecastAt: current.time ?? new Date().toISOString(),
        issuedAt: new Date().toISOString(),
        source: "Open-Meteo (부산 좌표 기반 예보)",
      },
      { headers: { "Cache-Control": "private, max-age=900" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "부산 날씨 예보를 불러오지 못했습니다.",
      },
      { status: 502 },
    );
  }
}
