// The same small game rules run locally and on the presence server. Rewards are
// display items only; neither this passport nor a photograph purchases a product.
import {nearestCell,validPoint,traversable,routeAcross,SPAWN} from './commons-core.js';
import {boundsOfPhotoPositions,GRAND_STAIRS_PHOTO_BOUNDS} from './commons-photo-spots.js';

export const GAME_VERSION='station-passport-1';
export const gameRoomVersion=(hall,architecture,custom)=>[hall.version,architecture.version,custom.version,GAME_VERSION].join(':');
const MAX_RECEIPTS=1024;
export const ITEM_IDS=['rail-block','storyway-set'];
export const GAME_STAMPS=['briefing','rail-block','photo-hanjeongseon','photo-stairs','storyway','fourcuts'];
export const ITEMS=Object.freeze({
 'rail-block':{id:'rail-block',name:'철도블럭',short:'철도블럭',icon:'▦',description:'TRAIN MATES 방문으로 얻는 게임 소품입니다. 손에 들고 서울역을 여행해요.'},
 'storyway-set':{id:'storyway-set',name:'구운란사이',short:'구운란사이',icon:'◉',description:'구운계란 2개와 칠성사이다 190mL 1개로 구성된 코레일유통 PB 상품을 본뜬 게임 소품입니다.'},
});
const positionOf=f=>f?.access||f?.point||f?.position;
export function gamePlaces(hall,custom,indexes){
 const facilities=hall.facilities||[],find=id=>facilities.find(f=>f.id===id),out=[];
 function add(id,kind,name,floor,source,extra={}){
  const p=positionOf(source),ix=indexes[floor];if(!p||!ix)return;
  const asset=(custom.assets||[]).find(a=>a.facilityId===source.id),photos=(custom.photos||[]).filter(p=>p.assetId===asset?.id),heading=source.reference?.focus?.cameraHeading;
  let node=Number.isInteger(source.accessNode)?source.accessNode:-1;
  // A missing access point is snapped in front of the actual photo plane, not
  // to a convenient cell on the opposite side of a wall or booth.
  const front=!source.access&&Number.isFinite(heading)?[p[0]+Math.sin(heading*Math.PI/180)*1.8,p[2]-Math.cos(heading*Math.PI/180)*1.8]:[p[0],p[2]];
  if(node<0||hall.walk.floors[node]!==floor||!validPoint(ix,hall.walk.points[node]?.[0],hall.walk.points[node]?.[2]))node=nearestCell(ix,...front);
  const at=hall.walk.points[node];if(!at||Math.hypot(at[0]-p[0],at[2]-p[2])>8)return;
  if(!routeAcross(hall,indexes,'2F',...SPAWN,floor,at[0],at[2]))return;
  const lookAt=asset?[asset.position[0],asset.position[1]+Math.min(1.6,asset.size[2]/2),asset.position[2]]:source.point?.slice();
  out.push({id,kind,name,floor,point:at.slice(),node,pointId:hall.walk.pointIds[node],radius:3.4,facilityId:source.id||null,lookAt,source:{kind:source.access?'registered-facility-access':'photo-front-walk-snap',alias:source.alias||null,assetId:asset?.id||null,model:source.reference?.focus?.model||null,photoIds:photos.map(p=>p.id),surveyed:false},...extra});
 }
 add('staff-center','staff','맞이방 안내센터 역무원','2F',find('DEST-SEOUL-2F-INFORMATION-CENTER-01'));
 add('staff-corridor','staff','선상통로 안내부스 역무원','2F',find('DEST-SEOUL-2F-INFORMATION-BOOTH-01'));
 add('rail-block','claim','TRAIN MATES · 철도블럭','2F',find('DEST-TRAIN-MATES-SEOUL-2F'),{stamp:'rail-block',item:'rail-block'});
 const hanjeongseon=find('DEST-F02WL046-S01'),hanFace=hall.facades?.find(f=>f.alias==='F02WL046-S01'),hanAngle=(hanjeongseon?.reference?.focus?.cameraHeading||0)*Math.PI/180;
 add('photo-hanjeongseon','photo','한정선 정면 인증샷','2F',hanjeongseon,{stamp:'photo-hanjeongseon',requires:'rail-block',lookAt:hanjeongseon?.point,frames:1,photoView:{kind:'facade',bounds:boundsOfPhotoPositions(hanFace?.positions),front:[Math.sin(hanAngle),-Math.cos(hanAngle)],eyeHeight:1.65}});
 const stairs=(hall.connections||[]).find(c=>c.id==='AUTO-F02MV002-1-1');
 const booth=find('DEST-SEOUL-2F-INFORMATION-BOOTH-01');
 if(stairs?.type==='stairs'&&stairs.from.floor==='2F'&&stairs.to.floor==='3F'&&stairs.actualpath?.length>=3&&booth&&Math.hypot(stairs.from.point[0]-booth.point[0],stairs.from.point[2]-booth.point[2])<12)add('photo-stairs','photo','선상통로 대계단 광각 인증샷','2F',{id:stairs.id,point:stairs.from.point,accessNode:stairs.from.node},{stamp:'photo-stairs',requires:'rail-block',frames:1,lookAt:stairs.actualpath[Math.floor(stairs.actualpath.length/2)].slice(),photoView:{kind:'stairs',bounds:[...GRAND_STAIRS_PHOTO_BOUNDS],front:[stairs.from.point[0]-stairs.to.point[0],stairs.from.point[2]-stairs.to.point[2]],eyeHeight:1.4},source:{kind:'registered-model-treads',connectionId:stairs.sourceId,model:'F02MV002',sourceStatus:stairs.sourceStatus,intermediateTreads:stairs.actualpath.length-2,surveyed:false}});
 for(const id of ['DEST-F02WL057-S01','DEST-F02WL021-S01']){
  const f=find(id);if(f)add('storyway-'+(id==='DEST-F02WL057-S01'?'center':'west'),'claim',f.name+' · 구운란사이','2F',f,{stamp:'storyway',item:'storyway-set'});
 }
 add('fourcuts','photo','3층 인생네컷 · 네컷사진 찍기','3F',find('DEST-SEOUL-3F-LIFEFOURCUTS-01'),{stamp:'fourcuts',frames:4,lookAt:find('DEST-SEOUL-3F-LIFEFOURCUTS-01')?.point});
 for(const id of ['staff-center','staff-corridor','rail-block','photo-hanjeongseon','photo-stairs','fourcuts'])if(!out.some(p=>p.id===id))throw Error('미션 장소의 사진·시설 또는 도달 가능한 보행 지점을 확인하지 못했습니다: '+id);
 if(!out.some(p=>p.stamp==='storyway'))throw Error('스토리웨이의 확인된 보행 지점이 없습니다.');
 return out;
}
export function emptyGame(){return {version:GAME_VERSION,inventory:[],stamps:[],heldItem:'',lastResult:null,receipts:[]};}
export function gameView(raw){const {receipts,...view}=cleanGame(raw);return view;}
export function cleanGame(raw){
 let v=raw;try{if(typeof v==='string')v=JSON.parse(v);}catch{v=null;}
 const fresh=emptyGame();if(!v||v.version!==GAME_VERSION)return fresh;
 fresh.inventory=[...new Set((Array.isArray(v.inventory)?v.inventory:[]).filter(i=>ITEM_IDS.includes(i)))];
 fresh.stamps=[...new Set((Array.isArray(v.stamps)?v.stamps:[]).filter(i=>GAME_STAMPS.includes(i)))];
 fresh.heldItem=fresh.inventory.includes(v.heldItem)?v.heldItem:'';
 if(v.lastResult&&validGameAction({requestId:v.lastResult.requestId,kind:v.lastResult.kind,target:v.lastResult.target})&&typeof v.lastResult.message==='string')fresh.lastResult={requestId:v.lastResult.requestId,kind:v.lastResult.kind,target:v.lastResult.target,awarded:v.lastResult.awarded===true,message:v.lastResult.message.slice(0,500)};
 const seen=new Set();for(const receipt of Array.isArray(v.receipts)?v.receipts.slice(0,MAX_RECEIPTS):[]){if(!validGameAction(receipt.action)||seen.has(receipt.action.requestId))continue;seen.add(receipt.action.requestId);fresh.receipts.push({action:{...receipt.action},awarded:receipt.awarded===true});}
 return fresh;
}
export function nearGamePlace(place,person,indexes){return !!place&&!!indexes[place.floor]&&person.floor===place.floor&&!person.travel&&!person.inTransit&&Number.isFinite(person.x)&&Number.isFinite(person.z)&&Math.hypot(person.x-place.point[0],person.z-place.point[2])<=place.radius&&traversable(indexes[place.floor],[person.x,person.z],[place.point[0],place.point[2]]);}
export function validGameAction(a){
 return !!a&&typeof a==='object'&&!Array.isArray(a)&&!Object.keys(a).some(k=>!['requestId','kind','target','frames'].includes(k))&&typeof a.requestId==='string'&&/^[a-f0-9-]{36}$/.test(a.requestId)&&['claim','photo','equip','greet'].includes(a.kind)&&typeof a.target==='string'&&a.target.length<=50&&(a.frames===undefined||Number.isInteger(a.frames)&&a.frames>=1&&a.frames<=4);
}
export function applyGameAction(raw,action,person,places,indexes){
 const state=cleanGame(raw);if(!validGameAction(action))throw Error('미션 요청 형식을 확인해 주세요.');
 const normalized={requestId:action.requestId,kind:action.kind,target:action.target,...(action.frames!==undefined?{frames:action.frames}:{})},receipt=state.receipts.find(r=>r.action.requestId===action.requestId);
 if(receipt){if(JSON.stringify(receipt.action)!==JSON.stringify(normalized))throw Error('같은 요청에 다른 미션이 들어왔어요. 새 요청으로 시도해 주세요.');const result={requestId:action.requestId,kind:action.kind,target:action.target,awarded:receipt.awarded,message:messageFor(action,places)};state.lastResult=result;return {state,result};}
 if(state.receipts.length>=MAX_RECEIPTS)throw Error('이 여행의 미션 기록 한도에 도달했어요. 새 여행에서 이어가 주세요.');
 let message='',awarded=false;
 if(action.kind==='equip'){
  if(action.frames!==undefined||action.target!==''&&!state.inventory.includes(action.target))throw Error('획득한 소품만 손에 들 수 있어요.');
  state.heldItem=action.target;message=messageFor(action,places);
 }else{
  const place=places.find(p=>p.id===action.target);
  if(!place||action.kind!==(place.kind==='staff'?'greet':place.kind)||!nearGamePlace(place,person,indexes))throw Error('해당 장소의 보행 지점에 가까이 가서 다시 시도해 주세요.');
  if(action.kind==='photo'){
   if(action.frames!==place.frames)throw Error(place.frames===4?'네 장을 모두 촬영한 뒤 스탬프를 받을 수 있어요.':'사진 한 장을 촬영해 주세요.');
   if(place.requires&&(!state.inventory.includes(place.requires)||state.heldItem!==place.requires))throw Error('철도블럭을 손에 들고 인증샷을 찍어 주세요.');
  }else if(action.frames!==undefined)throw Error('이 미션에는 사진 장수가 필요하지 않아요.');
  const stamp=place.kind==='staff'?'briefing':place.stamp;
  if(!state.stamps.includes(stamp)){state.stamps.push(stamp);awarded=true;}
  if(place.item){if(!state.inventory.includes(place.item))state.inventory.push(place.item);state.heldItem=place.item;}
  message=messageFor(action,places);
 }
 const result={requestId:action.requestId,kind:action.kind,target:action.target,awarded,message};state.lastResult=result;state.receipts.push({action:normalized,awarded});
 return {state,result};
}
function messageFor(action,places){
 const place=places.find(p=>p.id===action.target);
 if(action.kind==='equip')return action.target?ITEMS[action.target]?.short+(action.target==='storyway-set'?'를':'을')+' 손에 들었어요.':'소품을 가방에 넣었어요.';
 if(place?.kind==='staff')return '여행 미션을 받았어요. 굿즈점에서 철도블럭을 찾고, 두 포토스폿과 스토리웨이, 3층 인생네컷을 방문해 보세요.';
 if(place?.item)return ITEMS[place.item].short+' 획득! 매장을 나와도 계속 들고 다닐 수 있어요.';
 return place?.frames===4?'네컷사진 완성! 인생네컷 스탬프를 받았어요.':'인증샷 스탬프를 받았어요.';
}
