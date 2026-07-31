import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type AnalyzeRequest = {
  imageBase64?: string;
  mimeType?: string;
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    wasteType: { type: "STRING" },
    condition: { type: "STRING" },
    foreignMaterial: { type: "STRING" },
    estimatedWeightKgMin: { type: "NUMBER" },
    estimatedWeightKgMax: { type: "NUMBER" },
    recommendedPickupHours: { type: "NUMBER" },
    confidence: { type: "NUMBER" },
    summary: { type: "STRING" },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "wasteType",
    "condition",
    "foreignMaterial",
    "estimatedWeightKgMin",
    "estimatedWeightKgMax",
    "recommendedPickupHours",
    "confidence",
    "summary",
    "warnings",
  ],
};

export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!geminiApiKey || !supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "AI 분석 서버 설정이 완료되지 않았습니다." },
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profileError ||
    !profile?.is_active ||
    !["discharger", "admin"].includes(profile.role)
  ) {
    return Response.json(
      { error: "사진 분석 권한이 없습니다." },
      { status: 403 },
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return Response.json(
      { error: "분석 요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const mimeType = body.mimeType ?? "";
  const imageBase64 = body.imageBase64 ?? "";
  if (!mimeType.startsWith("image/") || !imageBase64) {
    return Response.json(
      { error: "분석할 이미지가 필요합니다." },
      { status: 400 },
    );
  }
  if (imageBase64.length > 14_000_000) {
    return Response.json(
      { error: "이미지가 너무 큽니다. 10MB 이하 사진을 사용해 주세요." },
      { status: 413 },
    );
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "이 사진은 수산 부산물 수거 요청에 첨부된 현장 사진입니다.",
                  "보이는 부산물의 종류와 상태를 보수적으로 분석하세요.",
                  "사진만으로 무게를 정확히 알 수 없으므로 범위로 추정하고 추정의 한계를 summary 또는 warnings에 명시하세요.",
                  "confidence는 0부터 100 사이 숫자입니다.",
                  "모든 문자 응답은 한국어로 작성하세요.",
                ].join(" "),
              },
              {
                inline_data: { mime_type: mimeType, data: imageBase64 },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  const geminiPayload = (await geminiResponse.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  if (!geminiResponse.ok) {
    return Response.json(
      {
        error:
          geminiPayload.error?.message ??
          "Gemini API에서 분석 결과를 받지 못했습니다.",
      },
      { status: 502 },
    );
  }

  const text = geminiPayload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return Response.json(
      { error: "Gemini 분석 결과가 비어 있습니다." },
      { status: 502 },
    );
  }

  try {
    return Response.json({ analysis: JSON.parse(text) });
  } catch {
    return Response.json(
      { error: "Gemini 분석 결과를 해석하지 못했습니다." },
      { status: 502 },
    );
  }
}
