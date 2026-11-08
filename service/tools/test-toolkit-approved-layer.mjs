import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toolkitMapData,mergeApprovedReplacements,assetFacePositions,addAssetEntities} from '../app/toolkit-approved-layer.js';
import {assetLocalPosition,partTexturePlanes,quadNormal,assetFocusView,unobstructedAssetView} from '../app/toolkit-geometry.js';
import {createToolkitScene} from '../app/toolkit-scene.js';
const base=JSON.parse(readFileSync('public/data/jury-frozen/approved-facades.json')).replacements;
const original=base.find(r=>r.slot?.surface_placements?.length);
const slot=original.slot;
const structure={id:'structure-approved',proposal:'approval-id',name:'승인 시설',floor:'2F',position:[126.9708,37.5536,36.19],size:[2,1,3],heading:0,color:'#335566',facades:{front:'/api/public/proposal-images/approval-id'}};
const updated=toolkitMapData({assets:[structure],overlays:[{alias:slot.slot_alias,name:'새 파사드',floor:slot.floor,position:[slot.longitude,slot.latitude,slot.height_m],heading:slot.camera_heading_deg,surface:[slot.surface_width_m,slot.surface_height_m],px:[1024,768],image:'/api/public/proposal-images/changed',at:'2026-10-05'}]},'S202103','https://toolkit.yanerdstation.kr');
const merged=mergeApprovedReplacements(base,updated.replacements);
assert.equal(merged.length,base.length);
const change=merged.find(r=>r.slot.slot_alias===slot.slot_alias);
assert.equal(change.slot_key,original.slot_key);
assert.deepEqual(change.slot,slot,'reviewed mesh, special asset routing and placement UVs preserved');
assert.equal(change.image_url,'https://toolkit.yanerdstation.kr/api/public/proposal-images/changed');
assert.equal(change.toolkit_approved,true);
assert.equal(original.image_url.startsWith('/data/jury-frozen/'),true,'baseline never mutated');
assert.deepEqual(mergeApprovedReplacements(base,[]),base,'no approvals retains all existing facades');
assert.equal(updated.assets[0].facades.front,'https://toolkit.yanerdstation.kr/api/public/proposal-images/approval-id');
assert.equal(toolkitMapData({assets:[{...structure,proposal:null},{...structure,hidden:true}]},'S202103','https://toolkit.yanerdstation.kr').assets.length,0);
const face=assetFacePositions(structure,'front');assert(face.every(p=>p[1]<structure.position[1]));assert(face[0][0]<face[1][0]);
assert.equal(assetFacePositions(structure,'invalid').length,0);
const entries=[],C={Cartesian3:class{constructor(...v){this.v=v;}static fromDegrees(...v){return v;}},Color:{fromCssColorString:v=>({withAlpha:a=>[v,a]})},Transforms:{headingPitchRollQuaternion:(p,r)=>[p,r]},HeadingPitchRoll:class{},Math:{toRadians:x=>x*Math.PI/180},DistanceDisplayCondition:class{},ImageMaterialProperty:class{constructor(v){Object.assign(this,v);}}};
addAssetEntities(C,{add:v=>entries.push(v)},updated.assets[0]);
assert.equal(entries.length,2,'approved structure box and front photograph');assert.equal(entries[0].position[2],37.69);assert.equal(entries[1].wall.maximumHeights[0],39.19);assert.equal(entries[1].properties.floor,'2F');assert.equal(entries[1].wall.material.image,updated.assets[0].facades.front);

