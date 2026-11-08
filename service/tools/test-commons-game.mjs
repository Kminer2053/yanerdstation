import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import hall from '../public/data/commons/hall.json' with {type:'json'};
import architecture from '../public/data/commons/architecture.json' with {type:'json'};
import custom from '../public/data/commons/custom.json' with {type:'json'};
import {makeIndexes,walkIndex,validPoint,traversable,routeAcross,SPAWN,directedConnections,travelDuration} from '../src/commons-core.js';
import {gamePlaces,emptyGame,cleanGame,gameView,nearGamePlace,validGameAction,applyGameAction,GAME_STAMPS,gameRoomVersion} from '../src/commons-game-core.js';
import {AVATAR_IDS,DEFAULT_AVATAR_ID} from '../src/commons-avatar-styles.js';
import {commonsApi} from '../server/commons.js';

const sourceHash=()=>createHash('sha256').update(JSON.stringify({hall,architecture,custom})).digest('hex'),beforeSource=sourceHash(),indexes=makeIndexes(hall,architecture,custom),places=gamePlaces(hall,custom,indexes),place=id=>places.find(p=>p.id===id),person=p=>({floor:p.floor,x:p.point[0],z:p.point[2]}),action=(kind,target,frames)=>({requestId:crypto.randomUUID(),kind,target,...(frames!==undefined?{frames}:{})});
assert.equal(places.length,8);assert.equal(new Set(places.map(p=>p.id)).size,8);
for(const p of places){assert(validPoint(indexes[p.floor],p.point[0],p.point[2]));assert.equal(hall.walk.pointIds[p.node],p.pointId);assert.deepEqual(hall.walk.points[p.node],p.point);assert(routeAcross(hall,indexes,'2F',...SPAWN,p.floor,p.point[0],p.point[2]),p.id+' must be reachable from spawn');assert.equal(p.source.surveyed,false);}
assert.deepEqual(place('staff-center').point,hall.facilities.find(f=>f.id===place('staff-center').facilityId).access);assert.deepEqual(place('staff-corridor').point,[-6,0,60],'missing booth access is snapped in front of its actual photographed face');
for(const id of ['staff-center','staff-corridor','rail-block','fourcuts']){const p=place(id);assert(p.source.photoIds.length>0);for(const id of p.source.photoIds)assert(custom.photos.some(photo=>photo.id===id&&photo.assetId===p.source.assetId));}
const stair=hall.connections.find(c=>c.id===place('photo-stairs').facilityId);assert.equal(stair.type,'stairs');assert.equal(stair.from.floor,'2F');assert.equal(stair.to.floor,'3F');assert.deepEqual(place('photo-stairs').point,stair.from.point);assert.equal(place('photo-stairs').source.model,'F02MV002');assert.equal(place('photo-stairs').source.intermediateTreads,17);assert(Math.hypot(stair.from.point[0]-place('staff-corridor').point[0],stair.from.point[2]-place('staff-corridor').point[2])<12);
assert.throws(()=>gamePlaces({...hall,connections:hall.connections.filter(c=>c.id!==stair.id)},custom,indexes),/도달 가능한/,'do not invent replacement stairs if the registered source disappears');
const blocked=walkIndex({step:2,points:[[0,0,0],[2,0,0]],floors:['2F','2F'],edges:[[1],[0]],pointIds:['a','b']},[[1,-1,1,1]],'2F');assert(!nearGamePlace({floor:'2F',point:[2,0,0],radius:3.4},{floor:'2F',x:0,z:0},{'2F':blocked}),'a nearby target across a wall is not a valid interaction');
for(const property of ['travel','inTransit'])assert(!nearGamePlace(place('rail-block'),{...person(place('rail-block')),[property]:true},indexes));
let solo=emptyGame();const perform=(kind,id,frames)=>{const input=JSON.stringify(solo),old=solo,out=applyGameAction(solo,action(kind,id,frames),person(place(id)),places,indexes);assert.equal(JSON.stringify(old),input,'actions do not mutate the previous state');solo=out.state;return out;};
assert.throws(()=>applyGameAction(solo,action('photo','photo-hanjeongseon',1),person(place('photo-hanjeongseon')),places,indexes),/철도블럭/);
perform('greet','staff-center');const claim=perform('claim','rail-block'),claimAction=claim.state.receipts.at(-1).action;perform('photo','photo-hanjeongseon',1);perform('photo','photo-stairs',1);perform('claim','storyway-center');assert.equal(solo.heldItem,'storyway-set');
const replay=applyGameAction(solo,claimAction,person(place('storyway-center')),places,indexes);assert.equal(replay.state.heldItem,'storyway-set','an old request retry cannot change later equipped items');assert.equal(replay.state.receipts.length,solo.receipts.length);assert.throws(()=>applyGameAction(solo,{...claimAction,kind:'equip',target:'rail-block'},person(place('rail-block')),places,indexes),/같은 요청/);
assert.throws(()=>perform('photo','fourcuts',3),/네 장/);perform('photo','fourcuts',4);assert.deepEqual([...solo.stamps].sort(),[...GAME_STAMPS].sort());assert.deepEqual(solo.inventory,['rail-block','storyway-set']);assert.equal(gameView(solo).receipts,undefined);assert.equal(cleanGame('{broken').inventory.length,0);
for(const [item,message]of [['rail-block','철도블럭을 손에 들었어요.'],['storyway-set','구운란사이를 손에 들었어요.']])assert.equal(applyGameAction(solo,action('equip',item),person(place('rail-block')),places,indexes).result.message,message);
for(const invalid of [{...action('claim','rail-block'),inventory:['rail-block']},{...action('claim','rail-block'),frames:99},{...action('claim','rail-block'),requestId:'invalid'}])assert(!validGameAction(invalid));assert.throws(()=>applyGameAction(emptyGame(),action('equip','rail-block'),person(place('rail-block')),places,indexes),/획득한/);

