"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Workspace = "overview" | "discharger" | "driver" | "facility" | "integrations";
type DriverTaskStatus = "대기" | "이동 중" | "도착" | "수거 완료";

const navigation: { id: Workspace; label: string; eyebrow: string; icon: string }[] = [
  { id: "overview", label: "통합 관제", eyebrow: "관리자", icon: "⌂" },
  { id: "discharger", label: "부산물 등록", eyebrow: "배출업체", icon: "+" },
  { id: "driver", label: "수거 운행", eyebrow: "수거기사", icon: "↗" },
  { id: "facility", label: "반입·처리", eyebrow: "자원화시설", icon: "□" },
  { id: "integrations", label: "서비스 연동", eyebrow: "시스템", icon: "⋯" },
];

const statusTone: Record<string, string> = {
  "접수 완료": "blue",
  "배차 완료": "violet",
  "수거 중": "amber",
  "운송 중": "amber",
  "반입 완료": "green",
  "처리 완료": "green",
  "대기": "gray",
  "이동 중": "amber",
  "도착": "blue",
  "수거 완료": "green",
};

const adminRequests = [
  { id: "REQ-0729-018", company: "부산공동어시장", type: "생선 내장", amount: "1,240 kg", driver: "김도윤 · 2호차", status: "수거 중", updated: "10분 전" },
  { id: "REQ-0729-017", company: "해원수산", type: "어류 뼈·머리", amount: "860 kg", driver: "박재현 · 1호차", status: "운송 중", updated: "24분 전" },
  { id: "REQ-0729-016", company: "남항수산가공", type: "혼합 부산물", amount: "540 kg", driver: "배차 대기", status: "접수 완료", updated: "38분 전" },
  { id: "REQ-0729-015", company: "청해유통", type: "갑각류 껍질", amount: "320 kg", driver: "이서준 · 3호차", status: "반입 완료", updated: "1시간 전" },
];

