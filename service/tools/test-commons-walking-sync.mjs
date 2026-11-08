import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {commonsApi} from '../server/commons.js';
import {createPresence} from '../src/commons-presence.js';
import {createWalkNavigation} from '../src/commons-navigation.js';
import {makeIndexes,traversable,SPAWN,travelDuration,relocationNode,roundWalk} from '../src/commons-core.js';
import {gamePlaces,gameRoomVersion} from '../src/commons-game-core.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../public/data/commons/'+n+'.json',import.meta.url),'utf8')),hall=read('hall'),architecture=read('architecture'),custom=read('custom'),indexes=makeIndexes(hall,architecture,custom),places=gamePlaces(hall,custom,indexes);
const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){return {meta:db.prepare(sql).run(...values)};}};}};
DB.batch=async commands=>{db.exec('BEGIN');try{const result=await Promise.all(commands.map(c=>c.run()));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,performance:globalThis.performance};let now=1000,syncs=0,maxTrail=0,unexpected=[],until=0,connections=0;const teleports=[];
const doc=new EventTarget();doc.hidden=false;globalThis.document=doc;globalThis.window=new EventTarget();Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/sync')){syncs++;maxTrail=Math.max(maxTrail,body.path?.length||0);if(body.move?.kind==='node')teleports.push(body);}const response=await commonsApi(new Request('https://walk.test'+url,{...options,headers:{...options.headers,Origin:'https://walk.test'}}),{DB},1793923200000+now);if(url.endsWith('/sync')&&!response.ok&&response.status!==429)unexpected.push({status:response.status,data:await response.clone().json()});return response;};
let self={floor:'2F',x:SPAWN[0],z:SPAWN[1],y:0,yaw:Math.PI,pose:'idle',jump:0,character:'adult-woman'};
const p=createPresence({version:gameRoomVersion(hall,architecture,custom),getSelf:()=>self,canTraverse:(f,a,b)=>traversable(indexes[f],a,b),onReconcile:(position,floor,travel)=>{self.x=position[0];self.z=position[1];self.floor=floor;until=travel?now+travel.durationMs-(travel.elapsedMs||0):0;},onNotice:message=>unexpected.push({notice:message})});
const nav=createWalkNavigation({hall,indexes,getSelf:()=>self,onConnection:async c=>{connections++;await p.moveTo({floor:c.to.floor,point:c.to.point,move:{kind:'connection',id:c.id},travel:{id:c.id,path:c.actualpath,elapsedMs:0,durationMs:travelDuration(c.actualpath)}});return true;}}),flush=()=>new Promise(resolve=>setImmediate(resolve));
try{
 await p.join(null,0);for(const place of places){const arrival=nav.start(place);let frames=0;while(nav.active&&frames++<50_000){now+=1000/60;nav.tick(1/60,{canMove:p.canMove(),inTransit:now<until});if(now>=until)p.record(self.x,self.z,self.floor);p.update(now);await flush();}assert(frames<50_000);assert.equal(await arrival,true);assert.equal(self.floor,place.floor);assert(Math.hypot(self.x-place.point[0],self.z-place.point[2])<.003);}
 assert(syncs>50);assert(connections>0);assert(maxTrail<=32);assert.deepEqual(unexpected,[],'real server must accept normal continuous walking, turns and registered stairs without correction');
 const walkingSyncs=syncs;
 const walking=nav.start(places[0]);assert(nav.active);
 assert.equal(await nav.teleport('unknown-node',()=>assert.fail('invalid destinations never call presence')),false);assert(nav.active);
 for(const place of [places.find(p=>p.floor==='2F'),places.find(p=>p.id==='rail-block'),places.find(p=>p.floor==='3F')]){
  const target=relocationNode(hall,indexes,place.pointId),before=[self.floor,self.x,self.z];let landed=false;
  const arrival=nav.teleport(place.pointId,move=>p.moveTo(move)).then(result=>{landed=result;return result;});
  assert.deepEqual([self.floor,self.x,self.z],before,'shared-room movement waits for server acknowledgement');
  for(let i=0;i<6&&!landed;i++){now+=1300;p.update(now);await flush();}
  assert(landed,'registered teleport must complete through the real presence protocol');assert.equal(await arrival,true);
  const request=teleports.at(-1),point=[roundWalk(target.point[0]),roundWalk(target.point[2])];
  assert.deepEqual(request.move,{kind:'node',id:target.id});assert.deepEqual(request.path,[]);assert.equal(request.floor,target.floor);
  assert.deepEqual([request.x,request.z],point);assert.deepEqual([self.x,self.z],point);assert.equal(self.floor,target.floor);assert.equal(until,0);
 }
 assert.equal(await walking,false,'a teleport cancels the previous automatic walk');assert.equal(teleports.length,3);assert.deepEqual(unexpected,[]);
 p.leave();const solo=places.find(p=>p.floor==='2F');assert.equal(await nav.teleport(solo.pointId,move=>p.moveTo(move)),true);assert.equal(self.floor,solo.floor);assert.deepEqual([self.x,self.z],[solo.point[0],solo.point[2]]);assert.equal(teleports.length,3,'solo relocation does not require a shared-room sync');
 console.log(JSON.stringify({pass:true,destinations:places.length,realServerSyncs:walkingSyncs,registeredTeleports:teleports.length,maxTrail,registeredConnections:connections,unexpectedCorrections:unexpected.length,storage:'memory',network:false}));
}finally{nav.cancel();p.dispose();await flush();await flush();db.close();for(const [key,value]of Object.entries(old))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
