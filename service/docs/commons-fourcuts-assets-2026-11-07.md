# 서울 네컷 미니앱의 자산과 로컬 인물 분리

## 제작 범위

서울 한 바퀴, 남산의 밤, 궁궐 산책, 한강 노을, 서울역의 시간은 `src/commons-fourcut-frames.js`에서 Canvas 경로·도형·글자로 직접 그린 프레임이다. 관광지 실사 사진이나 생성형 래스터 이미지를 제품 배경으로 배포하지 않는다. 건물의 형태를 단순화한 그림이며 현장 실측이나 공식 관광 자산이 아니다. 캐릭터는 기존 코드 기반 Three.js 아바타를 별도 투명 캔버스에서 실제로 네 번 렌더링한다.

셀카 촬영은 사용자가 고른 PNG/JPEG/WebP 또는 사용자가 직접 켠 카메라의 정지 프레임을 입력으로 쓴다. MediaPipe가 사람의 확률 마스크를 만들고, 코드는 마스크를 따라 투명 배경과 자동 인물 범위를 만든다. 수동 마스킹이나 이미지 생성 서비스로 대체하지 않는다. 네 장의 파일 입력 또는 네 번의 카메라 촬영을 받으며, 파일 한 장을 네 번 자동 복제하지 않는다.

## 모델과 실행 파일 출처

- SDK: [`@mediapipe/tasks-vision@0.10.32`](https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.32), 고정 버전, Apache-2.0. 프로젝트 안에서 `npm install --ignore-scripts --save-exact @mediapipe/tasks-vision@0.10.32`로 설치했다.
- 모델: Google 공식 [SelfieSegmenter float16 v1](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite), **249,537 bytes**, SHA-256 `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`.
- [공식 Image Segmenter 안내](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)와 [Selfie Segmentation 모델 카드](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf)를 확인했다. 모델 카드가 명시한 라이선스는 Apache-2.0이다. 모델은 256×256 정방형 입력의 경량 인물 분리 모델이며, 머리카락·손가락 등에 완벽한 경계 품질을 보장하지 않는다. 여러 사람이 비슷한 크기로 보이면 함께 분리될 수 있다.
- WASM 네 파일은 고정 버전 패키지의 `wasm` 디렉터리에서 그대로 복사했다. SIMD와 비 SIMD 경로를 모두 포함한다. 가장 큰 파일은 **11,453,626 bytes**이며, WASM 자산 네 파일 합계는 **22,511,073 bytes**다. 브라우저는 지원하는 한 쌍만 불러온다.
- Classic worker는 `src/commons-selfie-worker.js`를 `tools/build-commons-selfie-worker.mjs`로 IIFE 번들한 파일이다. `npm run build`가 재생성한다. SDK의 WASM 로더가 사용하는 `importScripts` 경로를 지원하기 위해 모듈 worker 대신 classic worker를 쓴다.
- 배포되는 복사본의 정확한 크기와 SHA-256은 `public/assets/commons/segmentation/manifest.json`에 기록한다. 라이선스 원문은 같은 디렉터리의 `LICENSE.Apache-2.0.txt`다.

## 처리 및 자원 수명

캐릭터 모드에는 모델을 불러오지 않는다. 셀카 방식에서 사진을 선택하거나 촬영할 때만 worker와 모델을 지연 로딩한다. 모델·WASM·worker는 모두 같은 사이트의 `/assets/commons/segmentation/`에서 읽으며 런타임 CDN 연결은 없다. 이미지 픽셀은 브라우저와 같은 기기의 worker 사이에서만 전달한다. 사진 업로드나 외부 AI 요청은 하지 않는다.

파일은 한 장당 12MB, 1,600만 화소까지 받으며 추론 전에 최대 변을 1280px로 줄인다. `ImageBitmap`은 처리 후 닫는다. 카메라는 버튼 선택 이후에만 권한을 요청하며, 창 닫기·방식 변경·화면 이탈·촬영 완료 때 track을 종료한다. 창 닫기와 방식 변경은 worker와 별도 아바타 renderer도 정리한다. 완성 사진의 Blob URL은 최근 사진을 다시 볼 때만 유지하고, 새 결과로 교체하거나 앱을 해제할 때 반환한다. 원본 파일 참조는 창을 닫으면 비운다.

