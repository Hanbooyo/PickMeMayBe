# PickMeMaybe

PickMeMaybe는 AI 연출형 추첨 콘텐츠 생성 플랫폼입니다.

단순히 당첨자를 뽑는 도구가 아니라, 공정하게 확정된 추첨 결과를 방송형 그래픽과 영상 연출로 표현하는 것을 목표로 합니다. MVP는 Excel 명단 또는 수기 입력 참가자 목록과 사전에 준비된 참가자 이미지 리소스를 사용해 개표방송 스타일의 가로형 winner reveal 영상을 생성하는 방향으로 시작합니다.

## Project Overview

핵심 목표는 다음과 같습니다.

- 참가자 명단을 Excel 업로드 또는 수기 입력으로 등록합니다.
- 참가자 이름을 기준으로 보유 이미지 리소스를 매칭합니다.
- 동명이인이 있으면 이메일을 기준으로 보조 매칭합니다.
- 이미지가 없는 참가자는 anonymous placeholder를 사용합니다.
- crypto 기반 추첨 로직으로 실제 당첨자를 먼저 확정합니다.
- 확정된 결과를 election broadcast 스타일의 영상 연출로 표현합니다.
- MVP 출력은 16:9 가로형 영상을 우선합니다.

중요 원칙:

```text
Fair raffle first, dramatic presentation second.
추첨은 공정하게 먼저 확정하고, 연출은 그 결과를 표현합니다.
```

## MVP Scope

MVP에서 우선 구현할 범위입니다.

- Manual participant input
- Excel roster import
- Participant normalization
- Face/resource image matching
- Anonymous image fallback
- Crypto-based raffle engine
- Presentation scenario generation
- Election-broadcast-inspired reveal template
- Remotion-based rendering
- Render history structure
- Test harness for raffle, participant input, asset matching, and rendering props

단체사진 업로드, 얼굴 감지, segmentation, TTS, AI 사회자, 실시간 행사 모드는 후속 확장 기능으로 둡니다.

## Participant Input

참가자 입력 경로는 두 가지를 지원합니다.

```text
1. Manual input
2. Excel upload
```

MVP 구현 우선순위는 수기 입력입니다. Excel 업로드는 대량 입력 편의 기능으로 후속 단계에서 붙입니다.

Excel 업로드:

- 다수 참가자를 한 번에 등록합니다.
- 예상 컬럼은 `이름`, `이메일`, `부서`, `응모자산`, `입력시간`입니다.
- 파일 파싱 후 내부 `Participant` 모델로 정규화합니다.

수기 입력:

- 사용자가 화면에서 참가자를 직접 추가합니다.
- 기본 행을 제공하고, `+ 참가자 추가` 버튼으로 인원을 늘릴 수 있어야 합니다.
- 각 행의 삭제 버튼 또는 `- 마지막 행 제거` 기능으로 인원을 줄일 수 있어야 합니다.
- 필수값은 `이름`입니다.
- 선택값은 `이메일`, `부서`, `응모자산`입니다.
- 수기 입력의 `입력시간`은 저장 시점으로 자동 생성합니다.

수기 입력 UI 방향:

```text
[ Excel 업로드 ] [ 수기 입력 ]

No | 이름 | 이메일 | 부서 | 응모자산 | 삭제
1  |      |        |      |          | 삭제
2  |      |        |      |          | 삭제

[+ 참가자 추가] [- 마지막 행 제거] [다음 단계]
```

Excel과 수기 입력은 서로 다른 입력 경로이지만, 이후 단계에서는 같은 `Participant` 모델로 처리합니다.

```text
Participant Input
  -> Participant normalization
  -> Asset matching
  -> Raffle execution
  -> Presentation scenario
  -> Video rendering
```

## Tech Stack

현재 계획 중인 기술스택입니다.

| Area | Primary Choice | Notes |
| --- | --- | --- |
| Language | TypeScript | shared type, frontend, backend, renderer를 같은 언어로 관리 |
| Package Manager | npm workspaces | 초기 구조 단순화 |
| Frontend | React + Vite 예정 | 참가자 관리, 명단 업로드, 수기 입력, 추첨 실행, 렌더링 상태 UI |
| Backend | Node.js API 예정 | 파일 처리, 추첨 실행, render job 관리 |
| Renderer | Remotion 예정 | React 기반 영상 composition과 MP4 렌더링 |
| Database | SQLite 예정 | MVP 로컬/단일 인스턴스 저장에 적합 |
| Raffle Logic | Node crypto 예정 | 실제 추첨 공정성 확보 |
| Participant Input | Excel parser + manual form 예정 | Excel 업로드와 수기 입력을 같은 모델로 정규화 |
| Asset Matching | Local resource matching | 이름 우선, 동명이인은 이메일 대조 |
| Testing | Vitest 예정 | core logic, parser, matcher, render props 검증 |
| E2E | Playwright 예정 | 웹 UI와 핵심 사용자 흐름 검증 |

