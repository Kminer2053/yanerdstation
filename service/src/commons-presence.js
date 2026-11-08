// Explicit, ephemeral room connection. Tokens stay in this closure. A relocation
// drains the ordinary source-floor trail before sending one immutable move.
import {createWalkTrail} from './commons-walk-trail.js';
export function createPresence({version,getSelf,onState,onReconcile,onNotice,onGame,canTraverse}){
 const trail=createWalkTrail({canTraverse});let session=null,peers=[],trailFloor='2F',pending=null,relocation=null,gameTask=null,busy=false,next=0,lastSeen=0,closed=false,failed=false,joinGeneration=0;
 const resetTrail=(floor,position=[getSelf().x,getSelf().z])=>{trailFloor=floor;trail.reset(floor,position);};resetTrail(getSelf().floor||'2F');
 const emit=extra=>onState?.({connected:!!session,room:session?.room,count:session?peers.length:0,expiresAt:session?.expiresAt,failed,moving:!!relocation,...extra});
 const body=(s,extra={})=>({room:s.room,id:s.id,...extra});
 const rounded=v=>+v.toFixed(3);
 const samePosition=(a,b)=>a.floor===b.floor&&Math.hypot(a.x-b.x,a.z-b.z)<.002;
 async function request(action,payload,token){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try{const r=await fetch('/api/commons/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});const data=await r.json();return {ok:r.ok,status:r.status,data};}finally{clearTimeout(timeout);}
 }
 const leaveRequest=s=>{if(s)fetch('/api/commons/leave',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify(body(s)),keepalive:true}).catch(()=>{});};
 const rejectMove=message=>{const move=relocation;relocation=null;move?.reject(Error(message));};
 const rejectGame=message=>{const task=gameTask;gameTask=null;task?.reject(Error(message));};
 const reset=(message='공유방 연결이 끝났어요. 다시 입장해 주세요.')=>{joinGeneration++;rejectMove(message);rejectGame(message);session=null;peers=[];resetTrail(getSelf().floor||'2F');pending=null;failed=false;emit();};
 function reconcile(data,fallback){
  const floor=data.floor||fallback?.floor||getSelf().floor||'2F',position=Array.isArray(data.position)?data.position:fallback?[fallback.x,fallback.z]:null;
  resetTrail(floor,position||[getSelf().x,getSelf().z]);if(session)session.floor=floor;
  if(position)onReconcile?.(position,floor,data.travel||null);
 }
 function acknowledge(s,data){
  const sent=pending;if(!sent)return;
  s.seq=data.seq;failed=false;lastSeen=performance.now();s.floor=data.floor||sent.payload.floor;
  if(data.peers)peers=data.peers.map(p=>({...p,receivedAt:performance.now()}));
  if(sent.move){
   const move=relocation,position=data.position;
   if(!move||!Array.isArray(position)||data.floor!==move.target.floor||Math.hypot(position[0]-move.target.x,position[1]-move.target.z)>.003){
    pending=null;reconcile(data,sent.payload);rejectMove('이동 위치를 다시 확인했어요. 한 번 더 선택해 주세요.');emit();return;
   }
   pending=null;relocation=null;reconcile(data,sent.payload);move.resolve({position,floor:data.floor,travel:data.travel||null});
  }else{
   trail.acknowledge(sent.count,[sent.payload.x,sent.payload.z]);pending=null;
   if(relocation&&samePosition(sent.payload,relocation.source)&&!trail.length)relocation.drained=true;
  }
  emit();if(data.game)onGame?.(data.game);
  if(sent.payload.game){const task=gameTask;gameTask=null;if(task){if(data.gameError)task.reject(Error(data.error||'미션을 다시 확인해 주세요.'));else if(data.game?.lastResult?.requestId===task.action.requestId)task.resolve(data.game.lastResult);else task.reject(Error('미션 결과를 확인하지 못했어요. 다시 시도해 주세요.'));}}
  if(gameTask)next=0;
 }
 function prepare(s){
  if(relocation?.drained){
   const target=relocation.target,source=relocation.source;
   if(trailFloor!==source.floor||trail.length)throw Error('출발 위치를 다시 동기화해 주세요.');
   pending={move:true,count:0,payload:body(s,{seq:s.seq+1,floor:target.floor,x:target.x,z:target.z,yaw:source.yaw,pose:'idle',path:[],move:relocation.move,character:getSelf().character})};
  }else{
   const self=relocation?.source||getSelf(),floor=self.floor||'2F';
   if(trailFloor!==floor)resetTrail(floor);const frozen=trail.freeze();
   pending={move:false,count:frozen.count,payload:body(s,{seq:s.seq+1,floor,x:rounded(self.x),z:rounded(self.z),yaw:rounded(self.yaw),pose:self.jump>0?'jump':self.pose,path:frozen.path,character:self.character,...(gameTask?{game:{...gameTask.action}}:{})})};
  }
 }
 async function sync(now){
  if(!session||busy||closed||document.hidden||now<next)return;
  if(now-lastSeen>18_000){leaveRequest(session);reset();onNotice?.('응답이 오래 없어 공유방 연결을 끝냈어요. 다시 입장해 주세요.');return;}
  busy=true;next=now+1200;const s=session;
  try{
   if(!pending)prepare(s);const sent=pending;
   const result=await request('sync',sent.payload,s.token);if(session!==s)return;
   if(result.ok||result.status===422&&result.data.gameError&&result.data.requestId===sent.payload.game?.requestId&&result.data.seq===sent.payload.seq)acknowledge(s,result.data);
   else if(result.status===409&&result.data.seq===sent.payload.seq)acknowledge(s,result.data);
   else if([409,422].includes(result.status)&&Number.isInteger(result.data.seq)&&Array.isArray(result.data.position)){
    s.seq=result.data.seq;pending=null;failed=false;lastSeen=performance.now();reconcile(result.data);rejectMove(result.data.error||'보행 위치를 확인했어요. 이동을 다시 선택해 주세요.');rejectGame(result.data.error||'위치를 확인한 뒤 미션을 다시 시도해 주세요.');emit();if(result.data.game)onGame?.(result.data.game);onNotice?.(result.data.error||'보행 경계를 확인해 마지막 공유 위치로 맞췄어요.');
   }else if(result.status===429){next=performance.now()+Math.max(1200,result.data.retryAfterMs||1200);}
   else if(result.status>=500){failed=true;emit();}
   else{leaveRequest(s);reset(result.data.error||'공유방에 다시 입장해 주세요.');onNotice?.(result.data.error||'공유방에 다시 입장해 주세요.');}
  }catch{if(session===s){failed=true;emit();}}
  finally{busy=false;}
 }
 const visibility=()=>{if(!document.hidden&&session){if(performance.now()-lastSeen>18_000){leaveRequest(session);reset();onNotice?.('화면을 떠나 있는 동안 연결이 만료됐어요. 다시 입장해 주세요.');}else next=Math.max(next,performance.now()+100);}};
 const unload=()=>leaveRequest(session);
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',unload);
 return {
  async join(room,color,character=getSelf().character){
   if(closed)throw Error('닫힌 여행이에요. 화면을 다시 열어 주세요.');if(busy||relocation)throw Error('연결 중입니다. 잠시 기다려 주세요.');busy=true;const generation=++joinGeneration;
   try{const {ok,data}=await request('join',{color,character,...(room?{room}:{})});if(!ok)throw Error(data.error||'연결할 수 없어요.');
    if(closed||generation!==joinGeneration){leaveRequest(data);throw Error('공유방 입장을 취소했어요.');}
    if(data.version!==version){leaveRequest(data);throw Error('공간 자료가 바뀌었어요. 페이지를 새로 열어 주세요.');}
    leaveRequest(session);rejectGame('새 여행을 시작했어요.');session={room:data.room,id:data.id,token:data.token,seq:data.seq,expiresAt:data.expiresAt,floor:data.floor||'2F'};peers=data.peers.map(p=>({...p,receivedAt:performance.now()}));resetTrail(session.floor);pending=null;failed=false;lastSeen=performance.now();next=lastSeen+1200;reconcile(data);emit();if(data.game)onGame?.(data.game);return data.room;
   }finally{busy=false;}
  },
  moveTo({floor,point,move,travel=null}){
   if(closed)return Promise.reject(Error('공간 연결이 끝났어요. 다시 열어 주세요.'));
   if(gameTask)return Promise.reject(Error('미션을 확인하고 있어요. 잠깐 기다려 주세요.'));
   if(relocation)return Promise.reject(Error('선택한 위치로 이동 중이에요. 잠시 기다려 주세요.'));
   if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||!floor||!move)return Promise.reject(Error('이동할 위치를 확인해 주세요.'));
   if(!session){onReconcile?.([point[0],point[2]],floor,travel);return Promise.resolve({position:[point[0],point[2]],floor,travel});}
   const self=getSelf(),source={floor:self.floor||'2F',x:rounded(self.x),z:rounded(self.z),yaw:rounded(self.yaw),pose:'idle',jump:0};
   return new Promise((resolve,reject)=>{relocation={source,target:{floor,x:rounded(point[0]),z:rounded(point[2])},move:{...move},drained:false,resolve,reject};emit();});
  },
  leave(){leaveRequest(session);reset('공유방에서 나왔어요. 이동 위치를 다시 선택해 주세요.');},
  act(action){
   if(!session||closed)return Promise.reject(Error('공유방 연결을 확인해 주세요.'));
   if(gameTask||relocation)return Promise.reject(Error('진행 중인 동작이 끝나면 다시 시도해 주세요.'));
   return new Promise((resolve,reject)=>{gameTask={action:{...action},resolve,reject};next=0;});
  },
  record(x,z,floor=getSelf().floor||'2F'){
   if(!session||relocation)return;if(floor!==trailFloor)resetTrail(floor,[x,z]);return trail.record(x,z);
  },
  canMove(){return !relocation&&!gameTask&&(!session||!failed&&trail.length<31);},
  update(now){sync(now);},
  peers(now){return peers.filter(p=>p.id!==session?.id&&now-p.receivedAt<20_000);},
  id(){return session?.id;},
  dispose(){closed=true;leaveRequest(session);reset();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',unload);},
 };
}
