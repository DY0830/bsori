"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type Workspace =
  | "overview"
  | "operations"
  | "forecast"
  | "energy"
  | "discharger"
  | "driver"
  | "facility"
  | "integrations";
type DriverTaskStatus = "대기" | "이동 중" | "도착" | "수거 완료";
type UserRole = "discharger" | "driver" | "facility" | "admin";

type Profile = {
  id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  organizations: { name: string } | { name: string }[] | null;
};

type DbWasteRequest = {
  id: string;
  request_number: string;
  waste_type: string;
  estimated_weight_kg: number;
  pickup_address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  organizations: { name: string } | { name: string }[] | null;
};

type DispatchDriver = {
  id: string;
  full_name: string;
  organizations: { name: string } | { name: string }[] | null;
};

type DispatchVehicle = {
  id: string;
  driver_id: string;
  plate_number: string;
  capacity_kg: number;
};

type DriverAssignment = {
  id: string;
  route_order: number | null;
  assigned_at: string;
  started_at: string | null;
  arrived_at: string | null;
  collected_at: string | null;
  actual_weight_kg: number | null;
  vehicles: { plate_number: string } | { plate_number: string }[] | null;
  waste_requests:
    | {
        id: string;
        request_number: string;
        waste_type: string;
        estimated_weight_kg: number;
        pickup_address: string;
        latitude: number | null;
        longitude: number | null;
        status: string;
        organizations: { name: string } | { name: string }[] | null;
      }
    | {
        id: string;
        request_number: string;
        waste_type: string;
        estimated_weight_kg: number;
        pickup_address: string;
        latitude: number | null;
        longitude: number | null;
        status: string;
        organizations: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

type FacilityWorkItem = {
  id: string;
  request_number: string;
  waste_type: string;
  estimated_weight_kg: number;
  status: string;
  organizations: { name: string } | { name: string }[] | null;
  collection_assignments:
    | {
        actual_weight_kg: number | null;
        collected_at: string | null;
        vehicles: { plate_number: string } | { plate_number: string }[] | null;
      }
    | {
        actual_weight_kg: number | null;
        collected_at: string | null;
        vehicles: { plate_number: string } | { plate_number: string }[] | null;
      }[]
    | null;
  facility_receipts:
    | {
        id: string;
        measured_weight_kg: number;
        received_at: string;
        processing_results:
          | {
              id: string;
              processing_method: string;
              processing_line: string | null;
              input_weight_kg: number;
              output_weight_kg: number | null;
            }
          | {
              id: string;
              processing_method: string;
              processing_line: string | null;
              input_weight_kg: number;
              output_weight_kg: number | null;
            }[]
          | null;
      }
    | {
        id: string;
        measured_weight_kg: number;
        received_at: string;
        processing_results:
          | {
              id: string;
              processing_method: string;
              processing_line: string | null;
              input_weight_kg: number;
              output_weight_kg: number | null;
            }
          | {
              id: string;
              processing_method: string;
              processing_line: string | null;
              input_weight_kg: number;
              output_weight_kg: number | null;
            }[]
          | null;
      }[]
    | null;
};

type Organization = {
  id: string;
  name: string;
  organization_type: UserRole;
};

type WasteAnalysis = {
  wasteType: string;
  condition: string;
  foreignMaterial: string;
  estimatedWeightKgMin: number;
  estimatedWeightKgMax: number;
  recommendedPickupHours: number;
  confidence: number;
  summary: string;
  warnings: string[];
};

type WeatherForecast = {
  location: string;
  temperatureC: number;
  precipitationProbability: number;
  weather: string;
  symbol: string;
  windDirection: string;
  riskLevel: string;
  riskTone: "low" | "medium" | "high";
  riskReason: string;
  forecastAt: string;
  issuedAt: string;
  source: string;
};

type Coordinate = {
  longitude: number;
  latitude: number;
};

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => {
    extend: (point: KakaoLatLng) => void;
  };
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    title?: string;
  }) => unknown;
  Polyline: new (options: {
    map: KakaoMap;
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
  }) => unknown;
};