const integrations = [
  { name: "Supabase", detail: "Auth · PostgreSQL · Storage · Realtime", status: "설정 필요", group: "핵심 백엔드", tone: "green", mark: "S" },
  { name: "Gemini API", detail: "사진 판별 · 문서 정보 추출", status: "API 키 필요", group: "AI 분석", tone: "violet", mark: "G" },
  { name: "Kakao Maps", detail: "지도 · 주소 좌표 변환", status: "API 키 필요", group: "지도", tone: "yellow", mark: "K" },
  { name: "Kakao Mobility", detail: "경로 · 거리 · 예상 시간", status: "API 키 필요", group: "경로", tone: "yellow", mark: "M" },
  { name: "기상청 단기예보", detail: "강수 · 강풍 · 수거 위험 판단", status: "서비스 키 필요", group: "날씨", tone: "blue", mark: "W" },
  { name: "Resend", detail: "요청 · 지연 · 완료 이메일", status: "API 키 필요", group: "알림", tone: "navy", mark: "R" },
];

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusTone[status] ?? "gray"}`}><i />{status}</span>;
}

function MiniMetric({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <article className="mini-metric">
      <div className={`metric-icon ${accent}`}>{label.slice(0, 1)}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function AdminOverview({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="page-hero admin-hero">
        <div>
          <span className="page-kicker">INTEGRATED CONTROL</span>
          <h1>수산 부산물 흐름을<br /><em>한눈에 관리하세요.</em></h1>
          <p>등록부터 수거, 반입, 처리까지 전 과정의 현재 상태를 실시간으로 확인합니다.</p>
        </div>
        <div className="hero-status-card">
          <div className="hero-status-top"><span><i />실시간 운영 중</span><small>2026. 07. 30 14:32 기준</small></div>
          <div className="hero-status-numbers">
            <div><span>오늘 처리 진행률</span><strong>72<small>%</small></strong></div>
            <div className="radial-progress"><span>72</span></div>
          </div>
          <div className="hero-progress"><i /></div>
          <p>총 18건 중 13건이 반입 또는 처리 완료되었습니다.</p>
        </div>
      </section>

      <section className="metric-row">
        <MiniMetric label="오늘 등록" value="18건" note="어제보다 3건 증가" accent="mint" />
        <MiniMetric label="수거 진행" value="7건" note="기사 4명 운행 중" accent="orange" />
        <MiniMetric label="오늘 반입량" value="6.42t" note="예상 대비 91%" accent="blue" />
        <MiniMetric label="처리 완료" value="13건" note="평균 4시간 18분" accent="violet" />
      </section>

      <section className="dashboard-grid">
        <article className="surface pipeline-card">
          <div className="surface-heading">
            <div><span className="section-kicker">TODAY&apos;S PIPELINE</span><h2>오늘의 처리 파이프라인</h2></div>
            <button className="quiet-button" onClick={() => notify("전체 처리 이력을 불러왔습니다.")}>전체 이력</button>
          </div>
          <div className="pipeline">
            {[
              ["01", "등록", "18", "배출업체 접수"],
              ["02", "배차", "15", "기사 배정"],
              ["03", "수거", "7", "현장 진행"],
              ["04", "반입", "13", "시설 계량"],
              ["05", "처리", "11", "자원화 완료"],
            ].map(([no, label, count, detail], index) => (
              <div className="pipeline-stage" key={label}>
                <div className={`stage-ring stage-${index}`}><span>{no}</span><strong>{count}</strong></div>
                <b>{label}</b><small>{detail}</small>
                {index < 4 && <i className="stage-connector" />}
              </div>
            ))}
          </div>
        </article>

        <article className="surface weather-card">
          <div className="surface-heading">
            <div><span className="section-kicker">FIELD SAFETY</span><h2>부산 수거 기상</h2></div>
            <span className="weather-place">영도구</span>
          </div>
          <div className="weather-main"><span className="weather-symbol">☁</span><strong>24°</strong><div><b>흐림</b><small>체감 25° · 강수 30%</small></div></div>
          <div className="risk-line"><span><i />수거 위험도</span><strong>보통</strong></div>
          <p>15시 이후 해안가 순간 풍속이 높아질 수 있습니다.</p>
        </article>

        <article className="surface request-table-card">
          <div className="surface-heading">
            <div><span className="section-kicker">LIVE REQUESTS</span><h2>최근 수거 요청</h2></div>
            <div className="table-filter"><button className="active">전체</button><button>진행 중</button><button>완료</button></div>
          </div>
          <div className="request-table" role="table" aria-label="최근 수거 요청">
            <div className="request-row request-head" role="row"><span>요청번호</span><span>배출업체 / 품목</span><span>예상량</span><span>담당 기사</span><span>상태</span><span>업데이트</span></div>
            {adminRequests.map((request) => (
              <button className="request-row" role="row" key={request.id} onClick={() => notify(`${request.id} 상세 정보를 열었습니다.`)}>
                <span><b>{request.id}</b></span>
                <span><strong>{request.company}</strong><small>{request.type}</small></span>
                <span>{request.amount}</span>
                <span>{request.driver}</span>
                <span><StatusBadge status={request.status} /></span>
                <span>{request.updated}</span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function DischargerWorkspace({ notify }: { notify: (message: string) => void }) {
  const [photoName, setPhotoName] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      setAnalyzed(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegistered(true);
    notify("수거 요청 REQ-0730-019가 임시 등록되었습니다.");
  };

  return (
    <div className="page-stack">
      <section className="workspace-title">
        <div><span className="page-kicker">DISCHARGER WORKSPACE</span><h1>부산물 등록</h1><p>부산물 정보와 사진을 등록하면 AI가 종류와 상태를 분석합니다.</p></div>
        <div className="role-chip"><span className="role-avatar company">해</span><div><strong>해원수산</strong><small>배출업체 담당자</small></div></div>
      </section>

      <section className="form-layout">
        <form className="surface registration-form" onSubmit={submit}>
          <div className="surface-heading"><div><span className="section-kicker">NEW REQUEST</span><h2>새 수거 요청</h2></div><span className="step-label">필수 항목 *</span></div>
          <div className="form-grid">
            <label><span>부산물 종류 *</span><select defaultValue="생선 내장"><option>생선 내장</option><option>어류 뼈·머리</option><option>갑각류 껍질</option><option>혼합 부산물</option></select></label>
            <label><span>예상 수량 *</span><div className="input-unit"><input type="number" defaultValue="420" min="1" /><b>kg</b></div></label>
            <label><span>보관 상태</span><select defaultValue="냉장"><option>냉장</option><option>냉동</option><option>상온</option></select></label>
            <label><span>수거 희망 시간</span><input type="datetime-local" defaultValue="2026-07-30T16:00" /></label>
            <label className="full"><span>수거 주소 *</span><div className="address-input"><input defaultValue="부산광역시 영도구 해양로 24" /><button type="button" onClick={() => notify("Kakao Local API 연결 후 주소 검색이 활성화됩니다.")}>주소 검색</button></div></label>
            <label className="full"><span>현장 메모</span><textarea defaultValue="3번 냉장창고 앞 파란색 수거함입니다." /></label>
          </div>

          <div className="upload-zone">
            <input id="waste-photo" type="file" accept="image/*" onChange={handlePhoto} />
            <label htmlFor="waste-photo">
              <span className="upload-icon">＋</span>
              <strong>{photoName || "부산물 사진을 올려주세요"}</strong>
              <small>{photoName ? "다른 사진으로 교체하려면 클릭하세요." : "JPG, PNG · 최대 10MB · 모바일 카메라 촬영 가능"}</small>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => notify("작성 중인 내용이 임시 저장되었습니다.")}>임시 저장</button>
            <button type="submit" className="primary-action">{registered ? "등록 완료" : "수거 요청 등록"}</button>
          </div>
        </form>

        <aside className="form-side">
          <article className={`surface ai-card ${analyzed ? "analyzed" : ""}`}>
            <div className="ai-card-head"><span className="ai-mark">✦</span><div><span>GEMINI VISION</span><strong>AI 사진 분석</strong></div></div>
            {!analyzed ? (
              <div className="ai-empty">
                <div className="scan-frame"><span /><span /><span /><span /><b>AI</b></div>
                <p>{photoName ? "사진이 준비되었습니다. 분석을 시작해 주세요." : "사진을 등록하면 부산물 종류와 상태를 자동으로 추정합니다."}</p>
                <button disabled={!photoName} onClick={() => setAnalyzed(true)}>사진 분석 시작</button>
              </div>
            ) : (
              <div className="analysis-result">
                <span className="confidence-label">분석 신뢰도 <b>94.6%</b></span>
                <h3>고등어 내장 부산물</h3>
                <div className="analysis-grid"><span>추정 상태 <b>양호</b></span><span>이물질 <b>미검출</b></span><span>추정 중량 <b>405~435kg</b></span><span>권장 수거 <b>4시간 이내</b></span></div>
                <div className="analysis-note"><b>검증 필요</b><p>AI 결과는 참고값입니다. 등록 전 담당자가 내용을 확인해 주세요.</p></div>
              </div>
            )}
          </article>
          <article className="surface recent-card">
            <div className="surface-heading"><div><span className="section-kicker">MY REQUESTS</span><h2>최근 요청</h2></div></div>
            {[
              ["REQ-0729-012", "어류 뼈·머리 · 380kg", "처리 완료"],
              ["REQ-0728-008", "생선 내장 · 510kg", "반입 완료"],
              ["REQ-0727-021", "혼합 부산물 · 290kg", "처리 완료"],
            ].map(([id, detail, status]) => <div className="recent-row" key={id}><span><strong>{id}</strong><small>{detail}</small></span><StatusBadge status={status} /></div>)}
          </article>
        </aside>
      </section>
    </div>
  );
}

function DriverWorkspace({ notify }: { notify: (message: string) => void }) {
  const [tasks, setTasks] = useState<{ id: string; order: number; company: string; address: string; amount: string; eta: string; status: DriverTaskStatus }[]>([
    { id: "REQ-0729-018", order: 1, company: "부산공동어시장", address: "서구 충무대로 202", amount: "1,240kg", eta: "14:45", status: "이동 중" },
    { id: "REQ-0729-016", order: 2, company: "남항수산가공", address: "영도구 남항서로 85", amount: "540kg", eta: "15:25", status: "대기" },
    { id: "REQ-0730-003", order: 3, company: "해원수산", address: "영도구 해양로 24", amount: "420kg", eta: "16:10", status: "대기" },
  ]);

  const advanceTask = (id: string) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const next: Record<DriverTaskStatus, DriverTaskStatus> = { "대기": "이동 중", "이동 중": "도착", "도착": "수거 완료", "수거 완료": "수거 완료" };
      notify(`${task.company} 상태를 '${next[task.status]}'으로 변경했습니다.`);
      return { ...task, status: next[task.status] };
    }));
  };

  return (
    <div className="driver-shell">
      <section className="driver-top">
        <div><span className="page-kicker">DRIVER MOBILE</span><h1>안전 운행하세요, 김도윤 기사님.</h1><p>오늘 3개 지점 · 총 예상 수거량 2.2톤</p></div>
        <div className="driver-weather"><span>☁</span><div><strong>24° · 흐림</strong><small>강풍 주의 · 위험도 보통</small></div></div>
      </section>

      <section className="driver-grid">
        <article className="surface route-map-card">
          <div className="surface-heading"><div><span className="section-kicker">OPTIMIZED ROUTE</span><h2>오늘의 수거 경로</h2></div><span className="route-saving">18분 단축</span></div>
          <div className="route-map">
            <span className="map-water-label">BUSAN HARBOR</span>
            <i className="map-road road-a" /><i className="map-road road-b" /><i className="map-road road-c" />
            <i className="map-route route-a" /><i className="map-route route-b" /><i className="map-route route-c" />
            <span className="map-location start">출</span><span className="map-location point-one">1</span><span className="map-location point-two">2</span><span className="map-location point-three">3</span><span className="map-location finish">B</span>
            <div className="map-vehicle">2호차</div>
          </div>
          <div className="route-summary"><span>총 거리 <b>31.8km</b></span><span>예상 시간 <b>2시간 35분</b></span><span>적재율 <b>42%</b></span></div>
        </article>

        <article className="task-stack">
          <div className="task-heading"><div><span className="section-kicker">PICKUP LIST</span><h2>수거 일정</h2></div><span>3개 지점</span></div>
          {tasks.map((task) => (
            <article className={`surface driver-task ${task.status === "이동 중" ? "active" : ""}`} key={task.id}>
              <div className="task-order">{task.order}</div>
              <div className="task-copy"><div><strong>{task.company}</strong><StatusBadge status={task.status} /></div><p>{task.address}</p><span>예상 {task.amount} · 도착 {task.eta}</span></div>
              <button disabled={task.status === "수거 완료"} onClick={() => advanceTask(task.id)}>
                {task.status === "대기" && "운행 시작"}{task.status === "이동 중" && "도착 처리"}{task.status === "도착" && "수거 완료"}{task.status === "수거 완료" && "완료"}
              </button>
            </article>
          ))}
          <div className="pwa-note"><span>앱</span><div><strong>홈 화면에 B.SORI를 추가하세요</strong><small>네트워크가 불안정해도 오늘의 수거 목록을 확인할 수 있습니다.</small></div><button onClick={() => notify("브라우저의 '홈 화면에 추가' 메뉴를 이용해 주세요.")}>설치 안내</button></div>
        </article>
      </section>
    </div>
  );
}

function FacilityWorkspace({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState(0);
  const [processed, setProcessed] = useState(false);
  const inbound = [
    { time: "14:50", company: "해원수산", vehicle: "부산 82가 2481", type: "생선 내장", expected: "420kg" },
    { time: "15:20", company: "남항수산가공", vehicle: "부산 83나 1104", type: "혼합 부산물", expected: "540kg" },
    { time: "16:05", company: "부산공동어시장", vehicle: "부산 81다 7702", type: "어류 뼈·머리", expected: "1,240kg" },
  ];
  const current = inbound[selected];

  const complete = () => {
    setProcessed(true);
    notify(`${current.company} 반입 검수 결과를 저장했습니다.`);
  };

  return (
    <div className="page-stack">
      <section className="workspace-title">
        <div><span className="page-kicker">RESOURCE FACILITY</span><h1>반입·검수·처리</h1><p>차량 도착부터 계량, 검수, 자원화 처리 결과까지 기록합니다.</p></div>
        <div className="facility-live"><i /><div><strong>시설 정상 운영</strong><small>금일 누적 반입 6.42t</small></div></div>
      </section>

      <section className="facility-grid">
        <article className="surface inbound-list">
          <div className="surface-heading"><div><span className="section-kicker">EXPECTED INBOUND</span><h2>입고 예정</h2></div><span className="number-pill">3</span></div>
          {inbound.map((item, index) => (
            <button className={selected === index ? "selected" : ""} key={item.company} onClick={() => { setSelected(index); setProcessed(false); }}>
              <time>{item.time}</time><div><strong>{item.company}</strong><span>{item.type} · {item.expected}</span><small>{item.vehicle}</small></div><b>›</b>
            </button>
          ))}
        </article>

        <form className="surface inspection-card" onSubmit={(event) => { event.preventDefault(); complete(); }}>
          <div className="surface-heading"><div><span className="section-kicker">INSPECTION</span><h2>반입 검수서</h2></div><StatusBadge status={processed ? "반입 완료" : "대기"} /></div>
          <div className="inspection-summary"><span className="truck-mark">차</span><div><strong>{current.company}</strong><span>{current.vehicle} · {current.type}</span></div><b>예상 {current.expected}</b></div>
          <div className="weight-card"><span>실계량 중량</span><div><input type="number" defaultValue={current.expected.replace(/[^0-9]/g, "")} /><b>kg</b></div><small>계근대 연동 전 수동 입력 모드입니다.</small></div>
          <div className="inspection-form">
            <label><span>품질 상태</span><select defaultValue="양호"><option>양호</option><option>주의</option><option>반입 불가</option></select></label>
            <label><span>이물질 여부</span><select defaultValue="없음"><option>없음</option><option>소량 검출</option><option>다량 검출</option></select></label>
            <label><span>처리 방식</span><select defaultValue="혐기성 소화"><option>혐기성 소화</option><option>사료화</option><option>퇴비화</option></select></label>
            <label><span>처리 라인</span><select defaultValue="A-01"><option>A-01</option><option>A-02</option><option>B-01</option></select></label>
            <label className="full"><span>검수 메모</span><textarea defaultValue="육안 검사 결과 특이사항 없음" /></label>
          </div>
          <div className="proof-upload"><input id="scale-photo" type="file" accept="image/*" /><label htmlFor="scale-photo"><span>＋</span><div><strong>계량·증빙 사진 첨부</strong><small>클릭하여 사진을 선택하세요.</small></div></label></div>
          <button className="primary-action full-action" type="submit">{processed ? "저장 완료" : "검수 완료 및 반입 처리"}</button>
        </form>

        <article className="surface daily-throughput">
          <div className="surface-heading"><div><span className="section-kicker">DAILY THROUGHPUT</span><h2>오늘의 처리량</h2></div></div>
          <div className="throughput-number"><strong>6.42</strong><span>ton</span><small>목표 7.0t</small></div>
          <div className="throughput-bar"><i /></div>
          <div className="throughput-types"><span><i className="type-one" />생선 내장 <b>3.12t</b></span><span><i className="type-two" />뼈·머리 <b>2.04t</b></span><span><i className="type-three" />기타 <b>1.26t</b></span></div>
        </article>
      </section>
    </div>
  );
}

function IntegrationsWorkspace({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="workspace-title integration-title">
        <div><span className="page-kicker">SERVICE PIPELINE</span><h1>API · 데이터베이스 연동</h1><p>각 서비스의 키와 Supabase 프로젝트를 연결하면 데모 데이터가 실제 데이터로 전환됩니다.</p></div>
        <span className="demo-mode"><i />현재 데모 모드</span>
      </section>
      <section className="integration-grid">
        {integrations.map((integration) => (
          <article className="surface integration-card" key={integration.name}>
            <span className={`integration-mark ${integration.tone}`}>{integration.mark}</span>
            <div><small>{integration.group}</small><h2>{integration.name}</h2><p>{integration.detail}</p></div>
            <span className="need-setting">{integration.status}</span>
            <button onClick={() => notify(`${integration.name} 환경변수 안내를 확인해 주세요.`)}>연결 설정</button>
          </article>
        ))}
      </section>
      <section className="surface readiness-card">
        <div className="readiness-copy"><span className="section-kicker">IMPLEMENTATION READINESS</span><h2>실제 서비스 연결을 위한 준비 항목</h2><p>키는 브라우저 코드에 직접 넣지 않고 Supabase Edge Functions 또는 배포 환경변수에 보관합니다.</p></div>
        <div className="readiness-steps">
          <div><span>1</span><strong>Supabase 프로젝트 생성</strong><small>URL · anon key 준비</small></div>
          <i>→</i>
          <div><span>2</span><strong>DB 스키마 적용</strong><small>테이블 · RLS · Storage</small></div>
          <i>→</i>
          <div><span>3</span><strong>외부 API 키 등록</strong><small>Gemini · Kakao · 날씨 · Resend</small></div>
          <i>→</i>
          <div><span>4</span><strong>실데이터 전환</strong><small>Realtime 구독 활성화</small></div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [toast, setToast] = useState("");
  const current = useMemo(() => navigation.find((item) => item.id === workspace)!, [workspace]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <div><strong>B.SORI</strong><small>BLUE RESOURCE CYCLE</small></div>
        </div>
        <div className="sidebar-project"><span>부산 수산 부산물</span><strong>통합 관리 플랫폼</strong><small><i /> 데모 시스템 운영 중</small></div>
        <nav aria-label="업무 메뉴">
          <span className="nav-label">WORKSPACES</span>
          {navigation.map((item) => (
            <button key={item.id} className={workspace === item.id ? "active" : ""} onClick={() => setWorkspace(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-copy"><strong>{item.label}</strong><small>{item.eyebrow} 화면</small></span>
              <b>›</b>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sync-state"><span className="pulse-dot" /><div><strong>데이터 동기화</strong><small>실시간 연결 준비</small></div></div>
          <button onClick={() => setWorkspace("integrations")}>연동 설정</button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">B</span><strong>B.SORI</strong></div>
          <div className="breadcrumb"><span>B.SORI</span><i>/</i><strong>{current.label}</strong></div>
          <div className="top-actions">
            <span className="demo-chip">DEMO</span>
            <button className="top-icon" aria-label="검색" onClick={() => notify("검색 기능은 Supabase 연결 후 활성화됩니다.")}>⌕</button>
            <button className="top-icon notification" aria-label="알림" onClick={() => notify("새로운 운영 알림이 3건 있습니다.")}>●<i /></button>
            <div className="account"><span>관</span><div><strong>통합 관리자</strong><small>admin@bsori.kr</small></div></div>
          </div>
        </header>

        <div className="content">
          {workspace === "overview" && <AdminOverview notify={notify} />}
          {workspace === "discharger" && <DischargerWorkspace notify={notify} />}
          {workspace === "driver" && <DriverWorkspace notify={notify} />}
          {workspace === "facility" && <FacilityWorkspace notify={notify} />}
          {workspace === "integrations" && <IntegrationsWorkspace notify={notify} />}
        </div>

        <nav className="mobile-nav" aria-label="모바일 업무 메뉴">
          {navigation.slice(0, 4).map((item) => (
            <button key={item.id} className={workspace === item.id ? "active" : ""} onClick={() => setWorkspace(item.id)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
      </section>
      {toast && <div className="toast"><span>✓</span><p>{toast}</p></div>}
    </main>
  );
}
