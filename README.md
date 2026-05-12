# PickMeMaybe

PickMeMaybe는 AI 연출형 추첨 콘텐츠 생성기를 목표로 하는 TypeScript 기반 MVP입니다.

단순히 당첨자를 뽑는 프로그램이 아니라, 공정한 추첨 결과를 선거 개표방송 스타일의 화면과 MP4 영상으로 표현하는 흐름을 우선 구현합니다. 초기 MVP는 생성형 영상 모델에 의존하지 않고, 참가자 명단, 얼굴 리소스, 애니메이션 템플릿, Remotion 렌더링을 조합하는 방식입니다.

```text
Fair raffle first, dramatic presentation second.
추첨은 공정하게 먼저 확정하고, 연출은 그 결과를 극적으로 보여줍니다.
```

## Project Overview

핵심 목표:

- 참가자를 수동 입력 또는 Excel 파일로 등록합니다.
- 참가자 이름을 우선 기준으로 얼굴 이미지 리소스를 매칭합니다.
- 동명이인은 이메일을 보조 기준으로 사용합니다.
- 이미지가 없는 참가자는 `anonymous.svg`를 사용합니다.
- 웹에서 사용 가능한 얼굴 리소스와 참가자별 매칭 상태를 확인합니다.
- crypto 기반 랜덤으로 실제 당첨자를 공정하게 선정합니다.
- 추첨 결과를 election broadcast 스타일 preview와 MP4 렌더로 출력합니다.
- 생성된 MP4 목록을 웹에서 확인하고 다운로드합니다.

## MVP Scope

현재 MVP 범위:

- Manual participant input
- Excel roster import
- Participant normalization
- Face/resource image matching
- Face resource listing
- Participant asset match status summary
- Anonymous image fallback
- Crypto-based raffle engine
- Previous winner exclusion option
- Presentation scenario generation
- Election-broadcast-inspired reveal template
- Remotion-based MP4 rendering
- Render artifact validation
- Render job status polling
- Render output list and download
- API/web/test harness

아직 MVP 밖의 확장 기능:

- 단체사진 업로드
- 얼굴 감지와 segmentation
- 사람별 motion compositing
- TTS/AI 사회자
- 자동 자막
- QR 참가
- 실시간 행사 모드
- 가위바위보, 사다리, 경마, 달리기, 주사위 등 추가 연출 모드

## Tech Stack

| Area | Current Choice | Notes |
| --- | --- | --- |
| Language | TypeScript | API, web, renderer, shared packages 공통 사용 |
| Package Manager | npm workspaces | `apps/*`, `packages/*` monorepo |
| Frontend | Static web + TypeScript | MVP용 수동 입력, preview, resource/match 확인, render control UI |
| Backend | Node.js HTTP server | 외부 framework 없이 endpoint를 작게 구성 |
| Renderer | Remotion | React 기반 composition과 MP4 렌더링 |
| Raffle Logic | Node/Web Crypto | 공정 추첨용 crypto random |
| Roster Import | `xlsx` + manual form | Excel 업로드와 수동 입력 모두 지원 |
| Storage | Local filesystem | `data/renders`, `data/render-inputs` |
| Testing | TypeScript build + Node test runner | core logic, API, render validation smoke tests |

## Workspace Layout

```text
apps/
  api/
    src/
  web/
    src/
  renderer/
    src/

packages/
  shared/
    src/
  raffle-engine/
    src/
  roster-import/
    src/
  asset-matcher/
    src/
  presentation-engine/
    src/
  render-types/
    src/
  render-validation/
    src/

resources/
  faces/

tests/
```

주요 역할:

- `apps/api`: preview 생성, Excel parsing, 얼굴 리소스 조회, render job orchestration, MP4 목록/다운로드 API
- `apps/web`: 참가자 입력, 추첨 실행, 얼굴 리소스/매칭 상태 확인, preview, render job polling, MP4 다운로드 UI
- `apps/renderer`: Remotion composition, sample/latest render execution
- `packages/raffle-engine`: 공정 추첨 로직
- `packages/roster-import`: Excel/수동 입력 정규화
- `packages/asset-matcher`: 이름/이메일 기반 이미지 매칭
- `packages/presentation-engine`: 개표방송 스타일 scenario/timeline 생성
- `packages/render-types`: renderer input/output 타입
- `packages/render-validation`: MP4 산출물 검증

## Participant Input

지원 입력 경로:

```text
1. Manual input
2. Excel upload
3. Excel paste
```

수동 입력이 MVP 우선 경로입니다. 웹 화면에서 참가자를 추가/삭제하고, 이름/이메일/부서/응모자산을 직접 수정할 수 있습니다.

Excel 예상 컬럼:

```text
이름
이메일
부서
응모자산
입력시간
```

매칭 우선순위:

```text
1. 이름 기준 매칭
2. 동명이인 발생 시 이메일 기준 보조 매칭
3. 필요 시 이름 + 부서 기준 확장 가능
4. 매칭 실패 시 anonymous placeholder 사용
```

