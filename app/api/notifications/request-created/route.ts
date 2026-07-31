import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type NotificationRequest = {
  requestNumber?: string;
  organizationName?: string;
  wasteType?: string;
  estimatedWeightKg?: number;
  pickupAddress?: string;
  preferredPickupAt?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const notificationTo = process.env.RESEND_NOTIFICATION_TO;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (
    !resendApiKey ||
    !fromEmail ||
    !notificationTo ||
    !supabaseUrl ||
    !supabaseKey
  ) {
    return Response.json(
      { error: "이메일 알림 서버 설정이 완료되지 않았습니다." },
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
      { error: "수거 요청 알림 권한이 없습니다." },
      { status: 403 },
    );
  }

  let body: NotificationRequest;
  try {
    body = (await request.json()) as NotificationRequest;
  } catch {
    return Response.json(
      { error: "이메일 알림 요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const requestNumber = String(body.requestNumber ?? "").slice(0, 40);
  const organizationName = String(body.organizationName ?? "").slice(0, 80);
  const wasteType = String(body.wasteType ?? "").slice(0, 80);
  const pickupAddress = String(body.pickupAddress ?? "").slice(0, 200);
  const preferredPickupAt = body.preferredPickupAt
    ? String(body.preferredPickupAt).slice(0, 40)
    : "미지정";
  const estimatedWeightKg = Number(body.estimatedWeightKg);

  if (
    !requestNumber ||
    !organizationName ||
    !wasteType ||
    !pickupAddress ||
    !Number.isFinite(estimatedWeightKg) ||
    estimatedWeightKg <= 0
  ) {
    return Response.json(
      { error: "이메일 알림에 필요한 수거 요청 정보가 부족합니다." },
      { status: 400 },
    );
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "bsori-resource-platform/1.0",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notificationTo],
      subject: `[B.SORI] 새 수거 요청 ${requestNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17251d">
          <h2 style="color:#276747">새 수거 요청이 등록되었습니다.</h2>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              <tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dde8e1">요청번호</th><td style="padding:10px;border-bottom:1px solid #dde8e1">${escapeHtml(requestNumber)}</td></tr>
              <tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dde8e1">배출업체</th><td style="padding:10px;border-bottom:1px solid #dde8e1">${escapeHtml(organizationName)}</td></tr>
              <tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dde8e1">부산물</th><td style="padding:10px;border-bottom:1px solid #dde8e1">${escapeHtml(wasteType)}</td></tr>
              <tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dde8e1">예상 수량</th><td style="padding:10px;border-bottom:1px solid #dde8e1">${estimatedWeightKg.toLocaleString("ko-KR")} kg</td></tr>
              <tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dde8e1">수거지</th><td style="padding:10px;border-bottom:1px solid #dde8e1">${escapeHtml(pickupAddress)}</td></tr>
              <tr><th style="text-align:left;padding:10px">희망 수거일</th><td style="padding:10px">${escapeHtml(preferredPickupAt)}</td></tr>
            </tbody>
          </table>
          <p style="margin-top:24px;color:#617067">B.SORI 수산 부산물 통합 관리 플랫폼</p>
        </div>
      `,
    }),
  });
  const resendPayload = (await resendResponse.json()) as {
    id?: string;
    message?: string;
  };
  if (!resendResponse.ok) {
    return Response.json(
      {
        error:
          resendPayload.message ??
          "Resend에서 이메일을 발송하지 못했습니다.",
      },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, id: resendPayload.id });
}