// The actual declarative model keeps a doorway empty and a raised/tilted sign separate.
// Asymmetric UVs make an accidental horizontal/vertical reversal or whole-image mapping observable.
const composite={...updated.assets[0],size:[4,2,4],heading:90,parts:[
 {id:'left-post',type:'box',offset:[-1.6,0,0],size:[.8,1,3],color:'#eeeeee',facades:{}},
 {id:'right-post',type:'box',offset:[1.6,0,0],size:[.8,1,3],color:'#dddddd',facades:{}},
 {id:'lintel',type:'box',offset:[0,0,3],size:[4,1,1],color:'#cccccc',facades:{front:'front'}},
 {id:'angled-sign',type:'plane',vertices:[[-1.5,-.7,2.2],[1.5,-.7,2.2],[1.5,-.45,2.9],[-1.5,-.45,2.9]],texture:'front',uv:[[.13,.17],[.91,.17],[.91,.83],[.13,.83]]},
]};
const sourceComposite=JSON.stringify(composite),fronts=partTexturePlanes(composite.parts[2]);
assert.deepEqual(fronts[0].vertices,[[-2,-.5,3],[2,-.5,3],[2,-.5,4],[-2,-.5,4]]);
assert.deepEqual(fronts[0].uv,[[0,0],[1,0],[1,1],[0,1]],'upright front texture maps bottom-left to lower-left, without reflection');
assert.equal(partTexturePlanes(composite.parts[3])[0],composite.parts[3],'explicit quads retain the exact supplied geometry/UV contract');
const west=assetLocalPosition(composite,[0,-1,0]);assert(west[0]<composite.position[0]&&Math.abs(west[1]-composite.position[1])<1e-10,'90° heading rotates the front to the west consistently with legacy assets');
assert.deepEqual(quadNormal([[0,0,0],[2,0,0],[2,0,3],[0,0,3]]),[0,-1,0]);
assert.throws(()=>quadNormal([[0,0,0],[0,0,0],[1,1,1]]),/정점/);

const indoor={...structure,size:[4,2.5,3],heading:90},frustum={fovy:Math.PI/3,aspectRatio:1.25,near:1};
const view=assetFocusView(indoor,frustum),portrait=assetFocusView(indoor,{...frustum,aspectRatio:.5});
assert.deepEqual(view.center,[...indoor.position.slice(0,2),indoor.position[2]+1.5]);
assert.equal(view.heading,Math.PI/2,'rotated assets are approached from their own front');
assert(view.range-view.radius>=frustum.near*4,'the entire bounding sphere stays beyond the near clipping plane');
assert(view.center[2]-Math.sin(view.pitch)*view.range<indoor.position[2]+indoor.size[2],'camera stays below the asset roof, rather than 30 m above the floor');
assert(portrait.range>view.range,'a narrow map viewport still frames the full width');
assert.equal(assetFocusView({...indoor,size:[0,2,3]}),null);
assert.equal(unobstructedAssetView(view,()=>null),view,'unsupported ray picking retains the original asset framing');
const clear=unobstructedAssetView({...view,heading:0},v=>Math.abs(v.heading+65*Math.PI/180)<1e-8?12:4);
assert(Math.abs(clear.heading+65*Math.PI/180)<1e-8,'a blocked front view searches nearby front-facing angles without moving the asset');
assert.equal(clear.range,view.range,'obstacle avoidance never moves the camera inside the safe framing distance');

class Cartesian3{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}static fromDegrees(...v){return new Cartesian3(...v);}}
class Value{constructor(v){Object.assign(this,v);}}
class Collection{constructor(){this.values=[];}add(value){this.values.push(value);return value;}removeAll(){for(const v of this.values)v.destroy?.();this.values=[];}remove(value){const i=this.values.indexOf(value);if(i<0)return false;this.values.splice(i,1);value.destroy?.();return true;}destroy(){this.removeAll();this.destroyed=true;}}
class Primitive extends Value{destroy(){this.destroyed=true;}}
class Handler{constructor(){this.actions=[];}setInputAction(fn,type){this.actions.push({fn,type});}destroy(){this.destroyed=true;}}
class BoundingSphere{constructor(center,radius){this.center=center;this.radius=radius;}static fromVertices(values){return{values};}}
const CP={...C,Cartesian3,Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},Geometry:Value,GeometryAttribute:Value,GeometryInstance:Value,Primitive,MaterialAppearance:Value,
 ComponentDatatype:{FLOAT:'FLOAT',DOUBLE:'DOUBLE'},PrimitiveType:{TRIANGLES:'TRIANGLES'},BoundingSphere,HeadingPitchRange:class{constructor(heading,pitch,range){Object.assign(this,{heading,pitch,range});}},Material:{fromType:(type,uniforms)=>({type,uniforms})},
 CustomDataSource:class{constructor(name){this.name=name;this.entities=new Collection();}},PrimitiveCollection:Collection,PointPrimitiveCollection:Collection,ScreenSpaceEventHandler:Handler,
 ScreenSpaceEventType:{LEFT_CLICK:1},JulianDate:{now:()=>0},Cartographic:{fromCartesian:p=>p}};
