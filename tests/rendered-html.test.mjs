import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("B.SORI 앱 셸과 서비스 메타데이터를 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /B\.SORI \| 부산 수산 부산물 AI 자원순환 플랫폼/);
  assert.match(html, /안전한 작업공간을 불러오는 중입니다/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("핵심 실서비스 기능과 보안 경계를 유지한다", async () => {
  const [page, weather, analysis, integrationStatus] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/analyze-waste/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/integrations/status/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /advance_collection_assignment/);
  assert.match(page, /record_facility_receipt/);
  assert.match(page, /complete_processing_result/);
  assert.match(page, /bsori-request-draft-/);
  assert.match(page, /WORKSPACE SWITCHER/);
  assert.match(weather, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(weather, /supabase\.auth\.getUser/);
  assert.match(analysis, /GEMINI_MODEL/);
  assert.match(analysis, /gemini-flash-latest/);
  assert.match(analysis, /supabase\.auth\.getUser/);
  assert.match(integrationStatus, /RESEND_NOTIFICATION_TO/);
  assert.doesNotMatch(integrationStatus, /value|apiKey|secret/i);
});
