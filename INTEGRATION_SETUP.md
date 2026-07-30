# B.SORI 실제 서비스 연동 안내

현재 웹은 별도 계정이나 API 키 없이 모든 역할을 확인할 수 있는 데모 모드입니다.
아래 설정이 준비되면 화면의 샘플 데이터를 실제 Supabase 데이터로 교체할 수 있습니다.

## 1. Supabase

필요한 값:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 또는 Edge Functions 전용)

설정 순서:

1. Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Authentication에서 Email 로그인을 활성화합니다.
4. Storage에서 비공개 버킷 `waste-photos`, `evidence`를 생성합니다.
5. 프로젝트 URL과 anon key를 로컬 `.env`에 등록합니다.
6. service role key는 브라우저에 노출하지 않고 Edge Functions secret으로만 등록합니다.

## 2. Gemini

필요한 값:

- `GEMINI_API_KEY`

용도:

- 부산물 사진에서 종류와 상태 추정
- 계량표, 인수증 등 문서에서 중량과 날짜 추출
- 결과를 JSON으로 변환한 뒤 담당자 검증을 거쳐 저장

Gemini 호출은 브라우저에서 직접 하지 않고 Supabase Edge Function에서 처리해야 합니다.

## 3. Kakao

필요한 값:

- `KAKAO_JAVASCRIPT_KEY`
- `KAKAO_REST_API_KEY`
- `KAKAO_MOBILITY_REST_API_KEY`

용도:

- JavaScript key: 웹 지도와 마커 표시
- REST API key: 주소를 위도·경도로 변환
- Mobility key: 이동 경로, 거리, 예상 시간 계산

## 4. 기상청과 Resend

필요한 값:

- `KMA_SERVICE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

기상청 API는 수거 지역의 강수와 강풍 위험을 판단하는 데 사용합니다.
Resend는 수거 요청, 배차, 지연, 완료 이메일을 발송하는 데 사용합니다.

## 5. 다음 구현 단계

1. Supabase 로그인 및 역할별 라우팅
2. 부산물 등록과 Storage 사진 업로드
3. Realtime 수거 상태 구독
4. Gemini 분석 Edge Function
5. Kakao 지도와 경로 계산 Edge Function
6. 기상 위험 배지
7. Resend 상태 알림

실제 키를 전달할 때는 채팅에 붙여 넣지 말고 로컬 `.env` 또는 서비스의 Secret 설정에 직접 등록해야 합니다.
