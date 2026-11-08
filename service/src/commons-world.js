import * as T from 'three';
import {validPoint,nearestCell,routeAcross} from './commons-core.js';
import {createDetailStreaming} from './commons-textures.js';
import {createCommonsScreens} from './commons-screens.js';
import {createCustomWorld} from './commons-custom.js';
import {createConnectionMarkers} from './commons-connections.js';
import {createCameraCollision} from './commons-camera-collision.js';
import {createAvatarBatch} from './commons-avatars.js';
import {captureCommonsFrame,hidePhotoGuides} from './commons-photo.js';
import {createRouteDisplay} from './commons-route-display.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function geometry(positions,uv,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(indices)g.setIndex(Array.isArray(indices)?indices:new T.BufferAttribute(indices,1));g.computeVertexNormals();return g;}
function pattern(ceiling=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=ceiling?'#d7d9d2':'#c8c9bd';c.fillRect(0,0,512,512);
 const n=ceiling?10:6,s=512/n;c.strokeStyle=ceiling?'#bfc5bf':'#abb4aa';c.lineWidth=1;
 for(let i=0;i<n;i++){c.beginPath();c.moveTo(i*s,0);c.lineTo(i*s,512);c.stroke();c.beginPath();c.moveTo(0,i*s);c.lineTo(512,i*s);c.stroke();}
 if(ceiling){const glow=c.createRadialGradient(256,256,10,256,256,100);glow.addColorStop(0,'#ffffff');glow.addColorStop(.4,'#f5fcff');glow.addColorStop(1,'#d7d9d200');c.fillStyle=glow;c.fillRect(156,156,200,200);c.fillStyle='#97a4a0';c.fillRect(228,228,56,56);c.fillStyle='#fcffff';c.fillRect(233,233,46,46);}
 else{for(let i=0;i<1100;i++){const x=(i*137.3)%512,y=(i*83.67)%512;c.fillStyle=i%2?'#fff1':'#5361520e';c.fillRect(x,y,1.5,1.5);}c.strokeStyle='#d4d6c9';c.lineWidth=5;c.strokeRect(0,0,512,512);}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
function skyTexture(sunset=false){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,512);
 g.addColorStop(0,sunset?'#586a8b':'#71abd0');g.addColorStop(.55,sunset?'#ebbe9c':'#d1e6ec');g.addColorStop(1,sunset?'#f0d8b7':'#ecf0e7');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
 for(let i=0;i<32;i++){const x=(i*193.7)%1024,y=110+(i*53)%160;const cloud=ctx.createRadialGradient(x,y,2,x,y,90);cloud.addColorStop(0,sunset?'#ffedda66':'#ffffff88');cloud.addColorStop(1,'#ffffff00');ctx.fillStyle=cloud;ctx.save();ctx.translate(0,y*.5);ctx.scale(1,.5);ctx.fillRect(x-95,y-95,190,190);ctx.restore();}
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export async function createCommonsWorld({host,hall,architecture,custom,indexes,onFacility,onPosition,onError,onStats}){
 let currentFloor='2F',index=indexes[currentFloor];
 const mobile=matchMedia('(max-width:650px)').matches,renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#dce7e4');scene.fog=new T.Fog('#dce7e4',140,500);
 const camera=new T.PerspectiveCamera(58,1,.07,1200),look=new T.Vector3(),desired=new T.Vector3();camera.position.set(18,19,26);look.set(0,.8,0);camera.lookAt(look);
 const ambient=new T.HemisphereLight('#f5faf4','#9d9581',2.4),sun=new T.DirectionalLight('#fff4db',2.1);sun.position.set(-20,40,8);scene.add(ambient,sun);
 const daySky=skyTexture(),eveningSky=skyTexture(true),sky=new T.Mesh(new T.SphereGeometry(1000,24,12),new T.MeshBasicMaterial({map:daySky,side:T.BackSide,depthWrite:false,fog:false,toneMapped:false}));scene.add(sky);
 const floorTexture=pattern(),floor=new T.Mesh(new T.PlaneGeometry(hall.extent[2]-hall.extent[0]+15,hall.extent[3]-hall.extent[1]+15),new T.MeshStandardMaterial({map:floorTexture,roughness:.92,color:'#dce0d5'}));floor.rotation.x=-Math.PI/2;floor.position.set((hall.extent[0]+hall.extent[2])/2,-.025,(hall.extent[1]+hall.extent[3])/2);floorTexture.repeat.set((hall.extent[2]-hall.extent[0]+15)/3.6,(hall.extent[3]-hall.extent[1]+15)/3.6);scene.add(floor);
 const ceilingPositions=hall.ceilings.flat(2),ceilingUV=hall.ceilings.flatMap(t=>t.flatMap(p=>[p[0]/6,p[2]/6]));
 const roof=new T.Mesh(geometry(ceilingPositions,ceilingUV),new T.MeshBasicMaterial({map:pattern(true),side:T.DoubleSide,color:'#f6f7ed',toneMapped:false}));scene.add(roof);
 const pavement=new T.InstancedMesh(new T.BoxGeometry(1.95,.012,1.95),new T.MeshStandardMaterial({color:'#d6d8c9',roughness:1,transparent:true,opacity:.26}),hall.walk.points.length),dummy=new T.Object3D();
 hall.walk.points.forEach((p,i)=>{dummy.position.set(p[0],p[1]-.012,p[2]);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pavement.setMatrixAt(i,dummy.matrix);});scene.add(pavement);
 const pointCloud=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:'#498e77',size:3,sizeAttenuation:false,transparent:true,opacity:.75,depthWrite:false}));scene.add(pointCloud);
 // Load the merged two-floor architectural shell without original tile payloads.
 const shellResponse=await fetch(architecture.url+'?v='+architecture.version);if(!shellResponse.ok)throw Error('서울역 건축 형상을 불러오지 못했어요.');const shellBytes=await shellResponse.arrayBuffer(),shells=[];
 const architectureTexture=architecture.texture?await new T.TextureLoader().loadAsync(architecture.texture+'?v='+architecture.version):null;if(architectureTexture){architectureTexture.colorSpace=T.SRGBColorSpace;architectureTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
 for(const group of architecture.groups){const positions=new Float32Array(shellBytes,group.positions.byteOffset,group.positions.count),indices=new Uint32Array(shellBytes,group.indices.byteOffset,group.indices.count),uv=group.uv?new Float32Array(shellBytes,group.uv.byteOffset,group.uv.count):null,material=new T.MeshStandardMaterial({...group.material,map:uv?architectureTexture:null,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,depthWrite:!group.material.transparent});const g=geometry(positions,uv,indices);if(group.kind==='floors'){const tileUV=[];for(let i=0;i<positions.length;i+=3)tileUV.push(positions[i]/3.6/floorTexture.repeat.x,positions[i+2]/3.6/floorTexture.repeat.y);g.setAttribute('uv',new T.Float32BufferAttribute(tileUV,2));material.map=floorTexture;material.color.set('#dce0d5');}const mesh=new T.Mesh(g,material);mesh.name=group.name;mesh.userData={floor:group.floor,kind:group.kind,roofContext:group.roofContext};scene.add(mesh);shells.push(mesh);}
 const texture=await new T.TextureLoader().loadAsync(hall.atlas+'?v='+hall.version);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const shops=[];for(const floor of Object.keys(hall.floors)){const positions=[],uv=[],triangles=[],pickIds=[];for(const f of hall.facades.filter(f=>f.floor===floor)){const offset=positions.length/3;positions.push(...f.positions);uv.push(...f.uv);triangles.push(...f.indices.map(i=>i+offset));for(let i=0;i<f.indices.length/3;i++)pickIds.push(f.facilityId);}const mesh=new T.Mesh(geometry(positions,uv,triangles),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.renderOrder=2;mesh.userData={floor,pickIds};scene.add(mesh);shops.push(mesh);}
 const actors=createAvatarBatch(scene,{onChange:()=>dirty=true}),ray=new T.Raycaster(),pointer=new T.Vector2();
 let lastTick=null;
 const routeDisplay=createRouteDisplay(scene);let overview=true,overviewZoom=1,dark=false,dirty=true,distance=5.3,disposed=false,lastStats=0,renderCount=0,frames=0,frameMs=0,lastActorState='',snapCamera=false;
 const projected=new T.Vector3(),detailRayEnd=new T.Vector3(),detailRayHit=new T.Vector3();let detailFocus=null,detailFocusAt=-10;
 const customWorld=await createCustomWorld({scene,custom,onChange:()=>dirty=true});
 const details=createDetailStreaming({scene,renderer,hall:{...hall,facades:[...hall.facades,...custom.photos]},architecture,shells,mobile,onChange:()=>dirty=true});
 const screens=await createCommonsScreens(scene,hall,()=>dirty=true);
 const markers=createConnectionMarkers(scene,hall);
 const cameraCollision=createCameraCollision([...shells,roof,...shops,...customWorld.meshes]);
 actors.setProductTexture('/assets/commons/guunran-sai-package.png','/assets/commons/guunran-sai-can.png').catch(()=>{});
 const ceilingAt=(x,z,min)=>{let height=Infinity;for(const [a,b,c] of hall.ceilings){if(Math.min(a[1],b[1],c[1])<min)continue;const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;if(u>=0&&v>=0&&u+v<=1)height=Math.min(height,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return height;};
 const applyVisibility=()=>{roof.visible=!overview&&currentFloor==='2F';floor.visible=!overview||currentFloor==='2F';pavement.visible=!overview;pointCloud.visible=overview;for(const mesh of shells)mesh.visible=!overview||mesh.userData.floor===currentFloor&&mesh.userData.kind!=='roof';for(const mesh of shops)mesh.visible=!overview||mesh.userData.floor===currentFloor;customWorld.setVisibility(currentFloor,overview);markers.setFloor(currentFloor,overview);screens.setVisibility?.(currentFloor,overview);routeDisplay.setFloor(currentFloor,overview);pointCloud.geometry.dispose();pointCloud.geometry=new T.BufferGeometry().setFromPoints(index.nodes.filter(i=>{const p=hall.walk.points[i];return validPoint(index,p[0],p[2]);}).map(i=>{const p=hall.walk.points[i];return new T.Vector3(p[0],p[1]+.06,p[2]);}));dirty=true;};
 applyVisibility();
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const contextLost=e=>{e.preventDefault();onError?.('3D 그래픽 연결이 중단되었습니다. 페이지를 다시 열어 주세요.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 return {
  get canvas(){return renderer.domElement;},
  setProductTexture(url,canUrl){return actors.setProductTexture(url,canUrl);},
  captureFrame(options={}){if(disposed)throw Error('닫힌 공간에서는 사진을 찍을 수 없어요.');const previous=overview;let restoreGuides=()=>{};try{if(previous){overview=false;applyVisibility();}restoreGuides=hidePhotoGuides(scene);return captureCommonsFrame({renderer,scene,camera,actors,...lastTick,...options,clip:(...args)=>cameraCollision.clip(...args)});}finally{restoreGuides();overview=previous;if(previous)applyVisibility();dirty=true;}},
  setFloor(floor){if(!indexes[floor])return;currentFloor=floor;index=indexes[floor];applyVisibility();snapCamera=true;},
  setOverview(on){overview=on;applyVisibility();if(!on)snapCamera=true;},
  setDistance(change){if(overview)overviewZoom=clamp(overviewZoom+change*.1,.4,1.8);else distance=clamp(distance+change,2.5,8);dirty=true;},
  frameFacility(size){if(Array.isArray(size)&&size.every(Number.isFinite)){distance=clamp(Math.max(size[0],size[2]*1.5)*.75,5.3,8);snapCamera=true;dirty=true;}},
  light(){dark=!dark;sky.material.map=dark?eveningSky:daySky;scene.background.set(dark?'#ddc4a6':'#dce7e4');scene.fog.color.copy(scene.background);sun.color.set(dark?'#ffc18a':'#fff4db');sun.intensity=dark?1.3:2.1;ambient.intensity=dark?2:2.4;dirty=true;return dark;},
  pick(x,y){const box=renderer.domElement.getBoundingClientRect();pointer.set((x-box.left)/box.width*2-1,-(y-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(shops.filter(m=>m.visible))[0],other=customWorld.pick(ray);if(other&&(!hit||other.distance<hit.distance)){onFacility?.(other.facilityId||'asset:'+other.assetId);return;}if(hit&&hit.object.userData.pickIds[hit.faceIndex]){onFacility?.(hit.object.userData.pickIds[hit.faceIndex]);return;}if(overview){const p=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-hall.floors[currentFloor].height),new T.Vector3());if(p){const n=nearestCell(index,p.x,p.z);if(n>=0&&Math.hypot(hall.walk.points[n][0]-p.x,hall.walk.points[n][2]-p.z)<2.3)onPosition?.(hall.walk.pointIds[n]);}}},
  showRoute(plan){routeDisplay.show(plan);dirty=true;},
  clearRoute(){routeDisplay.clear();dirty=true;},
  routeTo(floor,x,z,facility){if(!facility?.access)return false;const plan=routeAcross(hall,indexes,floor,x,z,facility.floor||floor,facility.access[0],facility.access[2]);if(!plan)return false;routeDisplay.show(plan);dirty=true;return plan;},
  tick({self,people,time,dt,active}){
   if(disposed)return;lastTick={self,people,time};let unsettled=false;
   if(overview){const f=hall.floors[currentFloor],e=f.extent,w=e[2]-e[0],d=e[3]-e[1],cx=(e[0]+e[2])/2,cz=(e[1]+e[3])/2,halfFov=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)),range=Math.hypot(w,d)/2/Math.sin(halfFov)*1.04*overviewZoom;desired.set(.25,.95,.48).normalize().multiplyScalar(range).add(new T.Vector3(cx,f.height,cz));look.set(cx,f.height,cz);}
   else if(self.inTransit){
    desired.set(self.x,(self.y||0)+1.55,self.z);look.set(self.x+Math.sin(self.yaw)*2,(self.y||0)+1.4,self.z-Math.cos(self.yaw)*2);
   }else{
    let d=distance;const yaw=Number.isFinite(self.cameraYaw)?self.cameraYaw:self.yaw;
    for(let r=.6;r<=distance;r+=.3){const x=self.x-Math.sin(yaw)*r,z=self.z+Math.cos(yaw)*r;if(!validPoint(index,x,z)){d=Math.max(.6,r-.25);break;}}
    desired.set(self.x-Math.sin(yaw)*d,(self.y||0)+1.5+d*.17+self.pitch*2.5,self.z+Math.cos(yaw)*d);look.set(self.x,(self.y||0)+1.35-self.pitch*.8+(self.jump||0)*.25,self.z);
    desired.y=clamp(desired.y,(self.y||0)+1.2,ceilingAt(desired.x,desired.z,(self.y||0)+1.85)-.22);
    cameraCollision.clip(look,desired,desired);
   }
   if(snapCamera){camera.position.copy(desired);snapCamera=false;}
   const gap=camera.position.distanceToSquared(desired);unsettled=gap>.00003;camera.position.lerp(desired,Math.min(1,dt*9));if(!overview&&!self.inTransit)cameraCollision.clip(look,camera.position,camera.position);camera.lookAt(look);
   const state=people.map(p=>[p.id,p.floor,p.x.toFixed(3),(p.y||0).toFixed(3),p.z.toFixed(3),p.yaw.toFixed(3),p.pose,p.color,p.character,p.heldItem,p.npcRole,(p.jump||0).toFixed(3)].join(',')).join('|');if(state!==lastActorState){dirty=true;lastActorState=state;}
   const closeCamera=!overview&&Math.hypot(camera.position.x-self.x,camera.position.z-self.z)<1.1;actors.update(people.filter(p=>(!p.floor||p.floor===currentFloor)&&(!p.self||!overview&&!closeCamera)).sort((a,b)=>Number(!!b.self||b.npcRole==='staff')-Number(!!a.self||a.npcRole==='staff')),time);
   frames++;frameMs+=dt*1000;
   if(!overview&&time-detailFocusAt>=.6){detailFocusAt=time;detailRayEnd.copy(look).sub(camera.position).normalize().multiplyScalar(16).add(camera.position);detailFocus=cameraCollision.clip(camera.position,detailRayEnd,detailRayHit)?{x:detailRayHit.x,y:detailRayHit.y,z:detailRayHit.z}:null;}
   details.update(camera.position,time,overview,currentFloor,self.inTransit,detailFocus);markers.update(camera);
   if(active||unsettled||dirty){renderer.render(scene,camera);renderCount++;dirty=false;}
   if(!lastStats)lastStats=time;
   if(time-lastStats>1){const elapsed=time-lastStats;onStats?.({fps:Math.round(frames/elapsed),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,renders:Math.round(renderCount/elapsed),detailTextures:details.count(),mobile});lastStats=time;frames=frameMs=renderCount=0;}
  },
  labels(people){return people.map(p=>{projected.set(p.x,(p.y||0)+actors.height(p)+.16+(p.jump||0),p.z).project(camera);return {id:p.id,x:(projected.x*.5+.5)*host.clientWidth,y:(-projected.y*.5+.5)*host.clientHeight,visible:(!p.floor||p.floor===currentFloor)&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&Math.hypot(p.x-camera.position.x,p.z-camera.position.z)<23,npc:p.npc,self:p.self};});},
  invalidate(){dirty=true;},
  dispose(){disposed=true;observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);routeDisplay.dispose();cameraCollision.dispose();screens.dispose();markers.dispose();customWorld.dispose();details.dispose();actors.dispose();pointCloud.geometry.dispose();pointCloud.material.dispose();scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});daySky.dispose();eveningSky.dispose();renderer.dispose();renderer.domElement.remove();},
 };
}
