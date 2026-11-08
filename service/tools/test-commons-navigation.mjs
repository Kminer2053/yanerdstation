import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {makeIndexes,validPoint,traversable,slide,roundWalk,SPAWN,routeAcross} from '../src/commons-core.js';
import {gamePlaces} from '../src/commons-game-core.js';
import {createWalkNavigation} from '../src/commons-navigation.js';
import {viewPersonFront,orbitPerson,movementFromCamera} from '../src/commons-camera-controls.js';
import {routeRibbon,createRouteDisplay} from '../src/commons-route-display.js';
import {sourceDetailRegions,detailRegionDistance,selectDetailEntries} from '../src/commons-detail-selection.js';
import {createWalkTrail} from '../src/commons-walk-trail.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/data/commons/'+name+'.json',import.meta.url),'utf8')),hall=read('hall'),architecture=read('architecture'),custom=read('custom'),before=JSON.stringify({hall,architecture,custom}),indexes=makeIndexes(hall,architecture,custom),places=gamePlaces(hall,custom,indexes);
// Reproduce the old precision gap against actual source cells; the client must
// validate exactly the position subsequently sent by the presence protocol.
const raw=[-100.9996,12.9996],rounded=raw.map(roundWalk);assert(validPoint(indexes['2F'],...raw));assert(!validPoint(indexes['2F'],...rounded));const safe=slide(indexes['2F'],-100,12,raw[0]+100,raw[1]-12);assert(validPoint(indexes['2F'],...safe));assert.deepEqual(safe,safe.map(roundWalk));
const bend=[[-83.05,19.132],[-83.021,19.083],[-82.992,19.034],[-82.963,18.985],[-82.934,18.936],[-82.905,18.887],[-82.957,18.865],[-82.957,18.843],[-82.957,18.821]],trail=createWalkTrail({canTraverse:(floor,a,b)=>traversable(indexes[floor],a,b)});assert(!traversable(indexes['2F'],bend[0],bend.at(-1)),'reproduce old 120ms sampling cutting across a corner');trail.reset('2F',bend[0]);for(const p of bend.slice(1,5))assert(trail.record(...p));const sent=trail.freeze(),immutable=JSON.stringify(sent);for(const p of bend.slice(5))assert(trail.record(...p));assert.equal(JSON.stringify(sent),immutable,'pending coordinates remain immutable');const firstPath=[bend[0],...sent.path,bend[4]];for(let i=1;i<firstPath.length;i++)assert(traversable(indexes['2F'],firstPath[i-1],firstPath[i]));trail.acknowledge(sent.count,bend[4]);const remaining=trail.freeze(),nextPath=[bend[4],...remaining.path,bend.at(-1)];assert(remaining.count>0,'acknowledgement must preserve newly walked bends');for(let i=1;i<nextPath.length;i++)assert(traversable(indexes['2F'],nextPath[i-1],nextPath[i]));
let self={floor:'2F',x:SPAWN[0],z:SPAWN[1],y:0,yaw:Math.PI},transit=0,connections=[],routes=[];
const nav=createWalkNavigation({hall,indexes,getSelf:()=>self,onRoute:p=>routes.push(p),onConnection:async c=>{assert.equal(self.floor,c.from.floor);assert(Math.hypot(self.x-c.from.point[0],self.z-c.from.point[2])<.004);assert(hall.connections.some(v=>v.id===c.id));connections.push(c.id);self.floor=c.to.floor;[self.x,self.y,self.z]=c.to.point;transit=30;return true;}});
let steps=0;for(const place of places){const origin=[self.x,self.z],promise=nav.start({...place,point:place.point});assert.deepEqual([self.x,self.z],origin,'destination selection never relocates immediately');let frames=0;
 while(nav.active&&frames++<40_000){const previous={...self};nav.tick(1/60,{inTransit:transit>0});if(transit>0)transit--;if(self.floor===previous.floor){const step=Math.hypot(self.x-previous.x,self.z-previous.z);assert(step<=2.6/60+.0015,'each floor movement is a continuous walking step');assert(traversable(indexes[self.floor],[previous.x,previous.z],[self.x,self.z]));assert.deepEqual([self.x,self.z],[self.x,self.z].map(roundWalk));}assert(validPoint(indexes[self.floor],self.x,self.z));steps++;await Promise.resolve();}
 assert(frames<40_000);assert.equal(await promise,true);assert.equal(self.floor,place.floor);assert(Math.hypot(self.x-place.point[0],self.z-place.point[2])<.003);
}
assert(connections.length>=1);assert(routes.every(p=>p.legs.length));const paused=nav.start(places[0]),at={...self};nav.tick(.05,{paused:true});assert.equal(self.x,at.x);nav.tick(.05,{canMove:false});assert.equal(self.x,at.x);nav.cancel('manual');assert.equal(await paused,false);
const person={yaw:.8,pitch:.2};viewPersonFront(person);assert.equal(person.yaw,.8);assert(Math.abs(Math.abs(person.cameraYaw-person.yaw)-Math.PI)<1e-10);const oldYaw=person.yaw;orbitPerson(person,.4);assert.equal(person.yaw,oldYaw,'orbit never rotates the avatar');const movement=movementFromCamera(person,1,0,1);assert(Math.abs(Math.hypot(...movement)-1)<1e-12);viewPersonFront(person,false);assert(Math.abs(person.cameraYaw-person.yaw)<1e-12);
const ribbon=routeRibbon([[0,0,0],[3,0,0],[3,2,4]],.38);assert(ribbon.length===36);assert.equal(Math.abs(ribbon[2]-ribbon[5]),.38);const scene=new T.Scene(),display=createRouteDisplay(scene),plan=routeAcross(hall,indexes,'2F',...SPAWN,'3F',0,0);assert(plan);display.show(plan);assert(scene.children[0].children.some(g=>g.userData.toFloor==='3F'));assert(scene.children[0].children.flatMap(g=>g.children).every(m=>m.isMesh&&m.material.depthWrite===false&&m.material.depthTest===true));display.dispose();assert.equal(scene.children.length,0);
const binary=fs.readFileSync(new URL('../public'+architecture.url,import.meta.url)),groups=new Map();for(const m of architecture.groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(binary.buffer,binary.byteOffset+m.positions.byteOffset,m.positions.count),3));g.setIndex(new T.BufferAttribute(new Uint32Array(binary.buffer,binary.byteOffset+m.indices.byteOffset,m.indices.count),1));groups.set(m.name,g);}
const candidates=architecture.detailPages.map(p=>({id:p.id,type:'source',floors:[...new Set(p.parts.map(part=>architecture.groups.find(g=>g.name===part.group).floor))],bounds:p.bounds,regions:sourceDetailRegions(p,groups,architecture.groups),data:p}));
const focus={x:-3.153,y:1.885,z:28.11},camera={x:-4,y:1.9,z:23};
const left=candidates.find(p=>p.id==='8c1fcc1bf1d5b41b4f69d389'),right=candidates.find(p=>p.id==='05276e2b292ec548f517e3aa');
assert(left&&right);assert(detailRegionDistance(focus,left.regions,'2F')<.01);
const wall=architecture.groups.find(g=>g.name==='2F:walls'),wallMesh=groups.get(wall.name),position=wallMesh.getAttribute('position');
for (const entry of [left,right]) {
 const {tile,parts,width,height}=entry.data;
 assert.equal(width,512);assert.equal(height,512);
 const front=[];
 for (const [start,count] of parts.find(part=>part.group===wall.name).ranges) {
  for (let offset=start;offset<start+count;offset+=3) {
   const ids=Array.from(wallMesh.index.array.subarray(offset,offset+3));
   const zs=ids.map(id=>position.getZ(id));
   if (Math.max(...zs)<28.4&&Math.max(...zs)-Math.min(...zs)<.22) front.push(ids);
  }
 }
 assert.equal(front.length,2,'each photograph covers both actual front triangles');
 const vertices=[...new Set(front.flat())];assert.equal(vertices.length,4);
 const centerX=vertices.reduce((sum,id)=>sum+position.getX(id),0)/4;
 for (const id of vertices) {
  const offset=wall.uv.byteOffset+id*8;
  const u=(binary.readFloatLE(offset)*architecture.atlas.width-tile.left)/tile.size;
  const v=(binary.readFloatLE(offset+4)*architecture.atlas.width-architecture.atlas.width+tile.top+tile.size)/tile.size;
  assert(Math.abs(u-(position.getX(id)>centerX?0:1))<.0001,'the sign reads left to right');
  assert(Math.abs(v-(position.getY(id)>1?1:0))<.0001,'the sign is above the shop entrance');
 }
}
const unpaired=candidates.map(entry=>({...entry,data:{...entry.data,detailPair:undefined}}));
const weenyFace=hall.facades.find(f=>f.alias==='F02WL072-S25');
assert(weenyFace,'keep the adjacent approved Weeny Beeny facade');
const weenyX=weenyFace.positions.filter((_,i)=>i%3===0),weenyZ=weenyFace.positions.filter((_,i)=>i%3===2);
const weeny={id:'facade:'+weenyFace.alias,type:'facade',floors:[weenyFace.floor],bounds:[Math.min(...weenyX),Math.min(...weenyZ),Math.max(...weenyX),Math.max(...weenyZ)],data:weenyFace};
for (const mobile of [false,true]) {
 const options={position:camera,floor:'2F',focus,mobile};
 assert(!selectDetailEntries(unpaired,options).some(entry=>entry.id===right.id),'the previous detail budget dropped the right storefront');
 const selected=selectDetailEntries([...candidates,weeny],options);
 assert(selected.includes(left)&&selected.includes(right)&&selected.includes(weeny));
 assert(selected.filter(entry=>entry.type==='source').length<=(mobile?3:6));
 assert(!selectDetailEntries(candidates,{...options,floor:'3F'}).some(entry=>entry===left||entry===right));
}
assert.equal(JSON.stringify({hall,architecture,custom}),before,'navigation/render selection never alters source assets or metadata');
console.log(JSON.stringify({pass:true,continuousWalkSteps:steps,destinations:places.length,registeredConnections:connections,precisionBoundary:'reproduced and guarded',camera:'independent orbit/front',route:'contrasting geometry ribbon',storyway:'two original 512px storefronts, correctly oriented within the detail budget'}));
