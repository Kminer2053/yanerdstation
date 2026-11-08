# 야!너두 스테이션 · Ya! Nerd Station

역의 모습이 바뀌면, 지도를 쓰는 사람도 그 변화를 제보할 수 있습니다. 야!너두 스테이션은 브이월드 실내 3D 지도에 현장 사진과 시설·보행 정보를 겹쳐 보여 줍니다. 서울역에서는 이 지도로 길을 찾고, 상권을 살피고, 운영 상황을 검토합니다.

https://github.com/user-attachments/assets/6132e697-503f-4393-9074-0204130b4b73

[시연영상 MP4 · 4분 58초 · 720p · 9.6 MB](./demo/yanerdstation-demo-720p.mp4) · [영상 미리보기 이미지](./demo/poster.jpg)

[프로젝트 소개](https://yanerdstation.kr) · [서울역 3D 지도](https://seoul.yanerdstation.kr/seoul/) · [서울역 여행 체험](https://seoul.yanerdstation.kr/commons/) · [공개 제보·편집기](https://toolkit.yanerdstation.kr/)

## 서울역에서 해 볼 수 있는 일

| 화면 | 실제 사용 흐름 |
| --- | --- |
| [철도 이용객 · 3D 내비](https://seoul.yanerdstation.kr/seoul/?role=visitor) | 출발점과 시설을 고르고 층간 경로를 확인합니다. 따라 걷기를 켜면 이동하기 전에 계단과 맞이방을 둘러볼 수 있습니다. |
| [사업자 · 역내 상권 분석](https://seoul.yanerdstation.kr/seoul/?role=business) | 구역과 매장을 골라 시간대별 통행 흐름과 가공 매출 지표를 비교합니다. |
| [철도기관 · 운영관리](https://seoul.yanerdstation.kr/seoul/?role=manager) | 여러 층의 이동 흐름을 보고 상황 카드에서 판단 근거와 점검 위치를 확인합니다. |
| [COMMONS · 서울역 여행](https://seoul.yanerdstation.kr/commons/) | 2·3층 경량 지도를 혼자 걷거나 같은 방에 들어온 사람과 둘러봅니다. 여행 여권을 따라 매장과 사진 명소를 방문할 수 있습니다. |

## 현장 제보가 지도에 반영되기까지

공개 제보에서는 연결된 46개 KTX역 중 역과 층을 골라 현장 사진과 설명을 보냅니다. 제보함에서 처리 상태를 확인하고, 상세 편집기에서 구조물·파사드·시설과 층간 연결을 다룹니다. 지도에는 승인한 변경 레이어를 얹어 브이월드 원형을 보존합니다. [공개 제보](https://toolkit.yanerdstation.kr/) · [제보함](https://toolkit.yanerdstation.kr/console/) · [상세 편집기](https://toolkit.yanerdstation.kr/editor/)

담당자는 필요한 경우 제보함을 MCP로 Codex에 연결해 사진 보정과 배치 초안을 맡깁니다. 위치나 규격이 불분명하면 현장 정보를 보완하고, 3D 미리보기에서 변경 범위를 확인한 뒤 승인합니다. 대전역 3층 스토리웨이 사례에서는 제보 사진을 바탕으로 매장 정면을 보정하고 넓어진 구간을 공개 지도에 반영했습니다. [Codex 사진 수정안과 승인 절차](./toolkit/docs/release-codex-photo-drafts-2026-11-06.md)

MCP 작업자는 할당된 작업의 초안을 작성합니다. 공개 지도에 반영하는 최종 승인은 제보함의 승인자가 합니다. 서버에서 AI 제공자를 호출하는 자동 작업은 별도 설정이 필요한 기능입니다. 개발 단계에서는 ChatGPT로 기능을 검토하고 Codex와 Claude Code로 서비스 구현을 진행했습니다.

## 저장소 구성

```text
yanerdstation/
├── service/   랜딩, Station One 서울역, COMMONS, 서비스 Worker
├── toolkit/   공개 제보, 제보함, 상세 편집기, 편집기 Worker와 MCP
├── demo/      시연영상 경량본과 포스터
└── docs/      통합 저장소 안내와 소스 출처
```

`service/`와 `toolkit/`는 각각 설치하고 빌드합니다.

### 이 통합본의 기준

| 경로 | 가져온 소스 |
| --- | --- |
| `service/` | 서울역·랜딩 운영 Sites v83, `7e5223686a5ef694327750d196c68ef5af9a2daa` |
| `toolkit/` | 편집기 운영 Sites v26, `caaed434443036f264f9d78ac6b0936917e6dbf3` |
| `demo/` | 2026년 11월 8일 기능 시연 편집본, 1280×720·30fps |

이 저장소는 2026 공공 AI 대전환 챌린지 제출 후 정리한 통합판입니다. 운영 기준과 공개본의 차이는 [통합 기록](./docs/source-baseline.md)에 적었습니다.

## 로컬 실행

Node.js **22.13 이상**과 최신 브라우저가 필요합니다. 정밀 지도를 열 때는 브이월드 타일과 CesiumJS를 받을 수 있도록 인터넷에 연결합니다. 두 터미널을 저장소 루트에서 열어 각각 실행합니다.

```bash
# 터미널 1 · 랜딩과 서울역 서비스
cd service
npm ci
npm exec -- vite --host 127.0.0.1 --port 4196 --strictPort
```

```bash
# 터미널 2 · 제보, 제보함과 편집기
cd toolkit
npm ci
npm run dev
```

| 로컬 주소 | 화면 |
| --- | --- |
| [127.0.0.1:4196](http://127.0.0.1:4196/) | 소개 페이지 |
| [127.0.0.1:4196/seoul/](http://127.0.0.1:4196/seoul/?role=visitor) | 서울역 정밀 서비스 |
| [127.0.0.1:4196/commons/](http://127.0.0.1:4196/commons/) | 서울역 여행 체험 |
| [127.0.0.1:4197](http://127.0.0.1:4197/) · [/console/](http://127.0.0.1:4197/console/) · [/editor/](http://127.0.0.1:4197/editor/) | 공개 제보 · 제보함 · 편집기 |

편집기에서 서울역을 볼 때 서비스의 4196 포트를 사용합니다. 두 앱은 로컬 SQLite에 시험 데이터를 저장하고, 편집기가 받은 파일은 `toolkit/data-private/uploads/`에 보관합니다. 개발 서버가 만든 시험 승인자 계정은 `toolkit/data-private/local-approvers.txt`에서 확인합니다. 시험 제보·보류·승인은 로컬 주소에서 진행합니다.

### 환경 설정

| 설정 | 사용하는 곳 | 예시·용도 |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | `service/.env.local` | 기존 협업 카탈로그에 연결할 때만 `service/.env.example`을 복사합니다. `https://YOUR_PROJECT_REF.supabase.co`, `sb_publishable_YOUR_KEY` 자리에 시험 프로젝트 값을 넣습니다. `VITE_` 값은 브라우저에 노출됩니다. |
| `APPROVERS` | 편집기 Worker 비밀 설정 | 승인자 계정 목록. 형식은 `TEST_APPROVER:YOUR_TEST_PASSWORD`입니다. 로컬 실행에는 자동 생성 시험 계정을 쓸 수 있습니다. |
| `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL` | 편집기 Worker 설정 | 선택형 자동 작업에서만 별도 시험 키·제공자(`anthropic` 또는 `openai`)·이미지 입력 모델 ID를 지정합니다. 키는 Worker 비밀 값으로 관리합니다. |

운영 배포는 Sites에서 서비스의 D1과 편집기의 D1·R2를 각각 연결합니다. 저장소에는 배포 코드와 추적 중인 자산이 들어 있습니다. 운영 DB·업로드 저장소와 비밀 설정은 각 운영 환경에서 관리합니다.

### 검증과 빌드

```bash
# service/에서
npm run test:intro
npm run test:experience
npm run test:manager
npm run test:operations
npm run test:commons
npm run test:commons-game
npm run build
```

```bash
# toolkit/에서
npm test
npm run test:reports
npm run test:codex-worker
npm run test:facade-slots
npm run build
```

빌드 결과는 각 앱의 `dist/client/`와 `dist/server/index.js`에 생깁니다. 앱별 운영 조건과 추가 검사는 [서비스 운영 문서](./service/docs/PROJECT_OPERATIONS.md)와 [편집기 문서](./toolkit/README.md)에 있습니다.

## 자료의 범위와 이용 조건

- 공간의 바탕은 브이월드 실내 3D 지도입니다. 정밀 뷰어는 타일을 읽어 오고, COMMONS는 서울역 2·3층의 경량 파생 자산을 사용합니다.
- 교통 유동은 공개 교통자료를 가공하고 일부 원점을 추정한 값입니다. 체류 인원과 화면의 보행자는 모형을 따른 추정·시뮬레이션입니다. 상권 화면의 매출은 패턴을 보존한 가공 수치입니다.
- 공개 편집기 코드의 MIT 조건은 [편집기 LICENSE](./toolkit/LICENSE)를 따릅니다. 브이월드, 현장 사진, 교통 데이터, 외부 모델과 글꼴은 각 자료에 적용되는 이용 조건을 따릅니다.
