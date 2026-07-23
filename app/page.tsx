"use client";

import { useMemo, useState } from "react";

type View = "overview" | "partners" | "collection" | "energy";

const navItems: { id: View; label: string; mark: string }[] = [
  { id: "overview", label: "통합 현황", mark: "01" },
  { id: "partners", label: "업체 데이터", mark: "02" },
  { id: "collection", label: "수거 운영", mark: "03" },
  { id: "energy", label: "에너지", mark: "04" },
];

const partners = [
  { name: "부산공동어시장", type: "ERP API", last: "방금 전", volume: "3.2t", status: "정상" },
  { name: "해원수산", type: "전자저울", last: "3분 전", volume: "1.7t", status: "정상" },
  { name: "남항수산가공", type: "CSV 자동", last: "12분 전", volume: "980kg", status: "정상" },
  { name: "청해유통", type: "ERP API", last: "1시간 전", volume: "620kg", status: "확인 필요" },
];

const routes = [
  { time: "09:20", place: "부산공동어시장", amount: "1,850kg", state: "수거 완료" },
  { time: "10:10", place: "해원수산", amount: "920kg", state: "이동 중" },
  { time: "11:05", place: "남항수산가공", amount: "760kg", state: "대기" },
  { time: "12:30", place: "B.SORI 처리시설", amount: "3,530kg", state: "반입 예정" },
];

function Metric({
  label,
  value,
  unit,
  change,
  tone = "blue",
}: {
  label: string;
  value: string;
  unit: string;
  change: string;
  tone?: "blue" | "green" | "amber" | "navy";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-dot" />
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-change">{change}</div>
    </article>
  );
}