모델 로딩 실패, 시간 초과, 사람 미검출은 화면에 알리고 다시 시도하거나 다른 사진을 선택할 수 있다. WebAssembly·WebGL·OffscreenCanvas를 사용할 수 없는 기기에서는 셀카 분리가 실패할 수 있으며 캐릭터 촬영을 선택할 수 있다. 실제 카메라 기기의 화질·권한 흐름은 환경에 따라 다르다.

## 검증용 이미지

가상 성인 인물 사진을 별도 테스트 fixture로 생성했다. 실제 인물을 참조하지 않았으며 테스트 원본은 `outputs/pending-implementation-20261107/fixtures/`에만 보관하고 제품의 `public` 자산에 넣지 않는다. Google `portrait.jpg`는 파일 내부에 별도 사진 이용 제한이 있어 입력으로 사용하지 않았다.

## 재현과 검증

`node tools/test-commons-fourcuts.mjs`는 앞면 간판·계단 전체의 투영 범위, 렌더 크기/카메라 복원, 세로형·가로형 인물 마스크 범위, 네 번의 신규 캡처와 취소, worker 실패 후 재시도·해제를 검증한다. 이는 실제 모델 품질 검증을 대신하지 않는다. `/tools/preview-fourcuts.html`은 실제 게임과 같은 미니앱 모듈을 직접 여는 로컬 검수 화면이며 테스트 보상만 표시한다.

2026-11-07 기존 4210 로컬 fixture의 실제 Chrome에서 다음을 확인했다. 서버를 재시작하거나 새 포트를 열지 않았다.

- 가상 인물 원본의 실내 배경이 실제 self-hosted 모델로 제거되고 머리·상반신·손이 프레임에 합성되었다. 정방형/세로형/가로형으로 크기를 달리한 네 입력 파일을 고르고 각각 추론하여 네컷 완료 상태까지 진행했다. 동일 가상 인물을 이용한 형식 검증이며 여러 실인물의 품질을 검증했다는 뜻은 아니다. 손가락 주변에 일부 배경 잔여가 보이므로 픽셀 단위의 완전한 누끼라고 주장하지 않는다.
- 캐릭터 네 번 촬영 후 저장 버튼으로 실제 PNG를 다운로드했다. 파일은 **652×3442, 448,340 bytes**, SHA-256 `08808e63f5fb9679711442a5c14179a4374b846cbed0cc1f03aa465bfa6eabf9`이며 열어 남산·경복궁·한강·서울역과 네 포즈를 확인했다. 각 600×800 사진 영역의 픽셀 해시도 서로 달랐다.
- 원본 기반 station world를 실제 렌더한 `/tools/preview-photo-spots.html`에서 한정선 간판과 정면 전체, 대계단 아래에서 위까지의 광각 구도를 확인했다. 사진에서만 게임 이동 표지판/경로를 잠시 숨기고 촬영 직후 원래 가시성을 복원한다. 기존 계단·매장 형상은 바꾸지 않았다.
- `test-commons-fourcuts`, `test-commons-avatars`, `test-commons-journey-client`, `test-commons-game`, `test-commons-navigation`, `test-commons-walking-sync`가 통과했다. 최종 Vite 클라이언트/서버 번들도 빌드했다. 실제 카메라 권한을 켜서 기기를 촬영하는 검증은 수행하지 않았다.

테스트 증거는 제품 자산과 분리한 `outputs/pending-implementation-20261107/`의 `selfie-local-mask.png`, `selfie-fourcut-landscape.png`, `selfie-fourcut-complete.png`, `hanjeongseon-front-wide.png`, `grand-stairs-wide.png`, `fourcut-avatar-download.png`다.