## Workspace Layout

```text
apps/
  web/
    src/
  api/
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
```

역할 분리:

- `apps/web`: 사용자 화면
- `apps/api`: API 서버와 job orchestration
- `apps/renderer`: Remotion composition과 영상 렌더링
- `packages/shared`: 공통 타입과 schema
- `packages/raffle-engine`: 공정 추첨 로직
- `packages/roster-import`: Excel 명단 파싱, 수기 입력 정규화, 참가자 입력 검증
- `packages/asset-matcher`: 참가자 이미지 리소스 매칭
- `packages/presentation-engine`: 연출 시나리오와 timeline 생성
- `packages/render-types`: renderer 입력/출력 타입

## Roster Rules

MVP 기준 Excel 컬럼은 다음을 예상합니다.

```text
이름
이메일
부서
응모자산
입력시간
```

이미지 매칭 우선순위:

```text
1. 이름 기준 매칭
2. 동명이인 발생 시 이메일 기준 매칭
3. 필요 시 이름 + 부서 기준 보조 매칭
4. 매칭 실패 시 anonymous placeholder 사용
```

## Presentation Direction

첫 번째 연출 모드는 대한민국 개표방송에서 영감을 받은 `Election Broadcast Reveal`입니다.

예상 화면 요소:

- 방송형 상단 타이틀
- 후보자 카드
- 실시간 집계 그래프 느낌의 animated bars
- 하단 ticker
- 최종 당첨자 reveal panel
- spotlight, glow, confetti
- 16:9 landscape composition

추후 확장 가능한 presentation mode:

- Rock Paper Scissors
- Ladder Game
- Horse Race
- Running Race
- Dice Roll
- Roulette
- Tournament Bracket

각 모드는 실제 추첨 결과를 다시 계산하지 않고, 이미 확정된 `RaffleResult`를 표현하는 역할만 담당합니다.

## Development

의존성 설치:

```powershell
npm.cmd install
```

PowerShell 실행 정책에 따라 `npm`이 차단될 수 있으므로 Windows에서는 `npm.cmd` 사용을 권장합니다.

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

현재 `test`는 TypeScript 빌드 후 Node test runner로 핵심 로직 테스트를 실행합니다.

Preview report 생성:

```powershell
npm.cmd run demo:preview
```

이 명령은 샘플 수기 입력 데이터를 사용해 다음 파이프라인을 실행하고 `reports/preview-report.json`, `reports/preview.html` 파일을 생성합니다.

```text
roster normalization
-> asset matching
-> fair raffle
-> broadcast scenario
-> renderer preview model
```

## Testing Plan

향후 테스트는 다음 범위로 구성합니다.

- `raffle-engine`: 중복 없는 당첨자 선정, 후보자 검증, 예외 처리, 대량 참가자 처리
- `roster-import`: Excel 컬럼 파싱, 수기 입력 정규화, 누락값 처리, 동명이인 처리
- `asset-matcher`: 이름 우선 매칭, 이메일 fallback, anonymous fallback
- `presentation-engine`: timeline 생성, winner reveal frame, scenario consistency
- `renderer`: render props validation, output metadata validation, snapshot frame validation
- `web/api`: 핵심 사용자 흐름 smoke test

테스트 하네스 구조 예정:

```text
tests/
  fixtures/
  mocks/
  validators/
  reports/
  harness/
```

## Current Status

현재는 프로젝트 기본 구조와 공통 설계를 잡는 단계입니다.

완료:

- npm workspace 초기화
- TypeScript 설정
- 앱/패키지 폴더 구조 생성
- MVP 방향 문서화
- 참가자 입력 경로 설계

다음 추천 티켓:

```text
shared types/schema 정의
```

이 티켓에서는 `Participant`, `RosterRow`, `VisualAsset`, `RaffleResult`, `PresentationScenario`, `RenderJob` 타입을 먼저 정의합니다.
