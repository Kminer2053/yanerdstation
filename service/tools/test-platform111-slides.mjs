import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import config from '../app/seoul-platform111.json' with {type:'json'};
import windowLayout from '../app/seoul-platform111-window.json' with {type:'json'};
import {PLATFORM111_MEDIA,PLATFORM111_PHOTOS,acquirePlatformSlides} from '../app/platform111-slides.js';
import {platform111MessageRepeat} from '../app/seoul-platform111.js';

assert.equal(new Set(PLATFORM111_PHOTOS.map(p=>p.source)).size,5);
for(const photo of PLATFORM111_PHOTOS){
 assert(PLATFORM111_MEDIA.creditHtml.includes(photo.author));
 assert(PLATFORM111_MEDIA.creditHtml.includes('File:'+encodeURIComponent(photo.source)));
}
assert.match(PLATFORM111_MEDIA.creditHtml,/CC BY-SA 4\.0/);
for(const layout of [config,windowLayout]){
 const path='public'+PLATFORM111_MEDIA.images[layout.floor];
 const {width,height,format}=await sharp(path).metadata();
 const displayRatio=(config.media.end-config.media.start)*layout.length/config.length/layout.height;
 assert(Math.abs(width/height/displayRatio-1)<.01,'photos maintain their aspect on both floors');
 assert(width<=4096&&format==='webp');
 assert(fs.statSync(path).size<=180_000,'each hall photo texture stays under 180KB');
 assert(Math.abs(platform111MessageRepeat(layout)*PLATFORM111_MEDIA.messageAspect-displayRatio)<1e-9);
}
const message=await sharp('public'+PLATFORM111_MEDIA.message).metadata();
assert(Math.abs(message.width/message.height-PLATFORM111_MEDIA.messageAspect)<.02);
assert(fs.statSync('public'+PLATFORM111_MEDIA.message).size<20_000);
const hall=fs.readFileSync('app/seoul-platform111.js','utf8'),game=fs.readFileSync('src/commons-screens.js','utf8');
assert.match(hall,/surface===config.tids\?surface.image:PLATFORM111_MEDIA.images\[layout.floor\]/);
assert.match(game,/tids:'\/data\/commons\/screens\/departures.webp'/);
assert.match(game,/textures\[s===config.media\?layout.floor:'tids'\]/);
assert.match(hall,/uniforms.showMessage=mediaRecord.material.uniforms.baseline===1\?frameIndex:0/);
assert(!game.includes('tick(time)')&&!hall.includes('acquirePlatformFilm'),'alternating stills need no per-frame polling or video');

const timers=new Map(),doc=new EventTarget(),reduce=new EventTarget();let serial=0;
doc.hidden=false;reduce.matches=false;
const runtime={document:doc,reduce,setTimeout(fn,ms){timers.set(++serial,{fn,ms});return serial;},clearTimeout(id){timers.delete(id);}};
const owner={},left=[],right=[];
const a=acquirePlatformSlides(owner,index=>left.push(index),runtime),b=acquirePlatformSlides(owner,index=>right.push(index),runtime);
const tick=ms=>{assert.equal(timers.size,1);const [id,timer]=[...timers][0];assert.equal(timer.ms,ms);timers.delete(id);timer.fn();};
assert.equal(timers.size,0);a.setActive(true);b.setActive(true);
tick(8000);tick(5000);assert.deepEqual(left,[0,1,0]);assert.deepEqual(right,left);
a.setActive(false);assert.equal(timers.size,1);b.setActive(false);assert.equal(timers.size,0);
b.setActive(true);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));tick(8000);assert.equal(right.at(-1),1);
reduce.matches=true;reduce.dispatchEvent(new Event('change'));assert.equal(timers.size,0);assert.equal(right.at(-1),0);
reduce.matches=false;reduce.dispatchEvent(new Event('change'));assert.equal(timers.size,1);
a.destroy();b.destroy();assert.equal(timers.size,0);
doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
console.log('PASS: shared panorama/message loop, photo credits, floor aspect ratios, transfer budget and independent TIDS');