type KakaoLatLng = object;
type KakaoMap = {
  setBounds: (bounds: object, padding?: number) => void;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

let kakaoMapsLoader: Promise<KakaoMapsApi> | null = null;

function loadKakaoMaps() {
  if (kakaoMapsLoader) return kakaoMapsLoader;

  kakaoMapsLoader = (async () => {
    const configResponse = await fetch("/api/kakao/config", {
      cache: "no-store",
    });
    const config = (await configResponse.json()) as {
      apiKey?: string;
      error?: string;
    };
    if (!configResponse.ok || !config.apiKey) {
      throw new Error(
        config.error ?? "카카오 JavaScript 키를 불러오지 못했습니다.",
      );
    }

    return new Promise<KakaoMapsApi>((resolve, reject) => {
      const finish = () => {
        if (!window.kakao?.maps) {
          reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao!.maps));
      };

      if (window.kakao?.maps) {
        finish();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-bsori-kakao-map="true"]',
      );
      if (existing) {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("카카오 지도 SDK 연결에 실패했습니다.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.dataset.bsoriKakaoMap = "true";
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${config.apiKey}&autoload=false`;
      script.addEventListener("load", finish, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("카카오 지도 SDK 연결에 실패했습니다.")),
        { once: true },
      );
      document.head.appendChild(script);
    });
  })();

  return kakaoMapsLoader;
}

const adminNavigation: {
  id: Workspace;
  label: string;
  eyebrow: string;
  icon: string;
}[] = [
  { id: "overview", label: "통합 현황", eyebrow: "전체 흐름", icon: "⌂" },
  { id: "operations", label: "수거 운영", eyebrow: "배차·차량", icon: "↗" },
  { id: "forecast", label: "AI 예측", eyebrow: "수급·물류", icon: "AI" },
  { id: "energy", label: "자원화·에너지", eyebrow: "소화·ESS", icon: "E" },
  { id: "integrations", label: "계정·연동", eyebrow: "설정", icon: "⋯" },
];

const accountNavigationItem = {
  id: "integrations" as Workspace,
  label: "계정·연동",
  eyebrow: "역할 전환",
  icon: "⋯",
};

const roleNavigation: Record<
  Exclude<UserRole, "admin">,
  typeof adminNavigation
> = {
  discharger: [
    {
      id: "discharger",
      label: "부산물 등록",
      eyebrow: "배출업체",
      icon: "+",
    },
    accountNavigationItem,
  ],

  driver: [
    {
      id: "driver",
      label: "수거 운행",
      eyebrow: "수거기사",
      icon: "↗",
    },
    accountNavigationItem,
  ],

  facility: [
    {
      id: "facility",
      label: "반입·처리",
      eyebrow: "자원화시설",
      icon: "□",
    },
    accountNavigationItem,
  ],
};

const statusTone: Record<string, string> = {
  "접수 완료": "blue",
  "배차 완료": "violet",
  "수거 중": "amber",
  "운송 중": "amber",
  "반입 완료": "green",
  "처리 완료": "green",
  대기: "gray",
  "이동 중": "amber",
  도착: "blue",
  "수거 완료": "green",
};

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const integrations = [
  {
    statusKey: "supabase",
    name: "Supabase",
    detail: "Auth · PostgreSQL · Storage · Realtime",
    status: supabaseConfigured ? "연결 완료" : "설정 필요",
    group: "핵심 백엔드",
    tone: "green",
    mark: "S",
  },
  {
    statusKey: "gemini",
    name: "Gemini API",
    detail: "사진 판별 · 문서 정보 추출",
    status: "연결 완료",
    group: "AI 분석",
    tone: "violet",
    mark: "G",
  },
  {
    statusKey: "kakaoMaps",
    name: "Kakao Maps",
    detail: "지도 · 주소 좌표 변환",
    status: "연결 완료",
    group: "지도",
    tone: "yellow",
    mark: "K",
  },
  {
    statusKey: "kakaoMobility",
    name: "Kakao Mobility",
    detail: "경로 · 거리 · 예상 시간",
    status: "서버 연결 완료",
    group: "경로",
    tone: "yellow",
    mark: "M",
  },
  {
    statusKey: "weather",
    name: "부산 기상예보",
    detail: "강수 · 고온 · 수거 위험 판단",
    status: "연결 완료",
    group: "날씨",
    tone: "blue",
    mark: "W",
  },
  {
    statusKey: "resend",
    name: "Resend",
    detail: "요청 · 지연 · 완료 이메일",
    status: "서버 알림 연결",
    group: "알림",
    tone: "navy",
    mark: "R",
  },
  {
    statusKey: "auctionData",
    name: "부산 위판 데이터",
    detail: "공동어시장 위판량 · 어종 · 입항량",
    status: "데이터 API 필요",
    group: "예측 원천",
    tone: "blue",
    mark: "B",
  },
  {
    statusKey: "digestionPlc",
    name: "혼합소화 PLC",
    detail: "투입비 · pH · 유기물 부하 · 체류시간",
    status: "설비 연동 필요",
    group: "공정 제어",
    tone: "green",
    mark: "P",
  },
  {
    statusKey: "essBms",
    name: "ESS BMS",
    detail: "SOC · 충방전 · 발전 잉여전력",
    status: "설비 연동 필요",
    group: "에너지 제어",
    tone: "violet",
    mark: "E",
  },
];

const roleLabel: Record<UserRole, string> = {
  discharger: "배출업체",
  driver: "수거기사",
  facility: "자원화시설",
  admin: "관리자",
};

const roleWorkspace: Record<UserRole, Workspace> = {
  admin: "overview",
  discharger: "discharger",
  driver: "driver",
  facility: "facility",
};

const selectableRoles: UserRole[] = [
  "admin",
  "discharger",
  "driver",
  "facility",
];

const roleOptions: Array<{
  role: UserRole;
  title: string;
  detail: string;
  mark: string;
}> = [
  {
    role: "admin",
    title: "통합관리자",
    detail: "전체 현황·배차·AI 예측·에너지 운영",
    mark: "A",
  },
  {
    role: "discharger",
    title: "배출업체",
    detail: "부산물 사진 분석·수거 요청 등록",
    mark: "D",
  },
  {
    role: "driver",
    title: "수거기사",
    detail: "배정 업무·수거 경로·수거 결과 입력",
    mark: "C",
  },
  {
    role: "facility",
    title: "자원화시설 관리자",
    detail: "반입 검수·계량·처리 결과 기록",
    mark: "F",
  },
];

const requestStatusLabel: Record<string, string> = {
  requested: "접수 완료",
  assigned: "배차 완료",
  collecting: "수거 중",
  collected: "수거 완료",
  in_transit: "운송 중",
  received: "반입 완료",
  processing: "처리 중",
  completed: "처리 완료",
  cancelled: "취소",
};

const demoRequests: DbWasteRequest[] = [
  {
    id: "demo-request-1",
    request_number: "DEMO-0731-001",
    waste_type: "생선 내장",
    estimated_weight_kg: 420,
    pickup_address: "부산광역시 영도구 해양로 24",
    latitude: 35.0884,
    longitude: 129.0708,
    status: "requested",
    created_at: "2026-07-31T07:30:00+09:00",
    organizations: { name: "해원수산" },
  },
  {
    id: "demo-request-2",
    request_number: "DEMO-0731-002",
    waste_type: "어류 뼈·머리",
    estimated_weight_kg: 1240,
    pickup_address: "부산광역시 서구 충무대로 202",
    latitude: 35.0976,
    longitude: 129.0276,
    status: "assigned",
    created_at: "2026-07-31T06:45:00+09:00",
    organizations: { name: "부산공동어시장" },
  },
  {
    id: "demo-request-3",
    request_number: "DEMO-0731-003",
    waste_type: "혼합 부산물",
    estimated_weight_kg: 540,
    pickup_address: "부산광역시 영도구 남항서로 85",
    latitude: 35.0846,
    longitude: 129.0365,
    status: "collecting",
    created_at: "2026-07-30T15:20:00+09:00",
    organizations: { name: "남항수산가공" },
  },
  {
    id: "demo-request-4",
    request_number: "DEMO-0730-004",
    waste_type: "갑각류 껍질",
    estimated_weight_kg: 760,
    pickup_address: "부산광역시 중구 자갈치해안로 52",
    latitude: 35.0967,
    longitude: 129.0305,
    status: "collected",
    created_at: "2026-07-30T09:10:00+09:00",
    organizations: { name: "자갈치수산" },
  },
  {
    id: "demo-request-5",
    request_number: "DEMO-0729-005",
    waste_type: "생선 내장",
    estimated_weight_kg: 610,
    pickup_address: "부산광역시 영도구 태종로 727",
    latitude: 35.0758,
    longitude: 129.0671,
    status: "processing",
    created_at: "2026-07-29T08:30:00+09:00",
    organizations: { name: "영도수산" },
  },
  {
    id: "demo-request-6",
    request_number: "DEMO-0728-006",
    waste_type: "어류 뼈·머리",
    estimated_weight_kg: 890,
    pickup_address: "부산광역시 기장군 기장해안로 147",
    latitude: 35.1926,
    longitude: 129.2233,
    status: "completed",
    created_at: "2026-07-28T10:00:00+09:00",
    organizations: { name: "기장수산가공" },
  },
];

const demoRouteStops = demoRequests
  .filter((request) => request.latitude !== null && request.longitude !== null)
  .slice(0, 3)
  .map((request) => ({
    name: getOrganizationName(request.organizations),
    latitude: Number(request.latitude),
    longitude: Number(request.longitude),
  }));

function getOrganizationName(
  organization: Profile["organizations"] | DbWasteRequest["organizations"],
) {
  if (Array.isArray(organization)) {
    return organization[0]?.name ?? "소속 미지정";
  }
  return organization?.name ?? "소속 미지정";
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function AuthPanel({
  supabase,
  onReady,
}: {
  supabase: SupabaseClient;
  onReady: (user: User) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "bootstrap" | "activate">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const completePendingProfile = async () => {
    const inviteToken = window.localStorage.getItem("bsori-invite-token");
    const bootstrapRaw = window.localStorage.getItem("bsori-bootstrap");

    if (inviteToken) {
      const { error: inviteError } = await supabase.rpc(
        "accept_account_invitation",
        { p_token: inviteToken },
      );
      if (inviteError) throw inviteError;
      window.localStorage.removeItem("bsori-invite-token");
    } else if (bootstrapRaw) {
      const bootstrap = JSON.parse(bootstrapRaw) as {
        fullName: string;
        phone: string;
      };
      const { error: bootstrapError } = await supabase.rpc(
        "bootstrap_first_admin",
        {
          p_full_name: bootstrap.fullName,
          p_phone: bootstrap.phone || null,
        },
      );
      if (bootstrapError) throw bootstrapError;
      window.localStorage.removeItem("bsori-bootstrap");
    }
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      if (!data.user) throw new Error("로그인 사용자를 확인하지 못했습니다.");

      await completePendingProfile();
      await onReady(data.user);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "로그인 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitBootstrap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();

    try {
      window.localStorage.setItem(
        "bsori-bootstrap",
        JSON.stringify({ fullName, phone }),
      );
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signupError) throw signupError;

      if (data.session && data.user) {
        await completePendingProfile();
        await onReady(data.user);
      } else {
        setMessage(
          "인증 메일을 확인한 뒤 로그인해 주세요. 첫 로그인 시 관리자 권한이 자동으로 연결됩니다.",
        );
        setMode("login");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "초기 관리자 등록 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitActivation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const inviteToken = String(form.get("inviteToken") ?? "").trim();

    try {
      window.localStorage.setItem("bsori-invite-token", inviteToken);
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signupError) throw signupError;

      if (data.session && data.user) {
        await completePendingProfile();
        await onReady(data.user);
      } else {
        setMessage(
          "인증 메일을 확인한 뒤 로그인해 주세요. 첫 로그인 시 초대받은 업체와 역할이 연결됩니다.",
        );
        setMode("login");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "초대 계정 활성화 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <span className="brand-mark">B</span>
        <p>BLUE RESOURCE CYCLE</p>
        <h1>
          부산 수산 부산물
          <br />
          통합 관리 플랫폼
        </h1>
        <div className="auth-flow">
          <span>등록</span>
          <i />
          <span>수거</span>
          <i />
          <span>반입</span>
          <i />
          <span>처리</span>
        </div>
      </section>

      <section className="auth-card">
        <span className="page-kicker">SECURE WORKSPACE</span>
        <h2>
          {mode === "login" && "B.SORI 로그인"}
          {mode === "bootstrap" && "초기 관리자 등록"}
          {mode === "activate" && "초대 계정 활성화"}
        </h2>
        <p>
          {mode === "login" && "관리자가 등록한 이메일 계정으로 로그인하세요."}
          {mode === "bootstrap" &&
            "최초 한 번만 운영본부 관리자 계정을 만들 수 있습니다."}
          {mode === "activate" &&
            "관리자에게 받은 이메일과 초대 코드를 입력하세요."}
        </p>

        {mode === "login" && (
          <form className="auth-form" onSubmit={submitLogin}>
            <label>
              <span>이메일</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              {busy ? "로그인 확인 중..." : "로그인"}
            </button>
          </form>
        )}

        {mode === "bootstrap" && (
          <form className="auth-form" onSubmit={submitBootstrap}>
            <label>
              <span>관리자 이름</span>
              <input name="fullName" required />
            </label>
            <label>
              <span>연락처</span>
              <input name="phone" placeholder="010-0000-0000" />
            </label>
            <label>
              <span>이메일</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              {busy ? "관리자 생성 중..." : "초기 관리자 만들기"}
            </button>
          </form>
        )}

        {mode === "activate" && (
          <form className="auth-form" onSubmit={submitActivation}>
            <label>
              <span>초대받은 이메일</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>초대 코드</span>
              <input name="inviteToken" autoComplete="one-time-code" required />
            </label>
            <label>
              <span>새 비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              {busy ? "계정 연결 중..." : "계정 활성화"}
            </button>
          </form>
        )}

        {message && <p className="auth-message success">{message}</p>}
        {error && <p className="auth-message error">{error}</p>}

        <div className="auth-switches">
          {mode !== "login" && (
            <button type="button" onClick={() => setMode("login")}>
              로그인으로 돌아가기
            </button>
          )}
          {mode === "login" && (
            <>
              <button type="button" onClick={() => setMode("activate")}>
                초대 코드가 있어요
              </button>
              <button type="button" onClick={() => setMode("bootstrap")}>
                최초 관리자 설정
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminInvitePanel({
  supabase,
  notify,
}: {
  supabase: SupabaseClient;
  notify: (message: string) => void;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [role, setRole] = useState<UserRole>("discharger");
  const [organizationId, setOrganizationId] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("organizations")
      .select("id, name, organization_type")
      .order("name")
      .then(({ data }) => {
        const items = (data ?? []) as Organization[];
        setOrganizations(items);
        const first = items.find(
          (organization) => organization.organization_type === role,
        );
        setOrganizationId(first?.id ?? "");
      });
  }, [role, supabase]);

  const changeRole = (nextRole: UserRole) => {
    setRole(nextRole);
    const matching = organizations.find(
      (organization) => organization.organization_type === nextRole,
    );
    setOrganizationId(matching?.id ?? "");
  };

  const createInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setInviteToken("");

    const form = new FormData(formElement);
    const { data, error } = await supabase.rpc("create_account_invitation", {
      p_email: String(form.get("email") ?? "").trim(),
      p_full_name: String(form.get("fullName") ?? "").trim(),
      p_phone: String(form.get("phone") ?? "").trim() || null,
      p_role: role,
      p_organization_id: organizationId,
    });

    setBusy(false);

    if (error) {
      notify(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const token =
      result && typeof result === "object" && "invite_token" in result
        ? String(result.invite_token)
        : "";
    setInviteToken(token);
    notify("사용자 초대 코드가 생성되었습니다.");
    formElement.reset();
  };

  const filteredOrganizations = organizations.filter(
    (organization) =>
      organization.organization_type === role ||
      (role === "admin" && organization.organization_type === "admin"),
  );

  return (
    <section className="surface invite-panel">
      <div className="surface-heading">
        <div>
          <span className="section-kicker">ACCOUNT CONTROL</span>
          <h2>사용자 계정 초대</h2>
        </div>
        <span className="number-pill">{organizations.length}개 업체</span>
      </div>
      <p className="invite-description">
        관리자가 사용자와 업체 역할을 지정합니다. 비밀번호는 사용자가 초대
        코드를 통해 직접 설정합니다.
      </p>
      <form className="invite-form" onSubmit={createInvitation}>
        <label>
          <span>사용자 이름</span>
          <input name="fullName" required />
        </label>
        <label>
          <span>이메일</span>
          <input name="email" type="email" required />
        </label>
        <label>
          <span>연락처</span>
          <input name="phone" placeholder="010-0000-0000" />
        </label>
        <label>
          <span>역할</span>
          <select
            value={role}
            onChange={(event) => changeRole(event.target.value as UserRole)}
          >
            <option value="discharger">배출업체</option>
            <option value="driver">수거기사</option>
            <option value="facility">자원화시설</option>
            <option value="admin">관리자</option>
          </select>
        </label>
        <label className="full">
          <span>소속 업체</span>
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            required
          >
            {filteredOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action full" disabled={busy}>
          {busy ? "초대 생성 중..." : "초대 코드 생성"}
        </button>
      </form>
      {inviteToken && (
        <div className="invite-result">
          <span>1회용 초대 코드</span>
          <strong>{inviteToken}</strong>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(inviteToken);
              notify("초대 코드를 복사했습니다.");
            }}
          >
            코드 복사
          </button>
          <small>7일 안에 계정 활성화 화면에서 사용해야 합니다.</small>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${statusTone[status] ?? "gray"}`}>
      <i />
      {status}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <article className="mini-metric">
      <div className={`metric-icon ${accent}`}>{label.slice(0, 1)}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function AdminDispatchPanel({
  supabase,
  requests,
  notify,
  onChanged,
}: {
  supabase: SupabaseClient;
  requests: DbWasteRequest[];
  notify: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
  const [requestId, setRequestId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "requested"),
    [requests],
  );
  const driverVehicles = vehicles.filter(
    (vehicle) => vehicle.driver_id === driverId,
  );
  const suggestedRouteOrder = Math.max(
    1,
    pendingRequests.findIndex((request) => request.id === requestId) + 1,
  );

  const loadResources = useCallback(async () => {
    const [driverResult, vehicleResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, organizations(name)")
        .eq("role", "driver")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("vehicles")
        .select("id, driver_id, plate_number, capacity_kg")
        .order("plate_number"),
    ]);

    if (driverResult.error) {
      notify(driverResult.error.message);
      return;
    }
    if (vehicleResult.error) {
      notify(vehicleResult.error.message);
      return;
    }

    const nextDrivers = (driverResult.data ?? []) as DispatchDriver[];
    const nextVehicles = (vehicleResult.data ?? []) as DispatchVehicle[];
    setDrivers(nextDrivers);
    setVehicles(nextVehicles);
    setDriverId((current) => current || nextDrivers[0]?.id || "");
    setRequestId((current) => current || pendingRequests[0]?.id || "");
  }, [notify, pendingRequests, supabase]);

  useEffect(() => {
    queueMicrotask(() => void loadResources());
  }, [loadResources]);

  useEffect(() => {
    const firstVehicle = vehicles.find(
      (vehicle) => vehicle.driver_id === driverId,
    );
    queueMicrotask(() => setVehicleId(firstVehicle?.id ?? ""));
  }, [driverId, vehicles]);

  const registerVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!driverId) {
      notify("차량을 배정할 수거기사를 먼저 선택해 주세요.");
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("vehicles").insert({
      driver_id: driverId,
      plate_number: String(form.get("plateNumber") ?? "").trim(),
      capacity_kg: Number(form.get("capacityKg")),
      status: "available",
    });
    setBusy(false);
    if (error) {
      notify(error.message);
      return;
    }
    event.currentTarget.reset();
    await loadResources();
    notify("수거 차량을 등록했습니다.");
  };

  const assignRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestId || !driverId || !vehicleId) {
      notify("수거 요청, 기사, 차량을 모두 선택해 주세요.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("assign_collection_request", {
      p_request_id: requestId,
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
      p_route_order: suggestedRouteOrder,
    });
    setBusy(false);
    if (error) {
      notify(error.message);
      return;
    }
    await onChanged();
    setRequestId("");
    notify("실제 DB에 배차를 저장하고 기사에게 전달했습니다.");
  };

  return (
    <article className="surface dispatch-panel">
      <div className="surface-heading">
        <div>
          <span className="section-kicker">LIVE DISPATCH</span>
          <h2>기사·차량 배차</h2>
        </div>
        <div className="dispatch-resource-state">
          <span>기사 {drivers.length}명</span>
          <span>차량 {vehicles.length}대</span>
          <b>대기 {pendingRequests.length}건</b>
        </div>
      </div>
      {drivers.length === 0 && (
        <div className="resource-empty-banner">
          <strong>활성화된 수거기사가 없습니다.</strong>
          <span>
            아래 ‘사용자 계정 초대’에서 수거기사 계정을 만든 뒤 초대받은
            사용자가 한 번 로그인하면 기사 목록에 표시됩니다.
          </span>
        </div>
      )}
      <div className="dispatch-grid">
        <form onSubmit={assignRequest}>
          <label>
            <span>접수 요청</span>
            <select
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              required
            >
              <option value="">접수 요청 선택</option>
              {pendingRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.request_number} ·{" "}
                  {getOrganizationName(request.organizations)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>수거기사</span>
            <select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              required
            >
              <option value="">
                {drivers.length ? "기사 선택" : "활성 기사 없음"}
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name} ·{" "}
                  {getOrganizationName(driver.organizations)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>차량</span>
            <select
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              required
            >
              <option value="">
                {driverId
                  ? driverVehicles.length
                    ? "차량 선택"
                    : "등록된 차량 없음"
                  : "기사 먼저 선택"}
              </option>
              {driverVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate_number} · {vehicle.capacity_kg}kg
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>대기 목록 순서</span>
            <input
              type="number"
              min="1"
              value={suggestedRouteOrder}
              readOnly
              aria-label="대기 목록 방문 순서"
            />
          </label>
          <button className="primary-action" disabled={busy}>
            {busy ? "저장 중…" : "배차 확정"}
          </button>
        </form>
        <form className="vehicle-register" onSubmit={registerVehicle}>
          <div>
            <strong>배차 차량 등록</strong>
            <small>선택한 기사에게 새 차량을 연결합니다.</small>
          </div>
          <input
            name="plateNumber"
            placeholder="부산 80가 1234"
            aria-label="차량 번호"
            required
          />
          <input
            name="capacityKg"
            type="number"
            min="1"
            placeholder="적재량 kg"
            aria-label="차량 적재량"
            required
          />
          <button disabled={busy}>차량 등록</button>
        </form>
      </div>
    </article>
  );
}

function AdminOverview({
  requests,
  weather,
  weatherLoading,
  onNavigate,
}: {
  requests: DbWasteRequest[];
  weather: WeatherForecast | null;
  weatherLoading: boolean;
  onNavigate: (workspace: Workspace) => void;
}) {
  const totalWeightKg = requests.reduce(
    (sum, request) => sum + Number(request.estimated_weight_kg || 0),
    0,
  );
  const activeCount = requests.filter(
    (request) => !["completed", "cancelled"].includes(request.status),
  ).length;
  const completedCount = requests.filter(
    (request) => request.status === "completed",
  ).length;
  const biogasReadyKg = requests
    .filter((request) =>
      [
        "collected",
        "in_transit",
        "received",
        "processing",
        "completed",
      ].includes(request.status),
    )
    .reduce(
      (sum, request) => sum + Number(request.estimated_weight_kg || 0),
      0,
    );
  const completionRate =
    requests.length > 0
      ? Math.round((completedCount / requests.length) * 100)
      : 0;
  const pipelineStages = [
    ["01", "발생 예측", requests.length, "AI 수급 계획"],
    [
      "02",
      "등록",
      requests.filter((request) => request.status === "requested").length,
      "배출업체 접수",
    ],
    [
      "03",
      "수거",
      requests.filter((request) =>
        ["assigned", "collecting", "collected", "in_transit"].includes(
          request.status,
        ),
      ).length,
      "최적 경로 운송",
    ],
    [
      "04",
      "자원화",
      requests.filter((request) =>
        ["received", "processing", "completed"].includes(request.status),
      ).length,
      "혼합소화 투입",
    ],
    ["05", "에너지", completedCount, "바이오가스·ESS"],
  ] as const;
  const modules: {
    title: string;
    eyebrow: string;
    description: string;
    workspace: Workspace;
    state: string;
  }[] = [
    {
      title: "위판량·발생량 예측",
      eyebrow: "AI FORECAST",
      description:
        "부산 위판 흐름과 등록 이력을 바탕으로 다음 수거 물량을 예측합니다.",
      workspace: "forecast",
      state: "예측 모델",
    },
    {
      title: "수거·물류 최적화",
      eyebrow: "SMART LOGISTICS",
      description:
        "기사, 차량 적재량, 수거지와 기상을 함께 보고 방문 순서를 결정합니다.",
      workspace: "operations",
      state: `${activeCount}건 운영`,
    },
    {
      title: "혼합소화·ESS 운영",
      eyebrow: "BIOGAS & ENERGY",
      description:
        "수산 부산물 투입비와 바이오가스 생산, ESS 충방전을 한 화면에서 봅니다.",
      workspace: "energy",
      state: `${(biogasReadyKg / 1000).toFixed(1)}t 확보`,
    },
  ];

  return (
    <div className="page-stack">
      <section className="page-hero admin-hero simple-hero">
        <div>
          <span className="page-kicker">BUSAN BLUE RESOURCE CONTROL</span>
          <h1>
            부산 수산 부산물을
            <br />
            <em>에너지 자원으로 연결합니다.</em>
          </h1>
          <p>
            위판량 예측부터 부산물 발생 분석, 수거 최적화, 혼합소화와 ESS
            운영까지 하나의 공급망으로 관리합니다.
          </p>
        </div>
        <div className="hero-status-card">
          <div className="hero-status-top">
            <span>
              <i />
              공급망 실시간 연결
            </span>
            <small>SUPABASE LIVE</small>
          </div>
          <div className="hero-status-numbers">
            <div>
              <span>전체 처리 완료율</span>
              <strong>
                {completionRate}
                <small>%</small>
              </strong>
            </div>
            <div
              className="radial-progress"
              style={{
                background: `conic-gradient(#5dde9f 0 ${completionRate}%, #294f40 ${completionRate}%)`,
              }}
            >
              <span>{completionRate}</span>
            </div>
          </div>
          <div className="hero-progress">
            <i style={{ width: `${completionRate}%` }} />
          </div>
          <p>
            실제 DB {requests.length}건 중 {completedCount}건이 자원화
            완료되었습니다.
          </p>
        </div>
      </section>

      <section className="metric-row">
        <MiniMetric
          label="등록 물량"
          value={`${(totalWeightKg / 1000).toFixed(2)}t`}
          note={`${requests.length}건의 실제 요청`}
          accent="mint"
        />
        <MiniMetric
          label="운영 진행"
          value={`${activeCount}건`}
          note="등록·배차·수거·처리"
          accent="orange"
        />
        <MiniMetric
          label="바이오가스 원료"
          value={`${(biogasReadyKg / 1000).toFixed(2)}t`}
          note="수거 이후 확보 물량"
          accent="blue"
        />
        <MiniMetric
          label="부산 수거 기상"
          value={
            weatherLoading
              ? "확인 중"
              : weather
                ? `${Math.round(weather.temperatureC)}°`
                : "오류"
          }
          note={weather?.riskReason ?? "단기예보 기반 위험 판단"}
          accent="violet"
        />
      </section>

      <section className="control-modules">
        {modules.map((module) => (
          <button
            className="surface control-module"
            key={module.title}
            onClick={() => onNavigate(module.workspace)}
          >
            <span>{module.eyebrow}</span>
            <strong>{module.title}</strong>
            <p>{module.description}</p>
            <small>
              {module.state} <b>→</b>
            </small>
          </button>
        ))}
      </section>

      <section className="surface supply-chain-card">
        <div className="surface-heading">
          <div>
            <span className="section-kicker">ONE SUPPLY CHAIN</span>
            <h2>부산 수산 부산물 통합 공급망</h2>
          </div>
          <span className="weather-place">
            {weather?.location ?? "부산광역시"}
          </span>
        </div>
        <div className="pipeline">
          {pipelineStages.map(([no, label, count, detail], index) => (
            <div className="pipeline-stage" key={label}>
              <div className={`stage-ring stage-${index}`}>
                <span>{no}</span>
                <strong>{count}</strong>
              </div>
              <b>{label}</b>
              <small>{detail}</small>
              {index < pipelineStages.length - 1 && (
                <i className="stage-connector" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoDispatchPanel({ notify }: { notify: (message: string) => void }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <article className="surface dispatch-panel demo-dispatch-panel">
      <div className="surface-heading">
        <div>
          <span className="section-kicker">DEMO DISPATCH</span>
          <h2>기사·차량 배차 시연</h2>
        </div>
        <span className="demo-data-badge">시연 데이터</span>
      </div>
      <div className="dispatch-grid">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmed(true);
            notify("시연 배차가 김도윤 기사 화면에 전달되었습니다.");
          }}
        >
          <label>
            <span>접수 요청</span>
            <select defaultValue="DEMO-0731-001">
              <option>DEMO-0731-001 · 해원수산 · 420kg</option>
              <option>DEMO-0731-002 · 부산공동어시장 · 1,240kg</option>
            </select>
          </label>
          <label>
            <span>수거기사</span>
            <select defaultValue="김도윤">
              <option>김도윤 · 부산자원운송</option>
              <option>이현수 · 부산자원운송</option>
            </select>
          </label>
          <label>
            <span>차량</span>
            <select defaultValue="부산 82가 2481">
              <option>부산 82가 2481 · 2,500kg</option>
              <option>부산 83나 1104 · 1,000kg</option>
            </select>
          </label>
          <label>
            <span>방문 순서</span>
            <input type="number" value="1" readOnly />
          </label>
          <button className="primary-action">
            {confirmed ? "배차 전달 완료" : "배차 확정 시연"}
          </button>
        </form>
        <div className="demo-dispatch-summary">
          <strong>{confirmed ? "기사 화면 전달 완료" : "배차 준비 완료"}</strong>
          <span>김도윤 기사 · 부산 82가 2481</span>
          <small>다음 화면에서 수거기사로 전환해 운행 상태를 변경해 보세요.</small>
        </div>
      </div>
    </article>
  );
}

function AdminOperationsWorkspace({
  notify,
  requests,
  supabase,
  onChanged,
  demoMode,
}: {
  notify: (message: string) => void;
  requests: DbWasteRequest[];
  supabase: SupabaseClient;
  onChanged: () => Promise<void>;
  demoMode: boolean;
}) {
  const pendingCount = requests.filter(
    (request) => request.status === "requested",
  ).length;
  const movingCount = requests.filter((request) =>
    ["assigned", "collecting", "collected", "in_transit"].includes(
      request.status,
    ),
  ).length;
  const mapStops = useMemo(
    () =>
      optimizeRouteStops(
        requests.flatMap((request) => {
          if (
            request.latitude === null ||
            request.longitude === null ||
            ["processed", "completed"].includes(request.status)
          ) {
            return [];
          }

          return [
            {
              name: getOrganizationName(request.organizations),
              latitude: Number(request.latitude),
              longitude: Number(request.longitude),
            },
          ];
        }),
      ),
    [requests],
  );

  return (
    <div className="page-stack">
      <section className="workspace-title compact-title">
        <div>
          <span className="page-kicker">SIMPLE COLLECTION CONTROL</span>
          <h1>수거 운영</h1>
          <p>요청 선택 → 기사·차량 선택 → 배차 확정, 세 단계만 진행하세요.</p>
        </div>
        <div className="simple-counts">
          <span>
            배차 대기 <strong>{pendingCount}</strong>
          </span>
          <span>
            운행 중 <strong>{movingCount}</strong>
          </span>
        </div>
      </section>

      <section className="simple-steps" aria-label="배차 순서">
        {[
          ["1", "요청 선택", "접수된 부산물 확인"],
          ["2", "기사·차량 선택", "가용 자원 배정"],
          ["3", "배차 확정", "기사 화면에 즉시 전달"],
        ].map(([step, title, detail]) => (
          <div key={step}>
            <span>{step}</span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </section>

      {demoMode ? (
        <DemoDispatchPanel notify={notify} />
      ) : (
        <AdminDispatchPanel
          supabase={supabase}
          requests={requests}
          notify={notify}
          onChanged={onChanged}
        />
      )}

      <article className="surface route-map-card">
        <div className="surface-heading">
          <div>
            <span className="section-kicker">BUSAN COLLECTION MAP</span>
            <h2>수거 경로 지도</h2>
            <p>
              대기 중인 수거지를 방문 순서대로 연결하고 거리와 예상 시간을
              계산합니다.
            </p>
          </div>
          <span className="route-saving">Kakao 경로 연동</span>
        </div>
        <KakaoRouteMap
          supabase={supabase}
          stops={mapStops}
        />
      </article>

      <article className="surface compact-request-card">
        <div className="surface-heading">
          <div>
            <span className="section-kicker">RECENT REQUESTS</span>
            <h2>최근 요청</h2>
          </div>
          <span className="number-pill">{requests.length}</span>
        </div>
        <div className="compact-request-list">
          {requests.slice(0, 6).map((request) => (
            <div key={request.id}>
              <span>
                <strong>{request.request_number}</strong>
                <small>{getOrganizationName(request.organizations)}</small>
              </span>
              <span>{request.waste_type}</span>
              <b>{Number(request.estimated_weight_kg).toLocaleString()}kg</b>
              <StatusBadge
                status={requestStatusLabel[request.status] ?? request.status}
              />
            </div>
          ))}
          {requests.length === 0 && (
            <p className="request-empty">등록된 수거 요청이 없습니다.</p>
          )}
        </div>
      </article>

      <AdminInvitePanel supabase={supabase} notify={notify} />
    </div>
  );
}

function AiForecastWorkspace({
  requests,
  notify,
}: {
  requests: DbWasteRequest[];
  notify: (message: string) => void;
}) {
  const [forecastBaseDate] = useState(() => new Date());
  const registeredTons =
    requests.reduce(
      (sum, request) => sum + Number(request.estimated_weight_kg || 0),
      0,
    ) / 1000;
  const recentDailyTons = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(forecastBaseDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    return (
      requests
        .filter((request) => {
          const createdAt = new Date(request.created_at);
          return createdAt >= date && createdAt < nextDate;
        })
        .reduce(
          (sum, request) => sum + Number(request.estimated_weight_kg || 0),
          0,
        ) / 1000
    );
  });
  const daysWithData = recentDailyTons.filter((value) => value > 0);
  const averageDailyTons =
    daysWithData.length > 0
      ? daysWithData.reduce((sum, value) => sum + value, 0) /
        daysWithData.length
      : 0;
  const forecastFactors = [0.96, 1, 1.04, 0.98, 1.08, 1.12, 1.02];
  const byproductForecast = forecastFactors.map(
    (factor) => averageDailyTons * factor,
  );
  const maxForecast = Math.max(...byproductForecast, 0.1);
  const auctionEquivalent =
    byproductForecast[1] > 0 ? byproductForecast[1] / 0.16 : 0;
  const requiredVehicles =
    byproductForecast[1] > 0
      ? Math.ceil(byproductForecast[1] / 2.5)
      : 0;
  const logisticsTargets = [...requests]
    .filter((request) => request.status === "requested")
    .sort(
      (a, b) => Number(b.estimated_weight_kg) - Number(a.estimated_weight_kg),
    )
    .slice(0, 4);

  return (
    <div className="page-stack">
      <section className="workspace-title compact-title">
        <div>
          <span className="page-kicker">AI SUPPLY FORECAST</span>
          <h1>위판량·부산물·물류 예측</h1>
          <p>
            부산 공동어시장 위판 흐름과 실제 등록 데이터를 결합해 다음 수거
            물량을 계획합니다.
          </p>
        </div>
        <span className="model-chip">Supabase 운영 데이터 예측</span>
      </section>

      <section className="metric-row">
        <MiniMetric
          label="내일 부산물 발생 예측"
          value={`${byproductForecast[1].toFixed(2)}t`}
          note={
            daysWithData.length > 0
              ? `최근 ${daysWithData.length}일 등록량 기준`
              : "등록 데이터가 필요합니다"
          }
          accent="mint"
        />
        <MiniMetric
          label="위판량 환산 추정"
          value={`${auctionEquivalent.toFixed(1)}t`}
          note="부산물 비율 16% 가정"
          accent="orange"
        />
        <MiniMetric
          label="현재 등록 물량"
          value={`${registeredTons.toFixed(1)}t`}
          note="Supabase 실제 데이터"
          accent="blue"
        />
        <MiniMetric
          label="권장 차량"
          value={`${requiredVehicles}대`}
          note="2.5t 적재 기준"
          accent="violet"
        />
      </section>

      <section className="forecast-layout">
        <article className="surface forecast-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">7-DAY AUCTION FORECAST</span>
              <h2>부산물 발생량 7일 예측</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() =>
                notify(
                  "현재는 Supabase 등록 이력 기반입니다. 실제 위판량은 부산 위판 데이터 API 연결이 필요합니다.",
                )
              }
            >
              데이터 안내
            </button>
          </div>
          <div className="forecast-chart">
            {byproductForecast.map((value, index) => (
              <div key={`${value}-${index}`}>
                <strong>{value}</strong>
                <i style={{ height: `${(value / maxForecast) * 100}%` }} />
                <span>
                  {new Intl.DateTimeFormat("ko-KR", {
                    weekday: "short",
                  }).format(
                    new Date(
                      forecastBaseDate.getTime() + index * 86400000,
                    ),
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="surface ai-insight-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">BYPRODUCT ANALYSIS</span>
              <h2>부산물 발생 분석</h2>
            </div>
            <span className="weather-place">AI 권고</span>
          </div>
          <div className="insight-list">
            <div>
              <span>01</span>
              <p>
                <strong>새벽 위판 직후 집중 수거</strong>
                <small>공동어시장·자갈치권 06:00–09:00 권장</small>
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>고지방 어류 부산물 분리</strong>
                <small>혼합소화 시 메탄 수율 향상 원료로 우선 투입</small>
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>당일 반입 원칙</strong>
                <small>부패·악취 위험을 줄이도록 12시간 내 운송</small>
              </p>
            </div>
          </div>
        </article>

        <article className="surface logistics-priority">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">LOGISTICS OPTIMIZATION</span>
              <h2>AI 수거 우선순위</h2>
            </div>
            <span className="route-saving">Kakao 경로 연동</span>
          </div>
          <div className="priority-list">
            {logisticsTargets.map((request, index) => (
              <div key={request.id}>
                <span>{index + 1}</span>
                <p>
                  <strong>{getOrganizationName(request.organizations)}</strong>
                  <small>
                    {request.waste_type} · {request.request_number}
                  </small>
                </p>
                <b>{Number(request.estimated_weight_kg).toLocaleString()}kg</b>
              </div>
            ))}
            {logisticsTargets.length === 0 && (
              <p className="request-empty">배차 대기 요청이 없습니다.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function ResourceEnergyWorkspace({ requests }: { requests: DbWasteRequest[] }) {
  const feedstockTons =
    requests
      .filter((request) =>
        [
          "collected",
          "in_transit",
          "received",
          "processing",
          "completed",
        ].includes(request.status),
      )
      .reduce(
        (sum, request) => sum + Number(request.estimated_weight_kg || 0),
        0,
      ) / 1000;
  const biogasForecast = feedstockTons * 82;
  const powerForecast = biogasForecast * 0.62 * 2.05;

  return (
    <div className="page-stack">
      <section className="workspace-title compact-title">
        <div>
          <span className="page-kicker">BIOGAS & ESS CONTROL</span>
          <h1>자원화·에너지 운영</h1>
          <p>
            수거된 수산 부산물을 혼합소화 원료로 배합하고 바이오가스와 ESS 운영
            계획으로 연결합니다.
          </p>
        </div>
        <span className="model-chip green">운영 시뮬레이션</span>
      </section>

      <section className="metric-row">
        <MiniMetric
          label="확보 원료"
          value={`${feedstockTons.toFixed(2)}t`}
          note="수거 이후 실제 흐름"
          accent="mint"
        />
        <MiniMetric
          label="바이오가스 예측"
          value={`${biogasForecast.toFixed(0)}Nm³`}
          note="원료 특성 기반 추정"
          accent="orange"
        />
        <MiniMetric
          label="발전량 예측"
          value={`${powerForecast.toFixed(0)}kWh`}
          note="메탄 62% 가정"
          accent="blue"
        />
        <MiniMetric
          label="ESS 충전율"
          value="미연동"
          note="BMS 연결 후 실시간 표시"
          accent="violet"
        />
      </section>

      <section className="energy-layout">
        <article className="surface digestion-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">CO-DIGESTION CONTROL</span>
              <h2>AI 혼합소화 배합</h2>
            </div>
            <span className="weather-place">권장 운전값</span>
          </div>
          <div className="mix-ratio">
            {[
              ["수산 부산물", 35, "고지방·고단백"],
              ["음식물류", 45, "탄소원 보완"],
              ["하수 슬러지", 20, "미생물 안정화"],
            ].map(([label, ratio, detail]) => (
              <div key={String(label)}>
                <span>
                  <strong>{label}</strong>
                  <b>{ratio}%</b>
                </span>
                <i>
                  <em style={{ width: `${ratio}%` }} />
                </i>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <div className="control-values">
            <span>
              목표 pH <strong>7.2</strong>
            </span>
            <span>
              유기물 부하 <strong>2.8 kgVS/m³·d</strong>
            </span>
            <span>
              체류시간 <strong>24일</strong>
            </span>
          </div>
        </article>

        <article className="surface ess-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">ESS OPERATION</span>
              <h2>ESS 충·방전 계획</h2>
            </div>
            <span className="weather-place">BMS 미연동</span>
          </div>
          <div className="battery-visual">
            <div>
              <i style={{ height: "0%" }} />
              <span>–</span>
            </div>
            <p>
               <strong>실시간 상태 없음</strong>
               <small>ESS BMS API 연결 후 SOC와 운전 상태를 표시합니다.</small>
            </p>
          </div>
          <div className="ess-schedule">
            <span>
              02–05시 <b>충전</b>
            </span>
            <span>
              14–17시 <b>피크 절감</b>
            </span>
            <span>
              비상 시 <b>시설 백업</b>
            </span>
          </div>
        </article>

        <article className="surface energy-flow-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">RESOURCE TO ENERGY</span>
              <h2>부산 자원순환 에너지 흐름</h2>
            </div>
          </div>
          <div className="energy-flow">
            {[
              ["수산 부산물", `${feedstockTons.toFixed(2)}t`],
              ["혼합소화", "AI 배합"],
              ["바이오가스", `${biogasForecast.toFixed(0)}Nm³`],
              ["열병합 발전", `${powerForecast.toFixed(0)}kWh`],
              ["ESS", "저장·피크 대응"],
            ].map(([label, value], index) => (
              <div key={label}>
                <span>{index + 1}</span>
                <strong>{label}</strong>
                <small>{value}</small>
                {index < 4 && <b>→</b>}
              </div>
            ))}
          </div>
          <p className="integration-note">
            혼합소화 설비 PLC와 ESS BMS API가 연결되면 권고값을 실제 제어값과
            실시간 상태로 전환할 수 있습니다.
          </p>
        </article>
      </section>
    </div>
  );
}

function DischargerWorkspace({
  notify,
  supabase,
  profile,
  requests,
  demoMode,
  onCreated,
}: {
  notify: (message: string) => void;
  supabase: SupabaseClient;
  profile: Profile;
  requests: DbWasteRequest[];
  demoMode: boolean;
  onCreated: () => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [photoName, setPhotoName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [analysis, setAnalysis] = useState<WasteAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pickupAddress, setPickupAddress] =
    useState("부산광역시 영도구 해양로 24");
  const [pickupCoordinate, setPickupCoordinate] = useState<Coordinate | null>(
    null,
  );
  const [addressSearching, setAddressSearching] = useState(false);
  const [registered, setRegistered] = useState("");
  const [saving, setSaving] = useState(false);
  const [defaultPickupAt] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 2, 0, 0, 0);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  });
  const draftKey = `bsori-request-draft-${profile.id}`;
  const recentRequests = requests
    .filter(
      (request) =>
        profile.role !== "admin" ||
        getOrganizationName(request.organizations) === "해원수산",
    )
    .slice(0, 3);

  const saveDraft = () => {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        wasteType: String(form.get("wasteType") ?? ""),
        estimatedWeight: String(form.get("estimatedWeight") ?? ""),
        storageCondition: String(form.get("storageCondition") ?? ""),
        preferredPickupAt: String(form.get("preferredPickupAt") ?? ""),
        pickupAddress,
        memo: String(form.get("memo") ?? ""),
      }),
    );
    notify("작성 중인 내용을 이 기기에 임시 저장했습니다.");
  };

  const loadDraft = () => {
    if (!formRef.current) return;
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) {
      notify("저장된 임시 내용이 없습니다.");
      return;
    }
    try {
      const draft = JSON.parse(raw) as Record<string, string>;
      const fields = formRef.current.elements;
      ["wasteType", "estimatedWeight", "storageCondition", "preferredPickupAt", "memo"].forEach(
        (name) => {
          const field = fields.namedItem(name) as
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement
            | null;
          if (field && typeof draft[name] === "string") {
            field.value = draft[name];
          }
        },
      );
      setPickupAddress(draft.pickupAddress || pickupAddress);
      setPickupCoordinate(null);
      notify("임시 저장 내용을 불러왔습니다.");
    } catch {
      window.localStorage.removeItem(draftKey);
      notify("임시 저장 내용이 손상되어 초기화했습니다.");
    }
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        notify("사진은 최대 10MB까지 업로드할 수 있습니다.");
        event.target.value = "";
        return;
      }
      setPhoto(file);
      setPhotoName(file.name);
      setAnalyzed(false);
      setAnalysis(null);
    }
  };

  const analyzePhoto = async () => {
    if (!photo) return;

    setAnalyzing(true);
    setAnalyzed(false);

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? "");
          resolve(result.slice(result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
        reader.readAsDataURL(photo);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("로그인 세션을 확인하지 못했습니다.");
      }

      const response = await fetch("/api/analyze-waste", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: photo.type || "image/jpeg",
        }),
      });
      const payload = (await response.json()) as {
        analysis?: WasteAnalysis;
        error?: string;
      };

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error ?? "AI 분석에 실패했습니다.");
      }

      setAnalysis(payload.analysis);
      setAnalyzed(true);
      notify("Gemini 사진 분석이 완료되었습니다.");
    } catch (caught) {
      setAnalysis(null);
      notify(
        caught instanceof Error
          ? caught.message
          : "사진 분석 중 오류가 발생했습니다.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const searchAddress = async () => {
    if (!pickupAddress.trim()) {
      notify("검색할 주소를 입력해 주세요.");
      return;
    }

    setAddressSearching(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("로그인 세션을 확인하지 못했습니다.");
      }

      const response = await fetch(
        `/api/kakao/geocode?query=${encodeURIComponent(pickupAddress)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const payload = (await response.json()) as {
        result?: {
          address: string;
          longitude: number;
          latitude: number;
        };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "주소 검색에 실패했습니다.");
      }

      setPickupAddress(payload.result.address);
      setPickupCoordinate({
        longitude: payload.result.longitude,
        latitude: payload.result.latitude,
      });
      notify("카카오 주소 검색으로 위치를 확인했습니다.");
    } catch (caught) {
      notify(
        caught instanceof Error
          ? caught.message
          : "주소 검색 중 오류가 발생했습니다.",
      );
    } finally {
      setAddressSearching(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setRegistered("");

    const form = new FormData(event.currentTarget);
    const wasteType = String(form.get("wasteType") ?? "");
    const estimatedWeightKg = Number(form.get("estimatedWeight"));
    const preferredPickupAt =
      String(form.get("preferredPickupAt") ?? "") || null;
    const pickupAddressValue = String(form.get("pickupAddress") ?? "");
    let photoPath: string | null = null;

    if (demoMode) {
      const demoNumber = `DEMO-${String(Date.now()).slice(-6)}`;
      setRegistered(demoNumber);
      setSaving(false);
      notify(
        `시연 요청 ${demoNumber}가 등록되었습니다. 실제 DB에는 저장되지 않습니다.`,
      );
      return;
    }

    try {
      let requestOrganizationId = profile.organization_id;
      if (profile.role === "admin") {
        const { data: dischargerOrganization, error: organizationError } =
          await supabase
            .from("organizations")
            .select("id")
            .eq("name", "해원수산")
            .eq("organization_type", "discharger")
            .single();
        if (organizationError) throw organizationError;
        requestOrganizationId = dischargerOrganization.id;
      }

      if (photo) {
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        photoPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("waste-photos")
          .upload(photoPath, photo, {
            contentType: photo.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");
      const requestNumber = `REQ-${datePart}-${crypto
        .randomUUID()
        .slice(0, 6)
        .toUpperCase()}`;

      const { error: insertError } = await supabase
        .from("waste_requests")
        .insert({
          request_number: requestNumber,
          organization_id: requestOrganizationId,
          created_by: profile.id,
          waste_type: wasteType,
          estimated_weight_kg: estimatedWeightKg,
          storage_condition: String(form.get("storageCondition") ?? ""),
          preferred_pickup_at: preferredPickupAt,
          pickup_address: pickupAddressValue,
          latitude: pickupCoordinate?.latitude ?? null,
          longitude: pickupCoordinate?.longitude ?? null,
          memo: String(form.get("memo") ?? ""),
          photo_path: photoPath,
          ai_result: analysis,
          ai_verified: false,
          status: "requested",
        });

      if (insertError) throw insertError;

      let emailSent = false;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const emailResponse = await fetch(
            "/api/notifications/request-created",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                requestNumber,
                organizationName:
                  profile.role === "admin"
                    ? "해원수산"
                    : getOrganizationName(profile.organizations),
                wasteType,
                estimatedWeightKg,
                pickupAddress: pickupAddressValue,
                preferredPickupAt,
              }),
            },
          );
          emailSent = emailResponse.ok;
        }
      } catch {
        emailSent = false;
      }

      setRegistered(requestNumber);
      window.localStorage.removeItem(draftKey);
      notify(
        emailSent
          ? `수거 요청 ${requestNumber} 저장 및 이메일 알림이 완료되었습니다.`
          : `수거 요청 ${requestNumber}가 DB에 저장되었습니다. 이메일 알림은 확인이 필요합니다.`,
      );
      await onCreated();
    } catch (caught) {
      if (photoPath) {
        await supabase.storage.from("waste-photos").remove([photoPath]);
      }
      notify(
        caught instanceof Error
          ? caught.message
          : "수거 요청 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="workspace-title">
        <div>
          <span className="page-kicker">DISCHARGER WORKSPACE</span>
          <h1>부산물 등록</h1>
          <p>부산물 정보와 사진을 등록하면 AI가 종류와 상태를 분석합니다.</p>
        </div>
        <div className="role-chip">
          <span className="role-avatar company">해</span>
          <div>
            <strong>
              {profile.role === "admin"
                ? "해원수산"
                : getOrganizationName(profile.organizations)}
            </strong>
            <small>
              {profile.full_name} ·{" "}
              {profile.role === "admin"
                ? "관리자 대행 등록"
                : "배출업체 담당자"}
            </small>
          </div>
        </div>
      </section>

      <section className="form-layout">
        <form
          ref={formRef}
          className="surface registration-form"
          onSubmit={submit}
        >
          <div className="surface-heading">
            <div>
              <span className="section-kicker">NEW REQUEST</span>
              <h2>새 수거 요청</h2>
            </div>
            <span className="step-label">필수 항목 *</span>
          </div>
          <div className="form-grid">
            <label>
              <span>부산물 종류 *</span>
              <select name="wasteType" defaultValue="생선 내장">
                <option>생선 내장</option>
                <option>어류 뼈·머리</option>
                <option>갑각류 껍질</option>
                <option>혼합 부산물</option>
              </select>
            </label>
            <label>
              <span>예상 수량 *</span>
              <div className="input-unit">
                <input
                  name="estimatedWeight"
                  type="number"
                  defaultValue="420"
                  min="1"
                  required
                />
                <b>kg</b>
              </div>
            </label>
            <label>
              <span>보관 상태</span>
              <select name="storageCondition" defaultValue="냉장">
                <option>냉장</option>
                <option>냉동</option>
                <option>상온</option>
              </select>
            </label>
            <label>
              <span>수거 희망 시간</span>
              <input
                name="preferredPickupAt"
                type="datetime-local"
                  defaultValue={defaultPickupAt}
              />
            </label>
            <label className="full">
              <span>수거 주소 *</span>
              <div className="address-input">
                <input
                  name="pickupAddress"
                  value={pickupAddress}
                  onChange={(event) => {
                    setPickupAddress(event.target.value);
                    setPickupCoordinate(null);
                  }}
                  required
                />
                <button
                  type="button"
                  disabled={addressSearching}
                  onClick={searchAddress}
                >
                  {addressSearching ? "검색 중..." : "주소 검색"}
                </button>
              </div>
            </label>
            <label className="full">
              <span>현장 메모</span>
              <textarea
                name="memo"
                defaultValue="3번 냉장창고 앞 파란색 수거함입니다."
              />
            </label>
          </div>

          <div className="upload-zone">
            <input
              id="waste-photo"
              type="file"
              accept="image/*"
              onChange={handlePhoto}
            />
            <label htmlFor="waste-photo">
              <span className="upload-icon">＋</span>
              <strong>{photoName || "부산물 사진을 올려주세요"}</strong>
              <small>
                {photoName
                  ? "다른 사진으로 교체하려면 클릭하세요."
                  : "JPG, PNG · 최대 10MB · 모바일 카메라 촬영 가능"}
              </small>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={loadDraft}
            >
              임시 내용 불러오기
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={saveDraft}
            >
              임시 저장
            </button>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving
                ? "DB 저장 중..."
                : registered
                  ? `${registered} 등록 완료`
                  : demoMode
                    ? "수거 요청 등록 시연"
                    : "수거 요청 등록"}
            </button>
          </div>
        </form>

        <aside className="form-side">
          <article className={`surface ai-card ${analyzed ? "analyzed" : ""}`}>
            <div className="ai-card-head">
              <span className="ai-mark">✦</span>
              <div>
                <span>GEMINI VISION</span>
                <strong>AI 사진 분석</strong>
              </div>
            </div>
            {!analyzed ? (
              <div className="ai-empty">
                <div className="scan-frame">
                  <span />
                  <span />
                  <span />
                  <span />
                  <b>AI</b>
                </div>
                <p>
                  {photoName
                    ? "사진이 준비되었습니다. 분석을 시작해 주세요."
                    : "사진을 등록하면 부산물 종류와 상태를 자동으로 추정합니다."}
                </p>
                <button
                  disabled={!photoName || analyzing}
                  onClick={analyzePhoto}
                >
                  {analyzing ? "Gemini 분석 중..." : "사진 분석 시작"}
                </button>
              </div>
            ) : analysis ? (
              <div className="analysis-result">
                <span className="confidence-label">
                  분석 신뢰도 <b>{analysis.confidence.toFixed(1)}%</b>
                </span>
                <h3>{analysis.wasteType}</h3>
                <div className="analysis-grid">
                  <span>
                    추정 상태 <b>{analysis.condition}</b>
                  </span>
                  <span>
                    이물질 <b>{analysis.foreignMaterial}</b>
                  </span>
                  <span>
                    추정 중량{" "}
                    <b>
                      {analysis.estimatedWeightKgMin}~
                      {analysis.estimatedWeightKgMax}kg
                    </b>
                  </span>
                  <span>
                    권장 수거 <b>{analysis.recommendedPickupHours}시간 이내</b>
                  </span>
                </div>
                <div className="analysis-note">
                  <b>검증 필요</b>
                  <p>{analysis.summary}</p>
                  {analysis.warnings.length > 0 && (
                    <small>{analysis.warnings.join(" · ")}</small>
                  )}
                </div>
              </div>
            ) : null}
          </article>
          <article className="surface recent-card">
            <div className="surface-heading">
              <div>
                <span className="section-kicker">MY REQUESTS</span>
                <h2>최근 요청</h2>
              </div>
            </div>
            {recentRequests.map((request) => (
              <div className="recent-row" key={request.id}>
                <span>
                  <strong>{request.request_number}</strong>
                  <small>
                    {request.waste_type} ·{" "}
                    {Number(request.estimated_weight_kg).toLocaleString()}kg
                  </small>
                </span>
                <StatusBadge
                  status={
                    requestStatusLabel[request.status] ?? request.status
                  }
                />
              </div>
            ))}
            {recentRequests.length === 0 && (
              <p className="request-empty">등록된 수거 요청이 없습니다.</p>
            )}
          </article>
        </aside>
      </section>
    </div>
  );
}

const resourceFacility = {
  name: "B.SORI 자원화센터",
  longitude: 129.0445,
  latitude: 35.0878,
};

function optimizeRouteStops(stops: Array<Coordinate & { name: string }>) {
  const remaining = [...stops];
  const optimized: Array<Coordinate & { name: string }> = [];
  let current: Coordinate = resourceFacility;

  while (remaining.length > 0) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const latitudeDistance = stop.latitude - current.latitude;
      const longitudeDistance = stop.longitude - current.longitude;
      const distance =
        latitudeDistance * latitudeDistance +
        longitudeDistance * longitudeDistance;
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    const [next] = remaining.splice(closestIndex, 1);
    optimized.push(next);
    current = next;
  }

  return optimized;
}

function KakaoRouteMap({
  supabase,
  stops = [],
}: {
  supabase: SupabaseClient;
  stops?: Array<Coordinate & { name: string }>;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [originAddress, setOriginAddress] = useState("B.SORI 자원화센터");
  const [destinationAddress, setDestinationAddress] = useState(
    "B.SORI 자원화센터",
  );
  const [routePlan, setRoutePlan] = useState<{
    origin: Coordinate & { name: string };
    destination: Coordinate & { name: string };
  }>({
    origin: resourceFacility,
    destination: resourceFacility,
  });
  const [routePlanning, setRoutePlanning] = useState(false);
  const [route, setRoute] = useState<{
    distanceMeters: number;
    durationSeconds: number;
    path: Coordinate[];
  } | null>(null);
  const [mapError, setMapError] = useState("");

  const geocodeRouteAddress = async (
    address: string,
    accessToken: string,
  ): Promise<Coordinate & { name: string }> => {
    const response = await fetch(
      `/api/kakao/geocode?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const payload = (await response.json()) as {
      result?: { address: string; longitude: number; latitude: number };
      error?: string;
    };
    if (!response.ok || !payload.result) {
      throw new Error(payload.error ?? "주소를 찾지 못했습니다.");
    }
    return {
      name: payload.result.address,
      longitude: payload.result.longitude,
      latitude: payload.result.latitude,
    };
  };

  const calculateCustomRoute = async () => {
    if (!originAddress.trim() || !destinationAddress.trim()) {
      setMapError("출발지와 도착지를 모두 입력해 주세요.");
      return;
    }

    setRoutePlanning(true);
    setMapError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("로그인 세션을 확인하지 못했습니다.");
      }

      const origin =
        originAddress.trim() === "B.SORI 자원화센터"
          ? resourceFacility
          : await geocodeRouteAddress(
              originAddress.trim(),
              session.access_token,
            );
      const destination =
        destinationAddress.trim() === "B.SORI 자원화센터"
          ? resourceFacility
          : await geocodeRouteAddress(
              destinationAddress.trim(),
              session.access_token,
            );

      setOriginAddress(origin.name);
      setDestinationAddress(destination.name);
      setRoutePlan({ origin, destination });
    } catch (caught) {
      setMapError(
        caught instanceof Error
          ? caught.message
          : "주소 검색 중 오류가 발생했습니다.",
      );
    } finally {
      setRoutePlanning(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        if (stops.length === 0) {
          throw new Error("배차된 수거지가 없습니다.");
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("로그인 세션을 확인하지 못했습니다.");
        }

        const response = await fetch("/api/kakao/directions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            origin: routePlan.origin,
            destination: routePlan.destination,
            waypoints: stops,
          }),
        });
        const payload = (await response.json()) as {
          route?: {
            distanceMeters: number;
            durationSeconds: number;
            path: Coordinate[];
          };
          error?: string;
        };
        if (!response.ok || !payload.route) {
          throw new Error(payload.error ?? "수거 경로를 계산하지 못했습니다.");
        }

        const maps = await loadKakaoMaps();
        if (cancelled || !mapContainer.current) return;

        const center = new maps.LatLng(
          routePlan.origin.latitude,
          routePlan.origin.longitude,
        );
        const map = new maps.Map(mapContainer.current, {
          center,
          level: 7,
        });
        const bounds = new maps.LatLngBounds();

        [routePlan.origin, ...stops, routePlan.destination].forEach((stop) => {
          const position = new maps.LatLng(stop.latitude, stop.longitude);
          bounds.extend(position);
          new maps.Marker({
            map,
            position,
            title: stop.name,
          });
        });

        if (payload.route.path.length > 0) {
          new maps.Polyline({
            map,
            path: payload.route.path.map(
              (point) => new maps.LatLng(point.latitude, point.longitude),
            ),
            strokeWeight: 5,
            strokeColor: "#16845a",
            strokeOpacity: 0.9,
            strokeStyle: "solid",
          });
        }

        map.setBounds(bounds, 44);
        setRoute(payload.route);
        setMapError("");
      } catch (caught) {
        if (cancelled) return;
        setMapError(
          caught instanceof Error
            ? caught.message
            : "카카오 지도를 불러오지 못했습니다.",
        );
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [routePlan, stops, supabase]);

  const durationMinutes = route
    ? Math.max(1, Math.round(route.durationSeconds / 60))
    : null;

  return (
    <>
      <div className="route-planner">
        <label>
          <span>출발지</span>
          <input
            value={originAddress}
            onChange={(event) => setOriginAddress(event.target.value)}
            placeholder="출발 주소를 입력하세요"
          />
        </label>
        <span className="route-planner-arrow" aria-hidden="true">
          →
        </span>
        <label>
          <span>도착지</span>
          <input
            value={destinationAddress}
            onChange={(event) => setDestinationAddress(event.target.value)}
            placeholder="도착 주소를 입력하세요"
          />
        </label>
        <button
          type="button"
          onClick={calculateCustomRoute}
          disabled={routePlanning}
        >
          {routePlanning ? "주소 확인 중..." : "경로 계산"}
        </button>
      </div>
      <div className="route-map kakao-route-map" ref={mapContainer}>
        {!route && (
          <div className="map-api-state">
            <span>{mapError ? "!" : "K"}</span>
            <strong>
              {mapError ? "카카오맵 사용 설정 필요" : "수거 경로 계산 중"}
            </strong>
            <small>
              {mapError ||
                `부산 수거지 ${stops.length}곳의 실제 이동 경로를 불러오고 있습니다.`}
            </small>
          </div>
        )}
      </div>
      <div className="route-summary">
        <span>
          총 거리{" "}
          <b>
            {route
              ? `${(route.distanceMeters / 1000).toFixed(1)}km`
              : "확인 중"}
          </b>
        </span>
        <span>
          예상 시간{" "}
          <b>
            {durationMinutes
              ? `${Math.floor(durationMinutes / 60)}시간 ${durationMinutes % 60}분`
              : "확인 중"}
          </b>
        </span>
        <span>
          방문 지점 <b>{stops.length}곳</b>
        </span>
      </div>
    </>
  );
}

function DriverWorkspace({
  notify,
  supabase,
  weather,
  weatherLoading,
}: {
  notify: (message: string) => void;
  supabase: SupabaseClient;
  weather: WeatherForecast | null;
  weatherLoading: boolean;
}) {
  const [tasks, setTasks] = useState<
    {
      id: string;
      order: number;
      company: string;
      address: string;
      amount: string;
      eta: string;
      status: DriverTaskStatus;
    }[]
  >([
    {
      id: "REQ-0729-018",
      order: 1,
      company: "부산공동어시장",
      address: "서구 충무대로 202",
      amount: "1,240kg",
      eta: "14:45",
      status: "이동 중",
    },
    {
      id: "REQ-0729-016",
      order: 2,
      company: "남항수산가공",
      address: "영도구 남항서로 85",
      amount: "540kg",
      eta: "15:25",
      status: "대기",
    },
    {
      id: "REQ-0730-003",
      order: 3,
      company: "해원수산",
      address: "영도구 해양로 24",
      amount: "420kg",
      eta: "16:10",
      status: "대기",
    },
  ]);

  const advanceTask = (id: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const next: Record<DriverTaskStatus, DriverTaskStatus> = {
          대기: "이동 중",
          "이동 중": "도착",
          도착: "수거 완료",
          "수거 완료": "수거 완료",
        };
        notify(
          `${task.company} 상태를 '${next[task.status]}'으로 변경했습니다.`,
        );
        return { ...task, status: next[task.status] };
      }),
    );
  };

  return (
    <div className="driver-shell">
      <section className="driver-top">
        <div>
          <span className="page-kicker">DRIVER MOBILE · DEMO</span>
          <h1>안전 운행하세요, 김도윤 기사님.</h1>
          <p>오늘 3개 지점 · 총 예상 수거량 2.2톤</p>
        </div>
        <div className="driver-weather">
          <span>{weather?.symbol ?? "…"}</span>
          <div>
            <strong>
              {weatherLoading
                ? "부산 예보 확인 중"
                : weather
                  ? `${Math.round(weather.temperatureC)}° · ${weather.weather}`
                  : "기상 정보 조회 실패"}
            </strong>
            <small>
              {weather
                ? `강수 ${weather.precipitationProbability}% · 위험도 ${weather.riskLevel}`
                : "연결 상태를 확인해 주세요."}
            </small>
          </div>
        </div>
      </section>

      <section className="driver-grid">
        <article className="surface route-map-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">OPTIMIZED ROUTE</span>
              <h2>오늘의 수거 경로</h2>
            </div>
            <span className="route-saving">18분 단축</span>
          </div>
          <KakaoRouteMap supabase={supabase} stops={demoRouteStops} />
        </article>

        <article className="task-stack">
          <div className="task-heading">
            <div>
              <span className="section-kicker">PICKUP LIST</span>
              <h2>수거 일정</h2>
            </div>
            <span>3개 지점</span>
          </div>
          {tasks.map((task) => (
            <article
              className={`surface driver-task ${task.status === "이동 중" ? "active" : ""}`}
              key={task.id}
            >
              <div className="task-order">{task.order}</div>
              <div className="task-copy">
                <div>
                  <strong>{task.company}</strong>
                  <StatusBadge status={task.status} />
                </div>
                <p>{task.address}</p>
                <span>
                  예상 {task.amount} · 도착 {task.eta}
                </span>
              </div>
              <button
                disabled={task.status === "수거 완료"}
                onClick={() => advanceTask(task.id)}
              >
                {task.status === "대기" && "운행 시작"}
                {task.status === "이동 중" && "도착 처리"}
                {task.status === "도착" && "수거 완료"}
                {task.status === "수거 완료" && "완료"}
              </button>
            </article>
          ))}
          <div className="pwa-note">
            <span>앱</span>
            <div>
              <strong>홈 화면에 B.SORI를 추가하세요</strong>
              <small>
                네트워크가 불안정해도 오늘의 수거 목록을 확인할 수 있습니다.
              </small>
            </div>
            <button
              onClick={() =>
                notify("브라우저의 '홈 화면에 추가' 메뉴를 이용해 주세요.")
              }
            >
              설치 안내
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}

function FacilityWorkspace({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState(0);
  const [processed, setProcessed] = useState(false);
  const inbound = [
    {
      time: "14:50",
      company: "해원수산",
      vehicle: "부산 82가 2481",
      type: "생선 내장",
      expected: "420kg",
    },
    {
      time: "15:20",
      company: "남항수산가공",
      vehicle: "부산 83나 1104",
      type: "혼합 부산물",
      expected: "540kg",
    },
    {
      time: "16:05",
      company: "부산공동어시장",
      vehicle: "부산 81다 7702",
      type: "어류 뼈·머리",
      expected: "1,240kg",
    },
  ];
  const current = inbound[selected];

  const complete = () => {
    setProcessed(true);
    notify(`${current.company} 반입 검수 결과를 저장했습니다.`);
  };

  return (
    <div className="page-stack">
      <section className="workspace-title">
        <div>
          <span className="page-kicker">RESOURCE FACILITY · DEMO</span>
          <h1>반입·검수·처리</h1>
          <p>차량 도착부터 계량, 검수, 자원화 처리 결과까지 기록합니다.</p>
        </div>
        <div className="facility-live">
          <i />
          <div>
            <strong>시설 정상 운영</strong>
            <small>금일 누적 반입 6.42t</small>
          </div>
        </div>
      </section>

      <section className="facility-grid">
        <article className="surface inbound-list">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">EXPECTED INBOUND</span>
              <h2>입고 예정</h2>
            </div>
            <span className="number-pill">3</span>
          </div>
          {inbound.map((item, index) => (
            <button
              className={selected === index ? "selected" : ""}
              key={item.company}
              onClick={() => {
                setSelected(index);
                setProcessed(false);
              }}
            >
              <time>{item.time}</time>
              <div>
                <strong>{item.company}</strong>
                <span>
                  {item.type} · {item.expected}
                </span>
                <small>{item.vehicle}</small>
              </div>
              <b>›</b>
            </button>
          ))}
        </article>

        <form
          className="surface inspection-card"
          onSubmit={(event) => {
            event.preventDefault();
            complete();
          }}
        >
          <div className="surface-heading">
            <div>
              <span className="section-kicker">INSPECTION</span>
              <h2>반입 검수서</h2>
            </div>
            <StatusBadge status={processed ? "반입 완료" : "대기"} />
          </div>
          <div className="inspection-summary">
            <span className="truck-mark">차</span>
            <div>
              <strong>{current.company}</strong>
              <span>
                {current.vehicle} · {current.type}
              </span>
            </div>
            <b>예상 {current.expected}</b>
          </div>
          <div className="weight-card">
            <span>실계량 중량</span>
            <div>
              <input
                type="number"
                defaultValue={current.expected.replace(/[^0-9]/g, "")}
              />
              <b>kg</b>
            </div>
            <small>계근대 연동 전 수동 입력 모드입니다.</small>
          </div>
          <div className="inspection-form">
            <label>
              <span>품질 상태</span>
              <select defaultValue="양호">
                <option>양호</option>
                <option>주의</option>
                <option>반입 불가</option>
              </select>
            </label>
            <label>
              <span>이물질 여부</span>
              <select defaultValue="없음">
                <option>없음</option>
                <option>소량 검출</option>
                <option>다량 검출</option>
              </select>
            </label>
            <label>
              <span>처리 방식</span>
              <select defaultValue="혐기성 소화">
                <option>혐기성 소화</option>
                <option>사료화</option>
                <option>퇴비화</option>
              </select>
            </label>
            <label>
              <span>처리 라인</span>
              <select defaultValue="A-01">
                <option>A-01</option>
                <option>A-02</option>
                <option>B-01</option>
              </select>
            </label>
            <label className="full">
              <span>검수 메모</span>
              <textarea defaultValue="육안 검사 결과 특이사항 없음" />
            </label>
          </div>
          <div className="proof-upload">
            <input id="scale-photo" type="file" accept="image/*" />
            <label htmlFor="scale-photo">
              <span>＋</span>
              <div>
                <strong>계량·증빙 사진 첨부</strong>
                <small>클릭하여 사진을 선택하세요.</small>
              </div>
            </label>
          </div>
          <button className="primary-action full-action" type="submit">
            {processed ? "저장 완료" : "검수 완료 및 반입 처리"}
          </button>
        </form>

        <article className="surface daily-throughput">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">DAILY THROUGHPUT</span>
              <h2>오늘의 처리량</h2>
            </div>
          </div>
          <div className="throughput-number">
            <strong>6.42</strong>
            <span>ton</span>
            <small>목표 7.0t</small>
          </div>
          <div className="throughput-bar">
            <i />
          </div>
          <div className="throughput-types">
            <span>
              <i className="type-one" />
              생선 내장 <b>3.12t</b>
            </span>
            <span>
              <i className="type-two" />
              뼈·머리 <b>2.04t</b>
            </span>
            <span>
              <i className="type-three" />
              기타 <b>1.26t</b>
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}

function LiveDriverWorkspace({
  notify,
  supabase,
  profile,
  weather,
  weatherLoading,
}: {
  notify: (message: string) => void;
  supabase: SupabaseClient;
  profile: Profile;
  weather: WeatherForecast | null;
  weatherLoading: boolean;
}) {
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, File | null>>({});

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from("collection_assignments")
      .select(
        "id, route_order, assigned_at, started_at, arrived_at, collected_at, actual_weight_kg, vehicles(plate_number), waste_requests(id, request_number, waste_type, estimated_weight_kg, pickup_address, latitude, longitude, status, organizations(name))",
      )
      .order("route_order", { ascending: true });

    if (error) {
      notify(error.message);
      setLoading(false);
      return;
    }
    setAssignments((data ?? []) as unknown as DriverAssignment[]);
    setLoading(false);
  }, [notify, supabase]);

  useEffect(() => {
    queueMicrotask(() => void loadAssignments());
    const channel = supabase
      .channel(`driver-workflow-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_assignments" },
        () => void loadAssignments(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_requests" },
        () => void loadAssignments(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAssignments, profile.id, supabase]);

  const getTaskStatus = (assignment: DriverAssignment): DriverTaskStatus => {
    const request = firstRelation(assignment.waste_requests);
    if (
      !request ||
      [
        "collected",
        "in_transit",
        "received",
        "processing",
        "completed",
      ].includes(request.status)
    ) {
      return "수거 완료";
    }
    if (request.status === "collecting" && assignment.arrived_at) return "도착";
    if (request.status === "collecting") return "이동 중";
    return "대기";
  };

  const taskStops = useMemo(
    () =>
      assignments.flatMap((assignment) => {
        const request = firstRelation(assignment.waste_requests);
        if (
          !request ||
          request.latitude === null ||
          request.longitude === null ||
          getTaskStatus(assignment) === "수거 완료"
        ) {
          return [];
        }
        return [
          {
            name: getOrganizationName(request.organizations),
            latitude: Number(request.latitude),
            longitude: Number(request.longitude),
          },
        ];
      }),
    [assignments],
  );

  const activeAssignments = assignments.filter(
    (assignment) => getTaskStatus(assignment) !== "수거 완료",
  );
  const expectedWeight = activeAssignments.reduce((sum, assignment) => {
    const request = firstRelation(assignment.waste_requests);
    return sum + Number(request?.estimated_weight_kg ?? 0);
  }, 0);

  const advanceTask = async (assignment: DriverAssignment) => {
    const status = getTaskStatus(assignment);
    const request = firstRelation(assignment.waste_requests);
    if (!request || status === "수거 완료") return;
    setBusyId(assignment.id);
    let photoPath: string | null = null;

    try {
      if (status === "도착" && photos[assignment.id]) {
        const photo = photos[assignment.id]!;
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        photoPath = `${profile.id}/collection-${assignment.id}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(photoPath, photo, {
            contentType: photo.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.rpc("advance_collection_assignment", {
        p_assignment_id: assignment.id,
        p_actual_weight_kg:
          status === "도착" ? Number(weights[assignment.id]) : null,
        p_collection_photo_path: photoPath,
        p_driver_note: null,
      });
      if (error) throw error;

      await loadAssignments();
      notify(
        status === "대기"
          ? `${getOrganizationName(request.organizations)} 수거 운행을 시작했습니다.`
          : status === "이동 중"
            ? "수거지 도착 시간을 저장했습니다."
            : "실제 중량과 수거 결과를 저장했습니다.",
      );
    } catch (caught) {
      if (photoPath) {
        await supabase.storage.from("evidence").remove([photoPath]);
      }
      notify(
        caught instanceof Error
          ? caught.message
          : "수거 상태를 저장하지 못했습니다.",
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="driver-shell">
      <section className="driver-top">
        <div>
          <span className="page-kicker">DRIVER MOBILE · LIVE DB</span>
          <h1>안전 운행하세요, {profile.full_name} 기사님.</h1>
          <p>
            오늘 {activeAssignments.length}개 지점 · 예상 수거량{" "}
            {(expectedWeight / 1000).toFixed(2)}톤
          </p>
        </div>
        <div className="driver-weather">
          <span>{weather?.symbol ?? "…"}</span>
          <div>
            <strong>
              {weatherLoading
                ? "부산 예보 확인 중"
                : weather
                  ? `${Math.round(weather.temperatureC)}° · ${weather.weather}`
                  : "기상 정보 조회 실패"}
            </strong>
            <small>
              {weather
                ? `강수 ${weather.precipitationProbability}% · 위험도 ${weather.riskLevel}`
                : "연결 상태를 확인해 주세요."}
            </small>
          </div>
        </div>
      </section>

      <section className="driver-grid">
        <article className="surface route-map-card">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">LIVE ROUTE</span>
              <h2>배차된 수거 경로</h2>
            </div>
            <span className="route-saving">실시간 DB</span>
          </div>
          <KakaoRouteMap supabase={supabase} stops={taskStops} />
        </article>

        <article className="task-stack">
          <div className="task-heading">
            <div>
              <span className="section-kicker">PICKUP LIST</span>
              <h2>수거 일정</h2>
            </div>
            <span>{assignments.length}건</span>
          </div>
          {loading && (
            <div className="surface request-empty">
              배차를 불러오는 중입니다.
            </div>
          )}
          {!loading && assignments.length === 0 && (
            <div className="surface request-empty">
              관리자에게 배차된 수거 요청이 아직 없습니다.
            </div>
          )}
          {assignments.map((assignment) => {
            const request = firstRelation(assignment.waste_requests);
            if (!request) return null;
            const status = getTaskStatus(assignment);
            const vehicle = firstRelation(assignment.vehicles);
            return (
              <article
                className={`surface driver-task ${status === "이동 중" ? "active" : ""}`}
                key={assignment.id}
              >
                <div className="task-order">
                  {assignment.route_order ?? "–"}
                </div>
                <div className="task-copy">
                  <div>
                    <strong>
                      {getOrganizationName(request.organizations)}
                    </strong>
                    <StatusBadge status={status} />
                  </div>
                  <p>{request.pickup_address}</p>
                  <span>
                    {request.waste_type} · 예상{" "}
                    {Number(request.estimated_weight_kg).toLocaleString()}kg ·{" "}
                    {vehicle?.plate_number ?? "차량 미지정"}
                  </span>
                </div>
                {status === "도착" && (
                  <div className="task-result-fields">
                    <label>
                      <span>실제 수거 중량</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          weights[assignment.id] ??
                          String(request.estimated_weight_kg)
                        }
                        onChange={(event) =>
                          setWeights((current) => ({
                            ...current,
                            [assignment.id]: event.target.value,
                          }))
                        }
                      />
                      <b>kg</b>
                    </label>
                    <label className="task-photo">
                      <span>수거 증빙 사진</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setPhotos((current) => ({
                            ...current,
                            [assignment.id]: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                <button
                  disabled={status === "수거 완료" || busyId === assignment.id}
                  onClick={() => void advanceTask(assignment)}
                >
                  {busyId === assignment.id && "저장 중…"}
                  {busyId !== assignment.id && status === "대기" && "운행 시작"}
                  {busyId !== assignment.id &&
                    status === "이동 중" &&
                    "도착 처리"}
                  {busyId !== assignment.id &&
                    status === "도착" &&
                    "수거 완료 저장"}
                  {busyId !== assignment.id && status === "수거 완료" && "완료"}
                </button>
              </article>
            );
          })}
        </article>
      </section>
    </div>
  );
}

function LiveFacilityWorkspace({
  notify,
  supabase,
  profile,
}: {
  notify: (message: string) => void;
  supabase: SupabaseClient;
  profile: Profile;
}) {
  const [items, setItems] = useState<FacilityWorkItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dailyWeightKg, setDailyWeightKg] = useState(0);
  const [scalePhoto, setScalePhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadFacilityWork = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [workResult, receiptResult] = await Promise.all([
      supabase
        .from("waste_requests")
        .select(
          "id, request_number, waste_type, estimated_weight_kg, status, organizations(name), collection_assignments(actual_weight_kg, collected_at, vehicles(plate_number)), facility_receipts(id, measured_weight_kg, received_at, processing_results(id, processing_method, processing_line, input_weight_kg, output_weight_kg))",
        )
        .in("status", ["collected", "in_transit", "processing"])
        .order("updated_at", { ascending: true }),
      supabase
        .from("facility_receipts")
        .select("measured_weight_kg")
        .gte("received_at", startOfDay.toISOString()),
    ]);

    if (workResult.error) {
      notify(workResult.error.message);
      setLoading(false);
      return;
    }
    if (receiptResult.error) {
      notify(receiptResult.error.message);
    }

    const nextItems = (workResult.data ?? []) as unknown as FacilityWorkItem[];
    setItems(nextItems);
    setSelectedId((current) =>
      nextItems.some((item) => item.id === current)
        ? current
        : (nextItems[0]?.id ?? ""),
    );
    setDailyWeightKg(
      (receiptResult.data ?? []).reduce(
        (sum, receipt) => sum + Number(receipt.measured_weight_kg),
        0,
      ),
    );
    setLoading(false);
  }, [notify, supabase]);

  useEffect(() => {
    queueMicrotask(() => void loadFacilityWork());
    const channel = supabase
      .channel(`facility-workflow-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_requests" },
        () => void loadFacilityWork(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "facility_receipts" },
        () => void loadFacilityWork(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadFacilityWork, profile.id, supabase]);

  const current = items.find((item) => item.id === selectedId) ?? items[0];
  const assignment = firstRelation(current?.collection_assignments);
  const vehicle = firstRelation(assignment?.vehicles);
  const receipt = firstRelation(current?.facility_receipts);
  const processing = firstRelation(receipt?.processing_results);
  const isProcessing = current?.status === "processing";

  const submitFacilityResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    let photoPath: string | null = null;

    try {
      if (!isProcessing && scalePhoto) {
        const extension =
          scalePhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        photoPath = `${profile.id}/scale-${current.id}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(photoPath, scalePhoto, {
            contentType: scalePhoto.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const result = isProcessing
        ? await supabase.rpc("complete_processing_result", {
            p_request_id: current.id,
            p_output_weight_kg: Number(form.get("outputWeight")),
            p_result_note: String(form.get("resultNote") ?? "").trim() || null,
          })
        : await supabase.rpc("record_facility_receipt", {
            p_request_id: current.id,
            p_measured_weight_kg: Number(form.get("measuredWeight")),
            p_quality_status: String(form.get("qualityStatus") ?? ""),
            p_foreign_material_status: String(
              form.get("foreignMaterialStatus") ?? "",
            ),
            p_scale_photo_path: photoPath,
            p_inspection_note:
              String(form.get("inspectionNote") ?? "").trim() || null,
            p_processing_method: String(form.get("processingMethod") ?? ""),
            p_processing_line: String(form.get("processingLine") ?? ""),
          });
      if (result.error) throw result.error;

      setScalePhoto(null);
      await loadFacilityWork();
      notify(
        isProcessing
          ? `${getOrganizationName(current.organizations)} 처리 결과를 완료했습니다.`
          : `${getOrganizationName(current.organizations)} 반입·검수 결과를 저장했습니다.`,
      );
    } catch (caught) {
      if (photoPath) {
        await supabase.storage.from("evidence").remove([photoPath]);
      }
      notify(
        caught instanceof Error
          ? caught.message
          : "시설 처리 결과를 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="workspace-title">
        <div>
          <span className="page-kicker">RESOURCE FACILITY · LIVE DB</span>
          <h1>반입·검수·처리</h1>
          <p>
            수거 완료 데이터부터 계량과 자원화 결과까지 실제 DB에 기록합니다.
          </p>
        </div>
        <div className="facility-live">
          <i />
          <div>
            <strong>시설 정상 운영</strong>
            <small>금일 누적 반입 {(dailyWeightKg / 1000).toFixed(2)}t</small>
          </div>
        </div>
      </section>

      <section className="facility-grid">
        <article className="surface inbound-list">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">LIVE INBOUND</span>
              <h2>입고·처리 대기</h2>
            </div>
            <span className="number-pill">{items.length}</span>
          </div>
          {loading && (
            <div className="request-empty">입고 정보를 불러오는 중입니다.</div>
          )}
          {!loading && items.length === 0 && (
            <div className="request-empty">
              수거 완료된 입고 예정 건이 없습니다.
            </div>
          )}
          {items.map((item) => {
            const itemAssignment = firstRelation(item.collection_assignments);
            const itemVehicle = firstRelation(itemAssignment?.vehicles);
            return (
              <button
                className={current?.id === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setScalePhoto(null);
                }}
              >
                <time>
                  {itemAssignment?.collected_at
                    ? new Date(itemAssignment.collected_at).toLocaleTimeString(
                        "ko-KR",
                        { hour: "2-digit", minute: "2-digit" },
                      )
                    : "대기"}
                </time>
                <div>
                  <strong>{getOrganizationName(item.organizations)}</strong>
                  <span>
                    {item.waste_type} ·{" "}
                    {Number(
                      itemAssignment?.actual_weight_kg ??
                        item.estimated_weight_kg,
                    ).toLocaleString()}
                    kg
                  </span>
                  <small>
                    {item.status === "processing"
                      ? "처리 중"
                      : (itemVehicle?.plate_number ?? "차량 정보 없음")}
                  </small>
                </div>
                <b>›</b>
              </button>
            );
          })}
        </article>

        {current ? (
          <form
            className="surface inspection-card"
            onSubmit={submitFacilityResult}
          >
            <div className="surface-heading">
              <div>
                <span className="section-kicker">
                  {isProcessing ? "PROCESSING RESULT" : "INSPECTION"}
                </span>
                <h2>{isProcessing ? "자원화 처리 결과" : "반입 검수서"}</h2>
              </div>
              <StatusBadge status={isProcessing ? "처리 중" : "수거 완료"} />
            </div>
            <div className="inspection-summary">
              <span className="truck-mark">차</span>
              <div>
                <strong>{getOrganizationName(current.organizations)}</strong>
                <span>
                  {vehicle?.plate_number ?? "차량 정보 없음"} ·{" "}
                  {current.waste_type}
                </span>
              </div>
              <b>
                수거{" "}
                {Number(
                  assignment?.actual_weight_kg ?? current.estimated_weight_kg,
                ).toLocaleString()}
                kg
              </b>
            </div>

            <div className="weight-card">
              <span>{isProcessing ? "처리 후 생산량" : "실계량 중량"}</span>
              <div>
                <input
                  name={isProcessing ? "outputWeight" : "measuredWeight"}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={
                    isProcessing
                      ? (processing?.output_weight_kg ?? "")
                      : (assignment?.actual_weight_kg ??
                        current.estimated_weight_kg)
                  }
                  required
                />
                <b>kg</b>
              </div>
              <small>
                {isProcessing
                  ? `${processing?.processing_method ?? "처리"} · ${processing?.processing_line ?? "라인 미지정"}`
                  : "계근대 연동 전 수동 입력 모드입니다."}
              </small>
            </div>

            {!isProcessing ? (
              <>
                <div className="inspection-form">
                  <label>
                    <span>품질 상태</span>
                    <select name="qualityStatus" defaultValue="양호">
                      <option>양호</option>
                      <option>주의</option>
                      <option>반입 불가</option>
                    </select>
                  </label>
                  <label>
                    <span>이물질 여부</span>
                    <select name="foreignMaterialStatus" defaultValue="없음">
                      <option>없음</option>
                      <option>소량 검출</option>
                      <option>다량 검출</option>
                    </select>
                  </label>
                  <label>
                    <span>처리 방식</span>
                    <select name="processingMethod" defaultValue="혐기성 소화">
                      <option>혐기성 소화</option>
                      <option>사료화</option>
                      <option>퇴비화</option>
                    </select>
                  </label>
                  <label>
                    <span>처리 라인</span>
                    <select name="processingLine" defaultValue="A-01">
                      <option>A-01</option>
                      <option>A-02</option>
                      <option>B-01</option>
                    </select>
                  </label>
                  <label className="full">
                    <span>검수 메모</span>
                    <textarea
                      name="inspectionNote"
                      defaultValue="육안 검사 결과 특이사항 없음"
                    />
                  </label>
                </div>
                <div className="proof-upload">
                  <input
                    id="live-scale-photo"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setScalePhoto(event.target.files?.[0] ?? null)
                    }
                  />
                  <label htmlFor="live-scale-photo">
                    <span>＋</span>
                    <div>
                      <strong>계량·증빙 사진 첨부</strong>
                      <small>
                        {scalePhoto?.name ?? "클릭하여 사진을 선택하세요."}
                      </small>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              <label className="processing-note">
                <span>처리 결과 메모</span>
                <textarea
                  name="resultNote"
                  placeholder="생산량, 품질, 특이사항을 기록하세요."
                />
              </label>
            )}

            <button
              className="primary-action full-action"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "DB 저장 중…"
                : isProcessing
                  ? "처리 완료 저장"
                  : "검수 완료 및 반입 처리"}
            </button>
          </form>
        ) : (
          <article className="surface inspection-card request-empty">
            처리할 입고 건을 선택해 주세요.
          </article>
        )}

        <article className="surface daily-throughput">
          <div className="surface-heading">
            <div>
              <span className="section-kicker">DAILY THROUGHPUT</span>
              <h2>오늘의 실제 반입량</h2>
            </div>
          </div>
          <div className="throughput-number">
            <strong>{(dailyWeightKg / 1000).toFixed(2)}</strong>
            <span>ton</span>
            <small>Supabase 계량 기록 합계</small>
          </div>
          <div className="throughput-bar">
            <i
              style={{
                width: `${Math.min(100, (dailyWeightKg / 7000) * 100)}%`,
              }}
            />
          </div>
          <div className="throughput-types">
            <span>
              <i className="type-one" />
              입고·처리 대기 <b>{items.length}건</b>
            </span>
            <span>
              <i className="type-two" />
              처리 중{" "}
              <b>
                {items.filter((item) => item.status === "processing").length}건
              </b>
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}

function IntegrationsWorkspace({
  notify,
  supabase,
  profile,
  activeRole,
  onRoleChange,
}: {
  notify: (message: string) => void;
  supabase: SupabaseClient;
  profile: Profile;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}) {
  const canSwitchAllRoles = profile.role === "admin";
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    queueMicrotask(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch("/api/integrations/status", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return;
      setServiceStatus((await response.json()) as Record<string, boolean>);
    });
  }, [supabase]);

  return (
    <div className="page-stack">
      <section className="workspace-title integration-title">
        <div>
          <span className="page-kicker">ACCOUNT & SERVICE CONNECTION</span>
          <h1>계정 연동 설정</h1>
          <p>
            한 번 로그인한 뒤 필요한 업무 화면을 선택하세요. 다시 로그인할
            필요 없이 즉시 이동합니다.
          </p>
        </div>
        <span className="demo-mode connected-mode">
          <i />
          통합 계정 연결됨
        </span>
      </section>

      <section className="surface linked-account-panel">
        <div className="surface-heading">
          <div>
            <span className="section-kicker">WORKSPACE SWITCHER</span>
            <h2>사용할 업무 화면 선택</h2>
            <p>
              로그인 계정과 데이터 접근 권한은 그대로 유지되고 화면만
              전환됩니다.
            </p>
          </div>
          <span className="linked-account-name">
            {profile.full_name} · {roleLabel[profile.role]}
          </span>
        </div>
        <div className="linked-role-grid">
          {roleOptions.map((option) => {
            const available =
              canSwitchAllRoles || option.role === profile.role;
            const active = option.role === activeRole;

            return (
              <button
                key={option.role}
                className={active ? "active" : ""}
                disabled={!available}
                onClick={() => onRoleChange(option.role)}
              >
                <span>{option.mark}</span>
                <div>
                  <strong>{option.title}</strong>
                  <small>{option.detail}</small>
                </div>
                <b>{active ? "사용 중" : available ? "이동" : "권한 없음"}</b>
              </button>
            );
          })}
        </div>
        <p className="linked-role-note">
          {canSwitchAllRoles
            ? "통합관리자 계정은 네 가지 업무 화면을 모두 사용할 수 있습니다."
            : "일반 계정은 담당 업무 화면만 사용할 수 있으며, 추가 권한은 통합관리자가 연결합니다."}
        </p>
      </section>

      <div className="integration-section-heading">
        <span className="section-kicker">EXTERNAL SERVICES</span>
        <h2>API · 데이터베이스 연결 상태</h2>
      </div>
      <section className="integration-grid">
        {integrations.map((integration) => {
          const configured = serviceStatus[integration.statusKey];
          const status =
            configured === true
              ? "연결 완료"
              : configured === false
                ? integration.status.includes("필요")
                  ? integration.status
                  : "설정 필요"
                : "확인 중";
          return (
          <article className="surface integration-card" key={integration.name}>
            <span className={`integration-mark ${integration.tone}`}>
              {integration.mark}
            </span>
            <div>
              <small>{integration.group}</small>
              <h2>{integration.name}</h2>
              <p>{integration.detail}</p>
            </div>
            <span
              className={`need-setting ${configured === true ? "connected" : ""}`}
            >
              {status}
            </span>
            <button
              onClick={() =>
                notify(
                  configured
                    ? `${integration.name} 서버 설정이 연결되어 있습니다.`
                    : `${integration.name} 추가 연결 설정이 필요합니다.`,
                )
              }
            >
              {configured ? "상태 확인" : "연결 설정"}
            </button>
          </article>
          );
        })}
      </section>
      {profile.role === "admin" && (
        <AdminInvitePanel supabase={supabase} notify={notify} />
      )}
      <section className="surface readiness-card">
        <div className="readiness-copy">
          <span className="section-kicker">IMPLEMENTATION READINESS</span>
          <h2>실제 서비스 연결을 위한 준비 항목</h2>
          <p>
            키는 브라우저 코드에 직접 넣지 않고 Supabase Edge Functions 또는
            배포 환경변수에 보관합니다.
          </p>
        </div>
        <div className="readiness-steps">
          <div>
            <span>1</span>
            <strong>Supabase 프로젝트 생성</strong>
            <small>URL · anon key 준비</small>
          </div>
          <i>→</i>
          <div>
            <span>2</span>
            <strong>DB 스키마 적용</strong>
            <small>테이블 · RLS · Storage</small>
          </div>
          <i>→</i>
          <div>
            <span>3</span>
            <strong>외부 API 키 등록</strong>
            <small>Gemini · Kakao · 날씨 · Resend</small>
          </div>
          <i>→</i>
          <div>
            <span>4</span>
            <strong>실데이터 전환</strong>
            <small>Realtime 구독 활성화</small>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>("admin");
  const [authLoading, setAuthLoading] = useState(true);
  const [requests, setRequests] = useState<DbWasteRequest[]>([]);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const loadProfile = useCallback(
    async (nextUser: User) => {
      const fetchProfile = async () =>
        supabase
          .from("profiles")
          .select(
            "id, organization_id, role, full_name, phone, is_active, organizations(name)",
          )
          .eq("id", nextUser.id)
          .maybeSingle();

      let { data, error } = await fetchProfile();

      if (!data && !error) {
        const inviteToken = window.localStorage.getItem("bsori-invite-token");
        const bootstrapRaw = window.localStorage.getItem("bsori-bootstrap");

        if (inviteToken) {
          const { error: invitationError } = await supabase.rpc(
            "accept_account_invitation",
            { p_token: inviteToken },
          );
          if (!invitationError) {
            window.localStorage.removeItem("bsori-invite-token");
            ({ data, error } = await fetchProfile());
          }
        } else if (bootstrapRaw) {
          const bootstrap = JSON.parse(bootstrapRaw) as {
            fullName: string;
            phone: string;
          };
          const { error: bootstrapError } = await supabase.rpc(
            "bootstrap_first_admin",
            {
              p_full_name: bootstrap.fullName,
              p_phone: bootstrap.phone || null,
            },
          );
          if (!bootstrapError) {
            window.localStorage.removeItem("bsori-bootstrap");
            ({ data, error } = await fetchProfile());
          }
        }
      }

      if (error) {
        setProfile(null);
        setToast(error.message);
        return;
      }

      const nextProfile = (data as Profile | null) ?? null;
      setProfile(nextProfile);

      if (nextProfile) {
        const savedRole = window.localStorage.getItem(
          "bsori-active-role",
        ) as UserRole | null;

        const initialRole =
          nextProfile.role === "admin" &&
          savedRole &&
          selectableRoles.includes(savedRole)
            ? savedRole
            : nextProfile.role;

        setActiveRole(initialRole);
        setWorkspace(roleWorkspace[initialRole]);
      }
    },
    [supabase],
  );

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("waste_requests")
      .select(
        "id, request_number, waste_type, estimated_weight_kg, pickup_address, latitude, longitude, status, created_at, organizations(name)",
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setToast(error.message);
      return;
    }

    setRequests((data ?? []) as DbWasteRequest[]);
  }, [supabase]);

  const loadWeather = useCallback(async () => {
    if (!profile || !["admin", "driver"].includes(activeRole)) {
      setWeather(null);
      return;
    }

    setWeatherLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/weather", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json()) as WeatherForecast & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "기상 조회 실패");
      setWeather(payload);
    } catch (caught) {
      setWeather(null);
      setToast(
        caught instanceof Error
          ? caught.message
          : "기상청 예보를 불러오지 못했습니다.",
      );
    } finally {
      setWeatherLoading(false);
    }
  }, [profile, activeRole, supabase]);

  useEffect(() => {
    queueMicrotask(() => void loadWeather());
    const interval = window.setInterval(
      () => void loadWeather(),
      30 * 60 * 1000,
    );
    return () => window.clearInterval(interval);
  }, [loadWeather]);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) await loadProfile(data.user);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setRequests([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  useEffect(() => {
    if (!profile) return;

    const initialLoad = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    const channel = supabase
      .channel(`waste-requests-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_requests" },
        () => {
          void loadRequests();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [loadRequests, profile, supabase]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
  }, []);

  const visibleNavigation = useMemo(() => {
    if (activeRole === "admin") {
      return adminNavigation;
    }

    return roleNavigation[activeRole as Exclude<UserRole, "admin">];
  }, [activeRole]);

  const current = useMemo(
    () =>
      visibleNavigation.find((item) => item.id === workspace) ??
      visibleNavigation[0] ??
      adminNavigation[0],
    [visibleNavigation, workspace],
  );
  const displayRequests = demoMode ? demoRequests : requests;
  const notificationCount = displayRequests.filter((request) =>
    ["requested", "collecting", "collected", "processing"].includes(
      request.status,
    ),
  ).length;
  const changeActiveRole = (nextRole: UserRole) => {
    if (profile?.role !== "admin" && nextRole !== profile?.role) {
      notify("이 계정에는 해당 업무 화면 권한이 없습니다.");
      return;
    }

    setActiveRole(nextRole);
    setWorkspace(roleWorkspace[nextRole]);

    window.localStorage.setItem("bsori-active-role", nextRole);

    notify(`${roleLabel[nextRole]} 화면으로 전환했습니다.`);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const toggleDemoMode = () => {
    const nextMode = !demoMode;
    setDemoMode(nextMode);
    notify(
      nextMode
        ? "시연 데이터가 켜졌습니다. 역할 화면을 바꾸며 전체 흐름을 보여주세요."
        : "시연 모드를 종료하고 실제 Supabase 데이터로 돌아왔습니다.",
    );
  };

  if (authLoading) {
    return (
      <main className="auth-shell auth-loading">
        <span className="brand-mark">B</span>
        <strong>안전한 작업공간을 불러오는 중입니다.</strong>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <AuthPanel
        supabase={supabase}
        onReady={async (nextUser) => {
          setUser(nextUser);
          await loadProfile(nextUser);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <div>
            <strong>B.SORI</strong>
            <small>BLUE RESOURCE CYCLE</small>
          </div>
        </div>
        <div className="sidebar-project">
          <span>부산 수산 부산물</span>
          <strong>통합 관리 플랫폼</strong>
          <small>
            <i /> Supabase 실시간 연결
          </small>
        </div>
        <nav aria-label="업무 메뉴">
          <span className="nav-label">WORKSPACES</span>
          {visibleNavigation.map((item) => (
            <button
              key={item.id}
              className={workspace === item.id ? "active" : ""}
              onClick={() => setWorkspace(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.eyebrow} 화면</small>
              </span>
              <b>›</b>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sync-state">
            <span className="pulse-dot" />
            <div>
              <strong>데이터 동기화</strong>
              <small>{demoMode ? "안전한 시연 데이터" : "Realtime 구독 중"}</small>
            </div>
          </div>
          <button onClick={() => setWorkspace("integrations")}>
            계정·연동 설정
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">B</span>
            <strong>B.SORI</strong>
          </div>
          <div className="breadcrumb">
            <span>B.SORI</span>
            <i>/</i>
            <strong>{current.label}</strong>
          </div>
          <div className="top-actions">
            <span className={`demo-chip ${demoMode ? "showcase" : "live"}`}>
              {demoMode ? "DEMO" : "LIVE"}
            </span>
            {profile.role === "admin" && (
              <button
                className={`demo-mode-toggle ${demoMode ? "active" : ""}`}
                type="button"
                aria-pressed={demoMode}
                onClick={toggleDemoMode}
              >
                {demoMode ? "시연 종료" : "시연 데이터 켜기"}
              </button>
            )}
            {profile.role === "admin" ? (
              <div className="role-switcher">
                <span>현재 화면</span>
                <select
                  aria-label="업무 화면 전환"
                  value={activeRole}
                  onChange={(event) =>
                    changeActiveRole(event.target.value as UserRole)
                  }
                >
                  {selectableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel[role]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="single-role-chip">
                {roleLabel[profile.role]} 화면
              </span>
            )}
            <button
              className="top-icon"
              aria-label="요청 현황 보기"
              onClick={() =>
                setWorkspace(
                  profile.role === "admin"
                    ? "operations"
                    : roleWorkspace[activeRole],
                )
              }
            >
              ⌕
            </button>
            <button
              className="top-icon notification"
              aria-label="알림"
              onClick={() =>
                notify(
                  notificationCount > 0
                    ? `확인이 필요한 진행 중 요청이 ${notificationCount}건 있습니다.`
                    : "확인이 필요한 운영 요청이 없습니다.",
                )
              }
            >
              ●{notificationCount > 0 && <i />}
            </button>
            <div className="account">
              <span>{profile.full_name.slice(0, 1)}</span>
              <div>
                <strong>{profile.full_name}</strong>
                <small>
                  {getOrganizationName(profile.organizations)} · 현재{" "}
                  {roleLabel[activeRole]} 화면
                </small>
              </div>
            </div>
            <button
              className="logout-button"
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setProfile(null);
              }}
            >
              로그아웃
            </button>
          </div>
        </header>

        <div className="content">
          {demoMode && (
            <div className="showcase-banner" role="status">
              <span>DEMO</span>
              <div>
                <strong>시연 데이터 모드</strong>
                <small>
                  아래 정보와 상태 변경은 발표용이며 실제 Supabase 운영 데이터에
                  저장되지 않습니다.
                </small>
              </div>
              <button onClick={() => setWorkspace("integrations")}>
                역할 화면 전환
              </button>
            </div>
          )}
          {workspace === "overview" && (
            <AdminOverview
              requests={displayRequests}
              weather={weather}
              weatherLoading={weatherLoading}
              onNavigate={setWorkspace}
            />
          )}
          {workspace === "operations" && (
            <AdminOperationsWorkspace
              notify={notify}
              requests={displayRequests}
              supabase={supabase}
              onChanged={loadRequests}
              demoMode={demoMode}
            />
          )}
          {workspace === "forecast" && (
            <AiForecastWorkspace requests={displayRequests} notify={notify} />
          )}
          {workspace === "energy" && (
            <ResourceEnergyWorkspace requests={displayRequests} />
          )}
          {workspace === "discharger" && (
            <DischargerWorkspace
              notify={notify}
              supabase={supabase}
              profile={profile}
              requests={displayRequests}
              demoMode={demoMode}
              onCreated={loadRequests}
            />
          )}

          {workspace === "driver" && demoMode && (
            <DriverWorkspace
              notify={notify}
              supabase={supabase}
              weather={weather}
              weatherLoading={weatherLoading}
            />
          )}
          {workspace === "driver" && !demoMode && (
            <LiveDriverWorkspace
              notify={notify}
              supabase={supabase}
              profile={profile}
              weather={weather}
              weatherLoading={weatherLoading}
            />
          )}

          {workspace === "facility" && demoMode && (
            <FacilityWorkspace notify={notify} />
          )}
          {workspace === "facility" && !demoMode && (
            <LiveFacilityWorkspace
              notify={notify}
              supabase={supabase}
              profile={profile}
            />
          )}

          {workspace === "integrations" && (
            <IntegrationsWorkspace
              notify={notify}
              supabase={supabase}
              profile={profile}
              activeRole={activeRole}
              onRoleChange={changeActiveRole}
            />
          )}
        </div>

        <nav
          className="mobile-nav"
          aria-label="모바일 업무 메뉴"
          style={{
            gridTemplateColumns: `repeat(${visibleNavigation.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleNavigation.map((item) => (
            <button
              key={item.id}
              className={workspace === item.id ? "active" : ""}
              onClick={() => setWorkspace(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </section>
      {toast && (
        <div className="toast">
          <span>✓</span>
          <p>{toast}</p>
        </div>
      )}
    </main>
  );
}
