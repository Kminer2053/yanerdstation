import assert from 'node:assert/strict';
import * as T from 'three';
import {placePhotoView,boundsCorners} from '../src/commons-photo-framing.js';
import {confidenceAlpha,personMaskBounds,createSelfieSegmenter,decodedSelfie,cutoutSelfie} from '../src/commons-selfie.js';
import {runPhotoSequence} from '../src/commons-photo-sequence.js';
import {SEOUL_FRAMES,sceneForFrame,composeSeoulShot,composeSeoulFourcuts,loadFourcutBackgrounds} from '../src/commons-fourcut-frames.js';
import {captureCommonsFrame,hidePhotoGuides} from '../src/commons-photo.js';
const self={x:40,y:0,z:-24,character:'adult-woman'};
for(const preset of [{kind:'facade',bounds:[39,-.003,-26.612,39.06,3.612,-19.11],front:[1,0],eyeHeight:1.65},{kind:'stairs',bounds:[-10.316,0,38.035,-.029,7.086,54.541],front:[0,1],eyeHeight:1.4}]){
 const who=preset.kind==='stairs'?{...self,x:-8,z:56}:self,view=placePhotoView(who,preset),cam=new T.PerspectiveCamera(view.fov,view.aspect,.07,1200);cam.position.copy(view.position);cam.lookAt(view.target);cam.updateMatrixWorld();assert(boundsCorners(view.bounds).every(p=>{const q=p.project(cam);return Math.abs(q.x)<.89&&Math.abs(q.y)<.89&&q.z>-1&&q.z<1;}),'full facade/sign or stair bbox and player fit the photographed view');assert.equal(view.position.y,preset.eyeHeight);if(preset.kind==='stairs'){assert(view.position.z>54.541,'camera stays at the bottom looking up');assert(view.target.y>view.position.y,'wide stairs view looks upward');}else assert(view.position.x>40,'HanJeongSeon camera faces the original front, never GS25 back side');
}
assert.equal(placePhotoView(self,{bounds:[],front:[1,0]}),null);
const guidesScene=new T.Scene();for(const name of ['walking-route','commons-connection-rings','commons-connection-label-3F','original-stair']){const mesh=new T.Object3D();mesh.name=name;mesh.visible=name!=='commons-connection-rings';guidesScene.add(mesh);}const before=guidesScene.children.map(o=>o.visible),restore=hidePhotoGuides(guidesScene);assert.deepEqual(guidesScene.children.map(o=>o.visible),[false,false,false,true]);restore();assert.deepEqual(guidesScene.children.map(o=>o.visible),before,'photo guide visibility restores exactly, including already hidden guides');
const calls=[],renderer={domElement:{width:900,height:1200},getSize:v=>v.set(900,1200),setSize(w,h){this.domElement.width=w;this.domElement.height=h;calls.push([w,h]);},render(){assert.equal(this.domElement.width,1280);}},camera=new T.PerspectiveCamera(58,.75,.07,1200),position=camera.position.clone();captureCommonsFrame({renderer,scene:{},camera,actors:{update(){}},self,photoView:{kind:'facade',bounds:[39,0,-26,39.1,3.6,-19],front:[1,0]},createCanvas:()=>({getContext:()=>({drawImage(){}})})});assert.deepEqual(calls,[[1280,800],[900,1200]]);assert.equal(camera.aspect,.75);assert.equal(camera.fov,58);assert(camera.position.equals(position));
const alpha=confidenceAlpha(new Float32Array([0,.18,.5,.82,1]));assert.deepEqual([...alpha.filter((_,i)=>i%4===3)],[0,0,128,255,255]);assert.throws(()=>confidenceAlpha(new Float32Array(100)),/사람/);
const mask=new Uint8ClampedArray(100*60*4);for(let y=10;y<55;y++)for(let x=40;x<60;x++)mask[(y*100+x)*4+3]=255;assert.deepEqual(personMaskBounds(mask,100,60),[.38,8/60,.62,57/60]);
const makeCanvas=()=>{const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(v,k)=>v[k]||(()=>{})});return {width:1,height:1,getContext:()=>context};};
const values=new Float32Array(100*60);for(let y=10;y<55;y++)for(let x=40;x<60;x++)values[y*100+x]=1;
for(const [w,h]of [[1200,720],[720,1200]]){const result=cutoutSelfie({width:w,height:h},{width:100,height:60,values},{canvas:makeCanvas});assert.equal(result.width,Math.round(.24*w));assert.equal(result.height,Math.round(49/60*h));}
assert.throws(()=>cutoutSelfie({width:1,height:1},{width:2,height:2,values:[]},{canvas:makeCanvas}),/결과/);
const originalImage=globalThis.Image;
globalThis.Image=class{
 set src(value){this.url=value;this.naturalWidth=1200;this.naturalHeight=900;queueMicrotask(()=>this.onload());}
};
try{await loadFourcutBackgrounds('seoul-trip');await loadFourcutBackgrounds('platform111');}
finally{globalThis.Image=originalImage;}
assert.equal(SEOUL_FRAMES.length,6);
assert.equal(sceneForFrame('platform111',2),'platform111');assert.equal(new Set([0,1,2,3].map(i=>sceneForFrame('seoul-trip',i))).size,4);const portraits=[1,2,3,4].map(i=>({width:500+i,height:800,id:i}));const composed=portraits.map((p,index)=>composeSeoulShot(p,{index,canvas:makeCanvas}));assert(composed.every(c=>c.width===600&&c.height===800));for(const layout of ['strip','grid']){const sheet=composeSeoulFourcuts(composed,{layout,canvas:makeCanvas});assert(sheet.width>500&&sheet.height>1000);}assert.throws(()=>composeSeoulFourcuts(composed.slice(1),{canvas:makeCanvas}),/네 장/);
const captured=[];assert.equal((await runPhotoSequence({count:4,capture:async i=>{captured.push(i);return portraits[i];},wait:async()=>{}})).length,4);assert.deepEqual(captured,[0,1,2,3]);let active=true;const aborted=await runPhotoSequence({count:4,capture:async()=>{active=false;return {};},wait:async()=>{},isCurrent:()=>active});assert.equal(aborted,null);
const oldBitmap=globalThis.createImageBitmap;let closed=0;globalThis.createImageBitmap=async()=>({close(){closed++;},width:800,height:1600});const decoded=await decodedSelfie({type:'image/jpeg',size:100},{canvas:makeCanvas});assert.deepEqual([decoded.width,decoded.height],[640,1280]);assert.equal(closed,1);await assert.rejects(decodedSelfie({type:'application/pdf',size:100}),/12MB/);
const workers=[];function fakeWorker(){const worker={terminate(){this.stopped=true;},postMessage(data){queueMicrotask(()=>this.onmessage({data:{type:'result',id:data.id,width:1,height:1,values:new Float32Array([1])}}));}};workers.push(worker);return worker;}
const engine=createSelfieSegmenter({workerFactory:fakeWorker});assert.equal((await engine.segment({})).width,1);workers[0].onerror();assert(workers[0].stopped);assert.equal((await engine.segment({})).height,1,'worker failure can be retried');engine.dispose();engine.dispose();assert(workers[1].stopped);await assert.rejects(engine.segment({}),e=>e.name==='AbortError');
let resolveBitmap;globalThis.createImageBitmap=()=>new Promise(resolve=>resolveBitmap=resolve);const canceled=createSelfieSegmenter({workerFactory:fakeWorker}),pending=canceled.segment({});canceled.dispose();resolveBitmap({close(){closed++;}});await assert.rejects(pending,e=>e.name==='AbortError');globalThis.createImageBitmap=oldBitmap;
console.log('PASS: full front/sign and bottom-to-top stair framing; render restoration; automatic portrait/landscape mask crop; four fresh shots/cancel; local worker lazy start, retry and disposal.');
