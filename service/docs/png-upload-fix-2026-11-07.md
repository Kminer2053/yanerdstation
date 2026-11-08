# 스크린샷 PNG 첨부 오류 수정

2026-11-07 사용자 요청으로 **PNG 첨부 거절 오류만 즉시 수정**했다. 앞서 기록한 단일 화면 작업 흐름·연결 관리·지도 캡처/붙여넣기 개선은 계속 보류한다.

## 원인과 변경

기존 `checkPng`는 macOS 스크린샷에 포함되는 `iCCP`, `cICP`, `eXIf`, `iTXt`, `iDOT` 등의 부가 청크를 발견하면 사진 전체를 거절했다. 공통 이미지 처리에서 알려진 프로필·텍스트·기타 메타데이터 8종을 디코더에 넘기기 전에 제거하도록 바꿨다. 압축 메타데이터 자체를 풀지 않으며, 원본 픽셀의 IDAT 바이트와 RGBA 데이터는 유지한다.

- 모든 청크의 CRC·길이를 검사한다. 기존 8비트·비인터레이스 형식, 이미지 크기·파일 용량·픽셀 압축 해제 한도는 유지한다.
- 팔레트·APNG·투명색 등 기존에 지원하지 않던 형식은 조용히 버리지 않고 기존처럼 거절한다.
- 업로드 원본은 기존과 같이 비공개 R2에 보관한다. 이 변경은 원본 삭제나 색 프로필 변환 기능이 아니다.
- UI와 작성 중 글·첨부, 승인자·에이전트 연결, 작업 상태와 최종 승인 절차는 변경하지 않았다. 현재 열린 화면의 **다시 전송**으로 실패한 첨부만 다시 올릴 수 있다. 메모리 입력이 사라질 수 있는 새로고침은 필요 없다.

## 검증

- 사용자 제공 macOS PNG `1676×776`, `201,739 bytes`에서 기존 거절을 재현하고 수정 후 디코드·IDAT 동일성을 확인했다. 원본을 Git에 복사하지 않았다.
- 같은 실제 PNG를 메모리 D1/R2의 Worker 첨부 API에 보내 HTTP 201, 인증된 원본 다운로드의 바이트 동일성, 익명 접근 HTTP 401을 확인했다. 운영 제보나 채팅에 시험 파일을 추가하지 않았다.
- `node tools/test-work-images.mjs`: 합성 메타데이터 제거, 압축 메타데이터 무해제, 픽셀·투명도 보존, CRC·형식·순서·용량·IDAT 압축 해제 제한 통과.
- `node tools/test-ai-work.mjs`, `node tools/test-chat-work.mjs`: 기존 사진 작업 및 실제 첨부 경로 회귀 통과.
- 공식 Sites 빌드·패키징 통과. 배포 번들에 새 검사 코드가 포함되고 기존 메타데이터 거절 문구가 제거된 것을 확인했다.

## 소스와 배포

- 공개 편집기 커밋: [a8a150ce0f168b65bd7c1bd945b36b0c78ae16f5](https://github.com/Kminer2053/ya-nerd-station/commit/a8a150ce0f168b65bd7c1bd945b36b0c78ae16f5), `codex/codex-photo-workflow`.
- 기존 Toolkit 프로젝트 `appgprj_6aacb0b2bb8c8191a8e2936752f33069`의 v16으로 저장했다. D1·R2·MCP와 공개 범위, 환경 설정은 유지한다. 서울역 서비스는 배포하지 않는다.
- 저장 버전: `appgprj_6aacb0b2bb8c8191a8e2936752f33069~appgver_c479c4fe0ff881919d9e4a55738c9383`.
- 배포: `appgdep_6aedf637bf70819192519e1b39d775d6` — `succeeded`, 환경 revision 2, MCP 활성 상태 확인 완료.
- 운영 주소: https://toolkit.yanerdstation.kr (Sites 반환 주소: https://ya-nerd-station.soalsebi.chatgpt.site).
