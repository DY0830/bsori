# B.SORI 운영 연동 안내

Supabase 로그인, 관리자 초대, 역할별 권한, 부산물 등록, 사진 업로드,
실시간 요청 목록 갱신과 Gemini 사진 분석이 연결되어 있습니다.

## 최초 관리자 생성

1. 배포된 사이트에서 `최초 관리자 설정`을 선택합니다.
2. 관리자 본인의 이메일, 비밀번호, 이름, 전화번호를 입력합니다.
3. Supabase에서 확인 이메일이 발송되면 이메일 인증을 완료합니다.
4. 같은 계정으로 로그인하면 `B.SORI 운영본부` 관리자 프로필이 생성됩니다.

최초 관리자 생성은 관리자 프로필이 한 명도 없을 때만 허용됩니다.
비밀번호는 코드나 문서에 저장하지 않습니다.

## 역할별 계정 생성

일반 사용자는 직접 역할을 고를 수 없습니다.

1. 관리자가 로그인합니다.
2. `연동 관리` 화면의 `사용자 계정 초대`에서 역할과 업체를 선택합니다.
3. 생성된 초대코드를 대상 사용자에게 전달합니다.
4. 대상 사용자가 로그인 화면의 `초대코드로 계정 활성화`에서 가입합니다.

등록된 예시 업체:

- 배출업체: 해원수산
- 수거기사: 부산자원운송
- 자원화시설: B.SORI 자원화센터
- 관리자: B.SORI 운영본부

## 실제 저장 범위

- 배출업체가 등록한 종류, 수량, 희망 수거일, 주소, 메모는
  `public.waste_requests`에 저장됩니다.
- 부산물 사진은 비공개 Storage 버킷 `waste-photos`에 저장됩니다.
- 관리자는 DB의 실제 수거 요청 목록을 확인할 수 있습니다.
- 요청 변경은 Supabase Realtime으로 화면에 반영됩니다.
- 로그인한 배출업체가 사진을 분석하면 서버가 Gemini 3.6 Flash를
  호출하고, 검토한 분석 결과가 요청의 `ai_result`에 함께 저장됩니다.
- 사용자와 조직 접근은 RLS 정책으로 제한됩니다.

## 적용한 SQL

새 Supabase 프로젝트를 다시 구성할 때 아래 순서로 SQL Editor에서 실행합니다.

1. `supabase/schema.sql`
2. `supabase/auth_and_storage.sql`

두 번째 SQL은 예시 업체, 관리자 초대 RPC, 최초 관리자 생성 RPC,
Storage 접근 정책을 추가합니다.

## 외부 API 설정

Gemini 키는 배포 환경의 서버 전용 `GEMINI_API_KEY`에 저장합니다.
키를 브라우저 코드나 Git 저장소에 넣으면 안 됩니다.

## Kakao 지도와 길찾기

- `KAKAO_JAVASCRIPT_KEY`: 서버가 현재 실행 환경에 맞춰 전달하는 지도 키
- `KAKAO_REST_API_KEY`: 서버 주소 검색과 Kakao Mobility 길찾기

운영 사이트와 localhost는 각각 해당 도메인이 등록된 JavaScript 키를
사용합니다. REST 키는 서버 Secret으로만 저장합니다.

카카오디벨로퍼스 앱의 `카카오맵 → 사용 설정` 상태가 `ON`이어야 실제
주소 검색과 지도 API가 작동합니다.

## 아직 별도 키가 필요한 기능

다음 기능은 현재 화면 시연용이며, 실제 연동 시 Secret을 추가해야 합니다.

- 기상청 단기예보: `KMA_SERVICE_KEY`
- 이메일 알림: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

외부 API Secret은 브라우저 코드에 넣지 않고 Supabase Edge Functions 또는
배포 서비스의 Secret으로만 등록합니다.

## Render 배포

프로젝트 루트의 `render.yaml`을 이용해 Render Blueprint로 배포할 수 있습니다.

1. GitHub의 `DY0830/bsori` 저장소가 최신인지 확인합니다.
2. Render에서 **New > Blueprint**를 선택하고 저장소를 연결합니다.
3. Blueprint가 요청하는 환경변수 값을 Render Dashboard에 입력합니다.
4. 배포 후 발급된 `https://...onrender.com` 주소를 Kakao Developers의
   JavaScript SDK 도메인과 Supabase Auth의 Redirect URLs에 추가합니다.

빌드 명령은 `npm ci && npm run build`, 시작 명령은 `npm run start`이며
서버는 Render가 제공하는 `PORT` 환경변수를 자동으로 사용합니다.
