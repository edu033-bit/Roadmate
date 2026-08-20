# 원본 소스 보존 이관 기록

## 원본 기준

원본은 사용자 로컬의 `jeonnam-planner-mvp`입니다. 실제 활성 화면은 `src/main.tsx`가 렌더링하는 `src/PlannerArtApp.tsx` 및 `src/components/*`, `src/PlannerArt.css`, `src/types.ts`입니다. 실제 API는 `/api/plan/summary`와 `/api/plan/options`이며, `api/plan.mjs`, `server/cache.mjs`, `server/config.mjs`, `server/providers.mjs`, `adapters/*`가 이를 구성합니다.

## 이관 결과

| 영역 | 원본 코드 보존 위치 | 이관 방식 | 원본 변경 여부 |
|---|---|---|---|
| 활성 프런트엔드 | `client/src/original/` | `PlannerArtApp.tsx`, `PlannerArt.css`, `types.ts`, `components/*`를 원본 파일 단위로 복사하고 `client/src/App.tsx`가 직접 렌더링 | 원본 파일 본문 변경 없음 |
| 원본 API·어댑터 | `server/original-backend/` | `api/*`, `adapters/*`, `server/cache.mjs`, `server/config.mjs`, `server/providers.mjs`를 원래의 상대 경로가 유지되도록 복사 | 원본 파일 본문 변경 없음 |
| 배포 런타임 연결 | `server/originalRestRoutes.ts` | 현재 Express 런타임에서 원본 API의 두 경로를 전달하는 호환 브리지 | 신규 파일 |
| 서버 부팅 | `server/_core/index.ts` | 호환 브리지를 등록하는 호출 한 줄 추가 | 배포 템플릿만 변경 |
| 지도 의존성 | `package.json`, `pnpm-lock.yaml` | 원본 `RouteMap.tsx`가 요구하는 `maplibre-gl` 추가 | 배포 템플릿만 변경 |

## 의도적으로 남긴 배포 템플릿 구성

Manus 런타임의 인증, 데이터베이스, 저장소, tRPC 기반 보조 기능은 현재 원본 화면의 렌더링 경로에 개입하지 않습니다. 이 구성은 원본 REST API와 화면을 외부에 노출할 수 있게 하는 컨테이너 역할만 합니다.

## 이전 재구성 코드 상태

이전의 `client/src/pages/Home.tsx`, `shared/planner.ts`, `server/plannerService.ts`, `server/plannerAdapters.ts` 및 tRPC `plan.*` 라우터는 활성 화면이나 원본 API 경로에서 사용되지 않습니다. 이 파일들은 현재 배포 프로젝트 안에 남아 있으므로, 다음 정리 단계에서 원본 보존이 확인된 뒤 별도 제거 또는 `legacy/` 격리 대상으로 다룹니다.

## 검증 기준

브라우저가 원본 브랜딩인 **로드메이트**, 원본 PlannerArt 대시보드와 MapLibre 지도, 원본 `/api/plan/summary`·`/api/plan/options` 요청을 사용하여 추천 카드와 근거 지도를 렌더링하면 이관이 성공한 것으로 판단합니다.

## 컨셉아트 시각 기준

로컬 `art-dashboard-light.png`는 폭 약 488px의 모바일 캔버스를 기준으로, 밝은 회백색 배경, 짙은 남색 타이포그래피, 노란 출발 권장 카드와 버튼, 청록 추천 배지, 고정 하단 노란 CTA를 사용합니다. 배포 화면은 이 시각 기준을 유지하되, 어떤 뷰포트에서도 불필요한 검은 여백이나 잘린 캔버스를 만들지 않아야 합니다.

## UI 복구 검증

복구 후 모바일 화면에서 원본과 같은 밝은 카드 캔버스, 노란 추천 출발 카드, 청록 시간 우선 추천 카드, 노란 고정 CTA가 즉시 표시되는 것을 확인했습니다. 데스크톱에서는 의도된 약 520px 중앙 모바일 캔버스를 어두운 배경 위에 유지하여, 화면 폭이 넓어도 카드가 늘어나거나 잘리지 않게 했습니다. 원본 Noto Sans KR 서체를 로드하고 MapLibre를 Vite 사전 번들링 대상에서 제외해 지도 렌더링 안정성도 보완했습니다.