function Overview() {
  return (
    <>
      <section className="intro">
        <div>
          <div className="eyebrow">2026년 7월 23일 · 부산</div>
          <h1>안녕하세요, 운영팀님.</h1>
          <p>오늘의 자원 순환 과정은 안정적으로 운영되고 있습니다.</p>
        </div>
        <button className="primary-button">운영 보고서 생성</button>
      </section>

      <section className="metrics-grid">
        <Metric label="예상 부산물" value="8.2" unit="t" change="어제보다 12.4% 증가" />
        <Metric label="수거 완료" value="5.6" unit="t" change="전체 예상량의 68%" tone="green" />
        <Metric label="바이오가스" value="720" unit="m³" change="목표 대비 94%" tone="amber" />
        <Metric label="발전량" value="1,240" unit="kWh" change="ESS 충전율 68%" tone="navy" />
      </section>

      <section className="overview-grid">
        <article className="panel flow-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">LIVE FLOW</span>
              <h2>오늘의 자원 순환</h2>
            </div>
            <span className="live-badge"><i /> 실시간</span>
          </div>
          <div className="flow-track">
            {[
              ["발생", "8.2t", "15개 업체"],
              ["수거", "5.6t", "차량 4대"],
              ["가스", "720m³", "메탄 64.8%"],
              ["발전", "1.24MWh", "효율 91%"],
            ].map(([title, value, meta], index) => (
              <div className="flow-step" key={title}>
                <div className="flow-symbol">{index + 1}</div>
                <strong>{title}</strong>
                <b>{value}</b>
                <small>{meta}</small>
              </div>
            ))}
          </div>
          <div className="energy-strip">
            <span>폐기물이 오늘 만든 에너지</span>
            <strong>4인 가구 약 137일 사용량</strong>
            <div className="strip-progress"><i /></div>
          </div>
        </article>

        <article className="panel alert-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">ATTENTION</span>
              <h2>운영 알림</h2>
            </div>
            <span className="count-badge">3</span>
          </div>
          <div className="alert-item warning">
            <span className="alert-icon">!</span>
            <div><strong>청해유통 데이터 지연</strong><small>마지막 동기화 1시간 전</small></div>
            <time>14:02</time>
          </div>
          <div className="alert-item">
            <span className="alert-icon">↗</span>
            <div><strong>2호차 경로 재계산</strong><small>교통 정체로 8분 단축</small></div>
            <time>13:46</time>
          </div>
          <div className="alert-item">
            <span className="alert-icon">✓</span>
            <div><strong>소화조 온도 안정화</strong><small>37.2°C 정상 범위</small></div>
            <time>13:20</time>
          </div>
          <button className="text-button">모든 알림 보기 <span>→</span></button>
        </article>

        <article className="panel forecast-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">AI FORECAST</span>
              <h2>7일 발생량 예측</h2>
            </div>
            <div className="confidence">신뢰도 <strong>91.4%</strong></div>
          </div>
          <div className="chart-wrap">
            <div className="y-labels"><span>10t</span><span>5t</span><span>0</span></div>
            <div className="bar-chart">
              {[64, 72, 68, 82, 88, 76, 70].map((height, i) => (
                <div className="bar-column" key={i}>
                  <div className={`bar ${i === 3 ? "active" : ""}`} style={{ height: `${height}%` }}>
                    {i === 3 && <span>8.2t</span>}
                  </div>
                  <small>{["월", "화", "수", "오늘", "금", "토", "일"][i]}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="insight">
            <span className="spark">✦</span>
            <p><strong>AI 인사이트</strong> 내일 입고량 증가로 부산물은 오늘보다 약 7% 늘어날 전망입니다.</p>
          </div>
        </article>

        <article className="panel route-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">COLLECTION</span>
              <h2>실시간 수거 운영</h2>
            </div>
            <button className="ghost-button">전체 경로</button>
          </div>
          <div className="route-content">
            <div className="mini-map">
              <span className="road r1" /><span className="road r2" /><span className="road r3" />
              <span className="sea-label">부산항</span>
              <span className="pin p1">1</span><span className="pin p2">2</span>
              <span className="pin p3">3</span><span className="facility-pin">B</span>
              <span className="route-line" />
            </div>
            <div className="vehicle-list">
              <div><span className="vehicle-dot active" /><p><strong>1호차</strong><small>수거 완료 · 2.8t</small></p><b>100%</b></div>
              <div><span className="vehicle-dot moving" /><p><strong>2호차</strong><small>해원수산 이동 중</small></p><b>68%</b></div>
              <div><span className="vehicle-dot" /><p><strong>3호차</strong><small>다음 배차 15:10</small></p><b>42%</b></div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

function Partners({ onSync }: { onSync: () => void }) {
  return (
    <>
      <section className="intro">
        <div><div className="eyebrow">PARTNER DATA HUB</div><h1>업체 데이터 연동</h1><p>ERP, 전자저울, 파일 데이터를 하나의 형식으로 관리합니다.</p></div>
        <button className="primary-button" onClick={onSync}>전체 데이터 동기화</button>
      </section>
      <section className="metrics-grid compact">
        <Metric label="연동 업체" value="15" unit="곳" change="이번 달 2곳 추가" />
        <Metric label="오늘 수집 데이터" value="4,820" unit="건" change="오류율 0.2%" tone="green" />
        <Metric label="자동 연동률" value="93" unit="%" change="API·IoT 기준" tone="navy" />
        <Metric label="예측 데이터" value="8.2" unit="t" change="신뢰도 91.4%" tone="amber" />
      </section>
      <section className="panel table-panel">
        <div className="panel-header"><div><span className="section-label">CONNECTIONS</span><h2>업체별 연동 상태</h2></div><button className="ghost-button">+ 업체 연결</button></div>
        <div className="data-table">
          <div className="table-row table-head"><span>업체명</span><span>연동 방식</span><span>마지막 수집</span><span>오늘 데이터</span><span>상태</span></div>
          {partners.map((partner) => (
            <div className="table-row" key={partner.name}>
              <span><i className="company-avatar">{partner.name.slice(0, 1)}</i><strong>{partner.name}</strong></span>
              <span>{partner.type}</span><span>{partner.last}</span><span>{partner.volume}</span>
              <span><b className={partner.status === "정상" ? "status good" : "status warn"}>{partner.status}</b></span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Collection() {
  return (
    <>
      <section className="intro">
        <div><div className="eyebrow">SMART COLLECTION</div><h1>오늘의 수거 운영</h1><p>AI가 12개 지점의 방문 순서와 차량 적재량을 최적화했습니다.</p></div>
        <button className="primary-button">경로 다시 계산</button>
      </section>
      <section className="collection-layout">
        <article className="panel large-map-panel">
          <div className="panel-header"><div><span className="section-label">ROUTE B-02</span><h2>2호차 최적 경로</h2></div><span className="saving">18.4km 절감</span></div>
          <div className="large-map">
            <span className="map-water">BUSAN HARBOR</span>
            <span className="map-road a" /><span className="map-road b" /><span className="map-road c" /><span className="map-road d" />
            <span className="map-pin one">1</span><span className="map-pin two">2</span><span className="map-pin three">3</span><span className="map-pin base">B</span>
            <span className="map-route ar" /><span className="map-route br" /><span className="map-route cr" />
          </div>
        </article>
        <article className="panel schedule-panel">
          <div className="panel-header"><div><span className="section-label">SCHEDULE</span><h2>방문 일정</h2></div><span className="live-badge"><i /> 운행 중</span></div>
          <div className="timeline">
            {routes.map((route, i) => (
              <div className={`timeline-row ${i === 1 ? "current" : ""}`} key={route.time}>
                <time>{route.time}</time><span className="timeline-node">{i + 1}</span>
                <div><strong>{route.place}</strong><small>{route.amount} · {route.state}</small></div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function Energy() {
  return (
    <>
      <section className="intro">
        <div><div className="eyebrow">ENERGY CONTROL</div><h1>바이오에너지 현황</h1><p>부산물에서 생산된 가스와 전기의 흐름을 모니터링합니다.</p></div>
        <button className="primary-button">설비 상세 보기</button>
      </section>
      <section className="energy-grid">
        <article className="panel energy-main">
          <div className="panel-header"><div><span className="section-label">ENERGY FLOW</span><h2>생산·저장 흐름</h2></div><span className="live-badge"><i /> 정상 운영</span></div>
          <div className="energy-flow">
            <div><span className="energy-orb waste">01</span><strong>부산물 투입</strong><b>5.6t</b></div><em>→</em>
            <div><span className="energy-orb gas">02</span><strong>바이오가스</strong><b>720m³</b></div><em>→</em>
            <div><span className="energy-orb power">03</span><strong>전력 생산</strong><b>1.24MWh</b></div><em>→</em>
            <div><span className="energy-orb battery">04</span><strong>ESS 저장</strong><b>68%</b></div>
          </div>
        </article>
        <article className="panel gauge-panel">
          <span className="section-label">DIGESTER 01</span><h2>혐기성 소화조</h2>
          <div className="gauge"><div><strong>37.2</strong><span>°C</span></div></div>
          <div className="sensor-list"><span>pH <b>7.1</b></span><span>압력 <b>1.08bar</b></span><span>가동률 <b>94%</b></span></div>
        </article>
        <article className="panel gauge-panel">
          <span className="section-label">ESS 01</span><h2>에너지 저장장치</h2>
          <div className="battery-display"><div style={{ width: "68%" }} /><strong>68%</strong></div>
          <div className="sensor-list"><span>충전 전력 <b>148kW</b></span><span>SOH <b>96.8%</b></span><span>예상 가용 <b>5.2h</b></span></div>
        </article>
      </section>
    </>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [toast, setToast] = useState("");
  const title = useMemo(() => navItems.find((item) => item.id === view)?.label, [view]);

  const sync = () => {
    setToast("15개 업체의 최신 데이터를 동기화했습니다.");
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>B.SORI</strong><small>RESOURCE INTELLIGENCE</small></div></div>
        <nav aria-label="주요 메뉴">
          <span className="nav-label">OPERATIONS</span>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <span>{item.mark}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="side-card"><span>오늘의 감축 효과</span><strong>2.8t CO₂e</strong><small>소나무 424그루의 하루 흡수량</small><div><i /></div></div>
        <div className="user-card"><span>운</span><div><strong>통합 운영팀</strong><small>시스템 관리자</small></div><button aria-label="사용자 메뉴">•••</button></div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">B</span><strong>B.SORI</strong></div>
          <div className="breadcrumb">B.SORI <span>/</span> {title}</div>
          <div className="top-actions"><button className="icon-button" aria-label="검색">⌕</button><button className="icon-button notification" aria-label="알림">●</button><span className="system-ok"><i /> 모든 시스템 정상</span></div>
        </header>
        <div className="content">
          {view === "overview" && <Overview />}
          {view === "partners" && <Partners onSync={sync} />}
          {view === "collection" && <Collection />}
          {view === "energy" && <Energy />}
        </div>
        <nav className="mobile-nav" aria-label="모바일 메뉴">
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.mark}</span>{item.label}</button>)}
        </nav>
      </section>
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