const complexEntities=new Collection(),complexPrimitives=new Collection();
const records=addAssetEntities(CP,complexEntities,composite,{primitives:complexPrimitives});
assert.equal(complexEntities.values.length,4,'one label and exactly three real boxes; no enclosing parent box fills the doorway');
assert.equal(complexEntities.values[0].box,undefined);
assert.equal(complexPrimitives.values.length,2,'the raised front and tilted sign have their own texture primitives');
assert(records.every(r=>r.floor==='2F'&&r.assetId===composite.id));
assert.equal(complexEntities.values[0].label.text,'승인 시설');
assert.equal(complexEntities.values[1].properties.toolkit.id,composite.id);
const sign=complexPrimitives.values[1],g=sign.geometryInstances.geometry,uv=[...g.attributes.st.values];
assert.equal(g.attributes.position.values.length,12);assert(g.attributes.position.values instanceof Float64Array);
assert.deepEqual([...g.indices],[0,1,2,0,2,3]);
composite.parts[3].uv.flat().forEach((n,i)=>assert(Math.abs(uv[i]-n)<1e-6,'every st component preserves the supplied asymmetric UV'));
for(let i=0;i<4;i++){const p=assetLocalPosition(composite,composite.parts[3].vertices[i]);p.forEach((n,k)=>assert(Math.abs(g.attributes.position.values[i*3+k]-n)<1e-10));}
assert.equal(sign.geometryInstances.id.toolkit.id,composite.id,'primitive picking selects the parent facility, not an unrelated part');
assert.equal(sign.geometryInstances.id.floor,'2F');assert.equal(sign.appearance.material.uniforms.image,composite.facades.front);
assert.equal(sign.appearance.flat,true);assert.equal(sign.appearance.renderState.cull.enabled,false,'both sides of a plane are visible');
assert.equal(JSON.stringify(composite),sourceComposite,'rendering never changes the saved geometry or UVs');
const draftEntities=new Collection(),draftPrimitives=new Collection();
addAssetEntities(CP,draftEntities,composite,{preview:true,primitives:draftPrimitives});
assert.equal(draftEntities.values[0].id,'draft:'+composite.id);assert.equal(draftEntities.values[0].label.text,'승인 시설 · 임시');
assert(draftPrimitives.values.every(p=>p.geometryInstances.id.id.startsWith('draft:')));