const sqlite=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
const prepare=sql=>{let values=[];return {bind(...v){values=v;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:sqlite.prepare(sql).run(...values)};}};};
const DB={prepare,async batch(commands){sqlite.exec('BEGIN');try{const result=commands.map(c=>c.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let now=1793923200000;
async function request(route,data,token,{origin='https://game.test',env={DB}}={}){return commonsApi(new Request('https://game.test/api/commons/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}),env,now);}
async function check(r,status=200){assert.equal(r.status,status,await r.clone().text());return r.json();}
const row=member=>sqlite.prepare('SELECT * FROM commons_players WHERE id=?').get(member.id),stored=member=>JSON.parse(row(member).game_state);
function seed(member,p){assert(validPoint(indexes[p.floor],p.point[0],p.point[2]));sqlite.prepare("UPDATE commons_players SET floor=?,x=?,z=?,transit='',moved_at=0 WHERE id=?").run(p.floor,p.point[0],p.point[2],member.id);}
function payload(member,extra={}){const p=row(member);return {room:member.room,id:member.id,seq:p.seq+1,floor:p.floor,x:p.x,z:p.z,yaw:.2,pose:'idle',...extra};}
async function sync(member,extra={},status=200){now+=1300;return check(await request('sync',payload(member,extra),member.token),status);}
async function game(member,kind,target,frames,status=200){return sync(member,{game:action(kind,target,frames)},status);}
const immutable={id:'unchanged',revision:17,saved:'synthetic',body:'{"approved":"preserve"}',operation:'original-operation'};
sqlite.prepare('INSERT INTO workbench (id,revision,saved_at,body,operation_id) VALUES (?,?,?,?,?)').run(immutable.id,immutable.revision,immutable.saved,immutable.body,immutable.operation);
try{
 const a=await check(await request('join',{color:0,character:'elder-woman'}),201);assert.equal(a.character,'elder-woman');assert.equal(a.version,gameRoomVersion(hall,architecture,custom));assert.deepEqual(a.game.inventory,[]);assert.equal(a.game.receipts,undefined);
 await check(await request('join',{room:a.room,color:1,character:'staff'}),400);
 const far=await game(a,'claim','rail-block',undefined,422);assert.equal(far.gameError,true);assert.equal(far.seq,1);assert.deepEqual(far.position,SPAWN);assert.deepEqual(far.game.inventory,[]);assert.equal(row(a).seq,1,'a rejected game action still acknowledges valid movement');
 const untouched=JSON.stringify(stored(a));now+=1300;await check(await request('sync',payload(a,{heldItem:'rail-block'}),a.token),400);await check(await request('sync',payload(a,{game:{...action('claim','rail-block'),inventory:['rail-block']}}),a.token),400);assert.equal(JSON.stringify(stored(a)),untouched);
 seed(a,place('rail-block'));const grant=action('claim','rail-block');now+=1300;const grantPayload=payload(a,{game:grant}),won=await check(await request('sync',grantPayload,a.token));assert.equal(won.game.heldItem,'rail-block');assert.equal(won.game.lastResult.awarded,true);
 const lostReply=await check(await request('sync',grantPayload,a.token),409);assert.equal(lostReply.seq,grantPayload.seq);assert.equal(lostReply.game.lastResult.requestId,grant.requestId);assert.equal(lostReply.game.receipts,undefined);
 const b=await check(await request('join',{room:a.room,color:1,character:'child-boy'}),201);assert.deepEqual(b.game.inventory,[],'another player cannot inherit the collector inventory');assert.equal(b.peers.find(p=>p.id===a.id).heldItem,'rail-block');assert.equal(b.peers.find(p=>p.id===a.id).character,'elder-woman');
 const at=row(a),node=hall.walk.pointIds.indexOf(place('rail-block').pointId),neighbor=hall.walk.edges[node].map(n=>hall.walk.points[n]).find(p=>traversable(indexes['2F'],[at.x,at.z],[p[0],p[2]]));assert(neighbor);const outside=await sync(a,{x:neighbor[0],z:neighbor[2]});assert.equal(outside.game.heldItem,'rail-block','leaving the shop retains the held item');
 const seen=await sync(b);assert.equal(seen.peers.find(p=>p.id===a.id).heldItem,'rail-block');for(const peer of seen.peers){for(const key of ['inventory','stamps','game_state','game','receipts','token','token_hash'])assert(!(key in peer));assert(AVATAR_IDS.includes(peer.character));}
 seed(a,place('rail-block'));now+=1300;const racePayload=payload(a,{game:action('claim','rail-block')}),beforeSeq=row(a).seq,receipts=stored(a).receipts.length;
 const racing=await Promise.all([request('sync',racePayload,a.token),request('sync',racePayload,a.token)]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);assert.equal(row(a).seq,beforeSeq+1);assert.equal(stored(a).receipts.length,receipts+1);assert.deepEqual(stored(a).inventory,['rail-block']);
 const conflict=await sync(a,{game:{...grant,kind:'equip',target:'rail-block'}},422);assert.equal(conflict.gameError,true);assert.match(conflict.error,/같은 요청/);
 seed(a,place('photo-hanjeongseon'));const han=await sync(a,{character:'adult-man',game:action('photo','photo-hanjeongseon',1)});assert(han.game.stamps.includes('photo-hanjeongseon'));assert.equal(han.character,'adult-man');
 seed(a,place('fourcuts'));const wrongFloor=await game(a,'photo','photo-stairs',1,422);assert(!wrongFloor.game.stamps.includes('photo-stairs'));assert.equal(wrongFloor.game.heldItem,'rail-block');
 // Use an actual registered stair path and retain the item during its animation.
 seed(a,place('photo-stairs'));const trip=await sync(a,{floor:'3F',x:stair.to.point[0],z:stair.to.point[2],move:{kind:'connection',id:stair.id},path:[]});assert(trip.travel);assert.equal(trip.game.heldItem,'rail-block');assert.deepEqual(trip.travel.path,stair.actualpath);
 const inFlight=await game(a,'photo','fourcuts',4,422);assert.equal(inFlight.gameError,true);assert.equal(inFlight.travel.id,stair.id);assert.equal(inFlight.game.heldItem,'rail-block');
 now+=travelDuration(stair.actualpath);await sync(a);seed(a,place('fourcuts'));await game(a,'photo','fourcuts',1,422);const four=await game(a,'photo','fourcuts',4);assert(four.game.stamps.includes('fourcuts'));
 seed(a,place('storyway-center'));const set=await game(a,'claim','storyway-center');assert.deepEqual(set.game.inventory,['rail-block','storyway-set']);assert.equal(set.game.heldItem,'storyway-set');
 const replayOld=await sync(a,{game:grant});assert.equal(replayOld.game.heldItem,'storyway-set');assert.equal(replayOld.game.lastResult.requestId,grant.requestId);await game(a,'equip','rail-block');
 seed(a,place('photo-stairs'));await game(a,'photo','photo-stairs',1);seed(a,place('staff-corridor'));const complete=await game(a,'greet','staff-corridor');assert.deepEqual([...complete.game.stamps].sort(),[...GAME_STAMPS].sort());assert.equal(complete.game.heldItem,'rail-block');
 const observer=await check(await request('join',{room:a.room,color:2}),201);assert.equal(observer.character,DEFAULT_AVATAR_ID);assert.equal(observer.peers.find(p=>p.id===a.id).heldItem,'rail-block');assert.equal(observer.peers.find(p=>p.id===a.id).character,'adult-man');assert.deepEqual(observer.game.inventory,[]);
 now+=1300;await check(await request('sync',{...payload(a),id:observer.id},a.token),401);await check(await request('sync',payload(a),a.token,{origin:'https://evil.test'}),403);await check(await request('sync',payload(a,{character:'staff'}),a.token),400);await check(await request('sync',payload(a,{npcRole:'staff'}),a.token),400);
 const beforeExpiry=JSON.stringify(stored(a));sqlite.prepare('UPDATE commons_rooms SET expires_at=? WHERE id=?').run(now,a.room);await check(await request('sync',payload(a,{game:action('claim','rail-block')}),a.token),410);assert.equal(JSON.stringify(stored(a)),beforeExpiry);await check(await request('leave',{room:a.room,id:a.id},a.token));
 now+=5001;const idle=await check(await request('join',{color:0}),201);now+=20_000;await check(await request('sync',payload(idle,{game:action('claim','rail-block')}),idle.token),410);assert.equal(row(idle).seq,0);
 now+=5001;const old=await check(await request('join',{color:0}),201);sqlite.prepare("UPDATE commons_rooms SET scene_version='old-protocol' WHERE id=?").run(old.room);now+=1300;await check(await request('sync',payload(old),old.token),409);await check(await request('join',{room:old.room,color:1}),409);
 assert.deepEqual({...sqlite.prepare('SELECT * FROM workbench').get()},{id:immutable.id,revision:immutable.revision,saved_at:immutable.saved,body:immutable.body,operation_id:immutable.operation});assert.equal(sourceHash(),beforeSource);
 console.log('게임: 근거 있는 8개 장소/도달 경로·벽/층/이동중 검증·솔로 전 미션·서버 보상/소지품·원격 캐릭터/휴대·재시도/중복경합·4컷 장수·초대방/만료·원본/업무 데이터 보존 통과');
}finally{sqlite.close();}