웹 preview는 추첨 실행 후 `Asset matches` 패널에 참가자별 이미지 경로와 매칭 방식을 표시합니다. 상단 요약에서 실제 매칭된 참가자 수와 anonymous fallback 수를 확인할 수 있습니다.

얼굴 리소스는 `resources/faces` 디렉터리에서 읽습니다. `POST /api/manual-preview` 요청에 별도 `resources`가 없으면 API가 이 디렉터리의 이미지 목록을 자동으로 매칭 후보로 사용합니다. 현재 지원 확장자는 다음과 같습니다.

```text
svg
png
jpg
jpeg
webp
```

## Render Flow

현재 렌더 흐름:

```text
Manual/Excel input
-> normalize participants
-> match visual assets
-> draw winners with crypto random
-> create election broadcast scenario
-> create render props
-> enqueue render job
-> Remotion MP4 render
-> validate MP4 artifact
-> list/download render output
```

웹에서는 `Render latest` 버튼을 누르면 API가 최신 추첨 preview를 기반으로 render job을 생성합니다. 웹은 `GET /api/render-jobs/:id`를 polling해서 `queued`, `running`, `done`, `failed` 상태를 표시하고 완료 후 MP4 목록을 갱신합니다.

## Development

의존성 설치:

```powershell
npm.cmd install
```

빌드:

```powershell
npm.cmd run build
```

타입 체크:

```powershell
npm.cmd run typecheck
```

테스트:

```powershell
npm.cmd test
```

샘플 MP4 렌더:

```powershell
npm.cmd run render:sample
```

기본 출력:

```text
data/renders/election-broadcast-sample.mp4
```

렌더 보관 정책:

- API render job 이력은 기본 20개까지 유지합니다.
- `data/renders`의 MP4 산출물은 기본 20개까지 유지합니다.
- `data/render-inputs`의 최신 렌더 입력 JSON은 기본 20개까지 유지합니다.
- 웹 UI의 render job polling은 장시간 멈춘 작업에서 무한 대기하지 않도록 제한됩니다.

## Demo

권장 시연 순서:

```powershell
# terminal 1
npm.cmd run demo:api

# terminal 2
npm.cmd run demo:web
```

웹 주소:

```text
http://localhost:4318/apps/web/index.html
```

시연 흐름:

1. 웹에서 참가자를 수동 입력하거나 Excel 파일을 업로드합니다.
2. 당첨 인원과 과거 당첨자 허용 여부를 설정합니다.
3. `추첨 실행`을 누릅니다.
4. preview에서 당첨 결과와 `Asset matches` 매칭 요약을 확인합니다.
5. `Render latest`를 누릅니다.
6. render job 상태가 완료될 때까지 기다립니다.
7. `Render outputs` 목록에서 생성된 MP4를 확인합니다.
8. `Download MP4` 링크로 영상을 다운로드합니다.

## API

주요 endpoint:

```text
GET  /health
GET  /api/history
GET  /api/resources/faces
POST /api/manual-preview
POST /api/parse-roster-file
GET  /api/renders
GET  /api/renders/:fileName
POST /api/render-sample
POST /api/render-latest
POST /api/render-latest-jobs
GET  /api/render-jobs/:jobId
```

렌더 관련 endpoint:

- `GET /api/resources/faces`: 로컬 얼굴 이미지 리소스 목록 조회
- `GET /api/renders`: 검증된 MP4 산출물 목록 조회
- `GET /api/renders/:fileName`: MP4 다운로드
- `POST /api/render-sample`: 샘플 props 기반 렌더
- `POST /api/render-latest`: 최신 preview 기반 동기 렌더
- `POST /api/render-latest-jobs`: 최신 preview 기반 비동기 render job 생성
- `GET /api/render-jobs/:jobId`: render job 상태 조회

## Testing Plan

현재 테스트 범위:

- `raffle-engine`: winner count, duplicate participant, previous winner exclusion
- `roster-import`: Excel table parsing, paste parsing, manual input helpers
- `asset-matcher`: name/email matching, anonymous fallback, match status summary
- `presentation-engine`: scenario consistency, timeline validation
- `render-types`: render props and video settings
- `render-validation`: MP4 signature and size validation
- `api`: manual preview, Excel parsing, face resource list, render list/download, render job status
- `web`: static web page smoke test, resource/match panel smoke coverage

현재 검증 명령:

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

## Current Status

MVP 진행률: 약 95%

완료된 핵심 흐름:

```text
participant input
-> fair raffle
-> preview
-> asset match status
-> latest render job
-> MP4 artifact validation
-> web list/download
```

다음 우선순위:

1. Remotion template 시각 품질 개선
2. 실제 이미지 업로드/관리 UX
3. 단체사진/개별 얼굴 리소스 기반 compositing pipeline 설계
4. 추가 추첨 연출 모드 확장
5. MVP 마감 전 코드 리뷰와 리스크 정리