// Exercise the actual iframe bridge: floor changes and re-renders destroy the previous quads;
// leaving the preview removes listeners and all transient graphics without touching approved data.
const globals={location:globalThis.location,window:globalThis.window,parent:globalThis.parent,addEventListener:globalThis.addEventListener,removeEventListener:globalThis.removeEventListener};
class RenderEvent{listeners=new Set();addEventListener(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}raise(){for(const fn of this.listeners)fn();}}
const tileEvents={tileVisible:new RenderEvent(),tileFailed:new RenderEvent()},messages=[],listeners=new Map(),parent={postMessage:v=>messages.push(v)},scenePrimitives=new Collection(),dataSources=new Collection(),flights=[],viewer={dataSources,scene:{primitives:scenePrimitives,postRender:new RenderEvent(),canvas:{clientWidth:640,clientHeight:480},requestRender(){}},camera:{frustum,flyTo:v=>flights.push({generic:v}),flyToBoundingSphere:(sphere,options)=>flights.push({sphere,...options})}};
try{
 globalThis.location={search:'?toolkit=1&toolkitOrigin=http%3A%2F%2F127.0.0.1%3A4197'};globalThis.window={parent};globalThis.parent=parent;
 globalThis.addEventListener=(name,fn)=>listeners.set(name,fn);globalThis.removeEventListener=(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);};
 let preview=null,facadeFocus=null,afterTiles=null,refineCancelled=0,draftAliases=null;const bridge=createToolkitScene(CP,viewer,{tileset:tileEvents,setDraftFacades:aliases=>draftAliases=aliases,setFloor(){},previewFacade:p=>preview=p,focusFacade:p=>facadeFocus=p,afterTilesLoaded:callback=>{afterTiles=callback;return()=>refineCancelled++;}});
 assert(bridge);assert(messages.some(m=>m.event==='ready'));assert.equal(messages.at(-1).event,'rendered');
 const send=data=>listeners.get('message')({origin:'http://127.0.0.1:4197',source:parent,data:{channel:'station-toolkit',...data}});
 const project={site_id:'S202103',points:[],assets:[composite],connections:[],routes:[]};
 send({action:'render',project});const surfaceCollection=scenePrimitives.values[0],firstPrimitives=[...surfaceCollection.values];assert.equal(firstPrimitives.length,2);
 send({action:'render',project:{...project,assets:[{...composite,approved_facade:{alias:composite.id},hidden:true}]}});assert.deepEqual(draftAliases,[composite.id],'a hidden private facade also suppresses its approved preview overlay');assert.equal(surfaceCollection.values.length,0);send({action:'render',project});assert.deepEqual(draftAliases,[],'ordinary structural drafts never hide unrelated approved facades');
 send({action:'floor',floor:'3F'});assert.equal(surfaceCollection.values.length,0);assert(firstPrimitives.every(p=>p.destroyed),'floor switch disposes hidden-floor geometry');
 assert.equal(messages.at(-1).event,'loading');assert.equal(tileEvents.tileVisible.listeners.size,1);
 send({action:'floor',floor:'2F'});assert.equal(surfaceCollection.values.length,2);
 assert.equal(tileEvents.tileVisible.listeners.size,1,'floor transition replaces the older render observer');tileEvents.tileVisible.raise();assert.equal(messages.at(-1).event,'loading');viewer.scene.postRender.raise();await new Promise(resolve=>setImmediate(resolve));assert.equal(messages.at(-1).event,'rendered');assert.equal(messages.at(-1).floor,'2F');assert.equal(tileEvents.tileVisible.listeners.size,0);
 const again=[...surfaceCollection.values];send({action:'render',project});assert(again.every(p=>p.destroyed),'refresh destroys the previous draft geometry instead of accumulating it');
 send({action:'focus',position:composite.position});assert(flights.at(-1).sphere,'only a new asset position uses indoor size-based framing');assert.equal(flights.at(-1).offset.heading,Math.PI/2);
 flights.at(-1).complete();const count=flights.length;afterTiles();assert.equal(flights.length,count+1,'newly visible source tiles trigger one camera refinement');assert.equal(flights.at(-1).complete,undefined,'refinement never loops or follows later unrelated tile loads');
 send({action:'focus',position:composite.position});flights.at(-1).complete();send({action:'floor',floor:'2F'});assert.equal(refineCancelled,1,'floor changes cancel any queued camera refinement');
 send({action:'render',project:{...project,assets:[{...composite,source_record:true}]}});send({action:'focus',position:composite.position});assert(flights.at(-1).generic,'existing source assets retain the established overview');send({action:'render',project});
 send({action:'focus',position:[126.9,37.5,36.19]});assert(flights.at(-1).generic,'ordinary point focus retains the existing overview');
 send({action:'facade-focus',focus:{floor:'2F',longitude:126.9,latitude:37.5,height:37,cameraHeading:88}});assert.equal(facadeFocus.cameraHeading,88,'the established facade focus path is unchanged');
 const largeImage='data:image/png;base64,'+'A'.repeat(1_600_000);send({action:'facade-preview',slotAlias:'TEST-S01',imageUrl:largeImage});assert.equal(preview.imageUrl.length,largeImage.length,'a valid stored-image-sized preview is not truncated at the old 1.5MB limit');
 const accepted=preview;send({action:'facade-preview',slotAlias:'TEST-S01',imageUrl:'data:image/png;base64,'+'A'.repeat(6_400_020)});assert.equal(preview,accepted,'over-limit image input is rejected');
 const live=[...surfaceCollection.values];bridge.dispose();assert.equal(listeners.has('message'),false);assert.equal(dataSources.values.length,0);assert.equal(scenePrimitives.values.length,0);assert(live.every(p=>p.destroyed));
 assert.deepEqual(draftAliases,[],'leaving a private preview restores the approved facade layer');
 assert.equal(tileEvents.tileVisible.listeners.size+tileEvents.tileFailed.listeners.size+viewer.scene.postRender.listeners.size,0,'dispose also cancels an unfinished facade/floor render observer');
}finally{for(const [name,value]of Object.entries(globals)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}}
console.log('PASS: approved surfaces preserved; legacy assets retained; composite doorway/raised and tilted quads, exact UVs, floor/pick metadata, immutable inputs; indoor asset framing, facade focus preserved; private preview size bounds and graphics/listener disposal.');
