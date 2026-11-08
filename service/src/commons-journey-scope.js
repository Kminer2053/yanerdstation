// A photograph belongs to the journey in which its shutter sequence started.
// Leaving or replacing a room must never turn a pending shared reward into a
// solo reward, even when the photograph itself remains available to download.
export function createJourneyScope(){
 let identity='solo',version=0;
 return {
  update(connected,playerId){const next=connected?'room:'+playerId:'solo';if(next===identity)return false;identity=next;version++;return true;},
  capture(){return {identity,version};},
  assert(scope){if(scope?.identity!==identity||scope?.version!==version)throw Error('촬영 중 여행이 바뀌었어요. 사진은 저장할 수 있고, 새 여행에서 다시 스탬프를 받을 수 있어요.');},
 };
}
