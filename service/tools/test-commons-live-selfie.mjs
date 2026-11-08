import assert from 'node:assert/strict';
import {createLiveSelfie} from '../src/commons-live-selfie.js';
import {confidenceAlpha,keepPrimaryPerson,readCameraFrame,cutoutSelfie} from '../src/commons-selfie.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const timers=new Map(),jobs=[],published=[],errors=[];
 let nextTimer=0,read=0,active=0,maxActive=0;
 const live=createLiveSelfie({
  readFrame:()=>({index:++read}),
  processFrame(frame){
   active++;
   maxActive=Math.max(maxActive,active);
   return new Promise((resolve,reject)=>jobs.push({frame,resolve,reject})).finally(()=>active--);
  },
  onPortrait:portrait=>published.push(portrait),
  onError:error=>errors.push(error),
  setTimer(callback){const id=++nextTimer;timers.set(id,callback);return id;},
  clearTimer:id=>timers.delete(id),
 });
 function next(){
  const [id,callback]=timers.entries().next().value;
  timers.delete(id);
  return callback();
 }
 return {live,timers,jobs,published,errors,next,read:()=>read,maxActive:()=>maxActive};
}

const camera=fixture();
camera.live.resume();
const firstPreview=camera.next();
await flush();
camera.live.resume();
assert.equal(camera.jobs.length,1);
assert.equal(camera.timers.size,0,'a slow preview never queues another video frame');
const shutter=camera.live.capture();
assert.equal(camera.read(),2,'the shutter samples the video before waiting for inference');
await flush();
assert.equal(camera.jobs.length,1);
camera.jobs[0].resolve({index:1});
await firstPreview;
await flush();
assert.deepEqual(camera.published,[],'an old preview cannot paint over the captured photo');
assert.equal(camera.jobs[1].frame.index,2);
camera.jobs[1].resolve({index:2});
assert.deepEqual(await shutter,{index:2});
assert.equal(camera.timers.size,0,'the shutter leaves the selected shot frozen');
assert.equal(camera.maxActive(),1);

camera.live.resume();
const noPersonPreview=camera.next();
await flush();
const noPerson=Error('no foreground');
noPerson.name='NoPersonError';
camera.jobs[2].reject(noPerson);
await noPersonPreview;
assert.deepEqual(camera.published,[null],'no-person frames clear the previous silhouette');
assert.equal(camera.errors.length,0);
assert.equal(camera.timers.size,1,'the next frame can find a person again');
const following=camera.next();
await flush();
camera.live.pause();
camera.live.resume();
camera.jobs[3].resolve({index:4});
await following;
assert.deepEqual(camera.published,[null],'changing backgrounds suppresses old preview work');
const lastPreview=camera.next();
await flush();
const canceledShot=camera.live.capture();
const cancellation=assert.rejects(canceledShot,{name:'AbortError'});
camera.live.dispose();
camera.jobs[4].resolve({index:5});
await lastPreview;
await cancellation;
assert.equal(camera.jobs.length,5,'closing while the shutter waits does not start a new job');
assert.equal(camera.timers.size,0);
assert.deepEqual(camera.published,[null]);

const width=40,height=30,values=new Float32Array(width*height);
const fill=(left,top,right,bottom,value)=>{
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)values[y*width+x]=value;
};
fill(12,5,28,28,1);
fill(1,8,8,24,1);
fill(11,10,12,19,.44);
const alpha=confidenceAlpha(values),opacity=(x,y)=>alpha[(y*width+x)*4+3];
keepPrimaryPerson(alpha,width,height);
assert.equal(opacity(20,12),255);
assert.equal(opacity(4,12),0,'disconnected person behind the main subject is removed');
assert(opacity(11,12)>0&&opacity(11,12)<128,'soft edges around the selected subject survive');

const calls=[];
function canvas(){
 const context={
  drawImage(...args){calls.push(['drawImage',...args]);},
  translate(...args){calls.push(['translate',...args]);},
  scale(...args){calls.push(['scale',...args]);},
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  putImageData(){},
 };
 return {getContext:()=>context};
}
assert.equal(readCameraFrame({readyState:1},{canvas}),null);
const video={readyState:2,videoWidth:1280,videoHeight:960};
const source=readCameraFrame(video,{canvas});
assert.deepEqual([source.width,source.height],[640,480]);
assert.deepEqual(calls[0],['drawImage',video,0,0,640,480]);
const portrait=cutoutSelfie(source,{width,height,values},{canvas,primary:true,mirror:true});
assert.deepEqual([portrait.width,portrait.height],[336,432]);
assert(calls.some(call=>call[0]==='translate'&&call[1]===336));
assert(calls.some(call=>call[0]==='scale'&&call[1]===-1&&call[2]===1));
console.log('PASS: live inference backpressure, fresh shutter snapshots, frozen shots, subject loss/recovery, cancellation, primary-person crop and mirror.');
