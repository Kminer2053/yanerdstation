# 서울역 여행게임 보완

- 중앙 맞이방 스토리웨이의 F02WL057·F02WL058 정면은 서로 다른 512px 원본 사진을 사용한다. 오른쪽 면의 원본 U 좌표가 반복 경계를 1/16384만큼 넘으면서 단색으로 축약된 것이 원인이었다. 해당 면 두 삼각형의 UV와 상세 범위를 복구하고, 두 사진을 기존 상세 수 제한 안에서 함께 표시한다.
- 네컷 셀카의 카메라 원본은 숨기고 인물 분리 결과만 선택한 사진 위에 실시간 합성한다. 미리보기와 촬영은 같은 방향·구도·렌더러를 사용하고, 촬영 완료·닫기 시 영상 트랙을 닫는다.
- 남산·경복궁·한강·구 서울역은 실제 사진이다. 플랫폼111은 서울역 3층 맞이방 구도와 현장 미디어월을 참고한 재현이다. 배경 출처는 네컷 화면 및 `public/assets/commons/fourcut-photos/credits.html`에 연결했다.
- 시설·여권·가방에서 따라 걷기 또는 순간이동을 선택한다. 기본은 따라 걷기다. 공유방 순간이동은 기존 서버에서 검증하는 등록 지점으로만 처리한다.

확인: `node tools/test-commons-navigation.mjs`, `node tools/test-commons-walking-sync.mjs`, `node tools/test-commons-live-selfie.mjs`, `node tools/test-commons-fourcuts.mjs`, `npm run test:commons`, `npm run test:commons-game`. 브라우저에서 두 정면, 2층→3층 순간이동, 플랫폼111 캐릭터 네컷, 가상 카메라 실시간 합성·네 장 완성·트랙 종료를 확인했다. 셀카 첨부나 실제 사용자 카메라는 검증에 사용하지 않았다.
