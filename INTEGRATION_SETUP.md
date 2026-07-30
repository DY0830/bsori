# B.SORI 운영 연동 안내

Supabase 로그인, 관리자 초대, 역할별 권한, 부산물 등록, 사진 업로드,
실시간 요청 목록 갱신이 연결되어 있습니다.

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
- 사용자와 조직 접근은 RLS 정책으로 제한됩니다.

## 적용한 SQL

새 Supabase 프로젝트를 다시 구성할 때 아래 순서로 SQL Editor에서 실행합니다.

1. `supabase/schema.sql`
2. `supabase/auth_and_storage.sql`

두 번째 SQL은 예시 업체, 관리자 초대 RPC, 최초 관리자 생성 RPC,
Storage 접근 정책을 추가합니다.

## 아직 별도 키가 필요한 기능

다음 기능은 현재 화면 시연용이며, 실제 연동 시 Secret을 추가해야 합니다.

- Gemini 분석: `GEMINI_API_KEY`
- Kakao 지도: `KAKAO_JAVASCRIPT_KEY`
- Kakao 주소 검색: `KAKAO_REST_API_KEY`
- Kakao Mobility 경로: `KAKAO_MOBILITY_REST_API_KEY`
- 기상청 단기예보: `KMA_SERVICE_KEY`
- 이메일 알림: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

외부 API Secret은 브라우저 코드에 넣지 않고 Supabase Edge Functions 또는
배포 서비스의 Secret으로만 등록합니다.
