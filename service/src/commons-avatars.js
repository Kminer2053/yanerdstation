import * as T from 'three';
import {PALETTE} from './commons-core.js';
import {avatarStyle} from './commons-avatar-styles.js';

export const AVATAR_CAPACITY=32;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function contactTexture(){const edge=32,bytes=new Uint8Array(edge*edge*4);for(let y=0;y<edge;y++)for(let x=0;x<edge;x++){const at=(y*edge+x)*4,r=Math.hypot((x+.5)/edge*2-1,(y+.5)/edge*2-1);bytes.set([35,47,43,Math.round(Math.max(0,1-r)**2*90)],at);}const texture=new T.DataTexture(bytes,edge,edge);texture.needsUpdate=true;return texture;}

// Every named part is one instanced draw, even with a full room. Optional hair,
// uniforms and props occupy compact instance ranges rather than separate actors.
export function createAvatarBatch(scene,{onChange=()=>{}}={}){
 const parts=new Map(),dummy=new T.Object3D(),color=new T.Color(),localQ=new T.Quaternion(),yawQ=new T.Quaternion(),leanQ=new T.Quaternion(),direction=V(),boneQ=new T.Quaternion(),axisY=V(0,1,0),axisX=V(1,0,0),textures=new Set();let disposed=false,textureVersion=0;
 const material=()=>new T.MeshStandardMaterial({color:'#ffffff',roughness:.8,metalness:0});
 const add=(name,g,m=material(),multiple=1)=>{const mesh=new T.InstancedMesh(g,m,AVATAR_CAPACITY*multiple);mesh.name='avatar:'+name;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);parts.set(name,{mesh,count:0});return mesh;};
 const sphere=()=>new T.SphereGeometry(1,12,8),box=()=>new T.BoxGeometry(1,1,1);
 add('coat',new T.CylinderGeometry(.25,.23,.62,12));add('shirt',box());add('hips',new T.CapsuleGeometry(.18,.12,3,10));add('skirt',new T.CylinderGeometry(.22,.31,.38,12));
 add('head',sphere());add('ears',sphere(),material(),2);add('neck',new T.CylinderGeometry(.067,.075,.16,8));add('nose',sphere());
 add('hair',new T.SphereGeometry(1,12,7,0,Math.PI*2,0,Math.PI*.58));add('hair-volume',sphere(),material(),3);add('ribbon',sphere(),material(),2);
 add('eyes-white',sphere(),material(),2);add('pupils',sphere(),new T.MeshBasicMaterial({color:'#ffffff'}),2);add('brows',box(),material(),2);add('cheeks',sphere(),material(),2);
 add('smile',new T.TorusGeometry(.044,.008,4,10,Math.PI),new T.MeshBasicMaterial({color:'#ffffff'}));add('glasses',new T.TorusGeometry(.058,.008,4,12),material(),2);add('glasses-bridge',box());add('moustache',sphere());
 add('arms',new T.CapsuleGeometry(1,1,3,8),material(),4);add('hands',sphere(),material(),2);add('legs',new T.CapsuleGeometry(1,1,3,8),material(),4);add('shoes',new T.CapsuleGeometry(1,1,3,8),material(),2);
 add('trim',box(),material(),8);add('buttons',sphere(),material(),3);add('backpack',new T.CapsuleGeometry(1,1,3,8));add('bag',box());add('bag-handle',new T.TorusGeometry(.085,.015,4,10));
 add('case',new T.BoxGeometry(.31,.43,.23));add('case-ridges',box(),material(),3);add('case-handle',box(),material(),3);add('case-wheels',new T.CylinderGeometry(.035,.035,.045,8),material(),2);
 add('cap',new T.CylinderGeometry(.215,.225,.09,12));add('cap-brim',sphere());add('badge',sphere(),material(),2);
 const shadowMap=contactTexture();textures.add(shadowMap);add('shadow',new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}));
 add('block-body',box());add('block-cab',box());add('block-windows',box(),material(),3);add('block-wheels',sphere(),material(),4);add('block-studs',new T.CylinderGeometry(.018,.018,.018,7),material(),4);
 add('can',new T.CylinderGeometry(.064,.064,.25,12));add('can-lid',new T.CylinderGeometry(.064,.064,.008,12),material(),2);const canLabel=add('can-label',new T.PlaneGeometry(.12,.18),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide}));
 add('eggs',sphere(),material(),2);add('package',box(),new T.MeshStandardMaterial({color:'#d9eee7',transparent:true,opacity:.22,roughness:.18,depthWrite:false}));
 const packageLabel=add('package-label',new T.PlaneGeometry(.19,.18),new T.MeshBasicMaterial({color:'#d6c6a2',side:T.DoubleSide}));
 function put(name,p,offset,scale=[1,1,1],rotation=[0,0,0],shade='#ffffff',upper=true){
  const part=parts.get(name),i=part.count++;if(i>=part.mesh.instanceMatrix.count)throw Error('아바타 인스턴스 범위를 벗어났습니다.');
  const style=p.style,h=style.height,yaw=-p.yaw,lean=(p.pose==='bow'?-.44:-(style.stoop||0)),sink=p.pose==='sit'?-.38:0;
  let [x,y,z]=offset;if(upper&&y>=.88){const cy=y-.88;y=.88+cy*Math.cos(lean)-z*Math.sin(lean)+sink;z=cy*Math.sin(lean)+z*Math.cos(lean);}else if(name!=='shadow'&&name!=='legs'&&name!=='shoes'&&name!=='case'&&name!=='case-ridges'&&name!=='case-handle'&&name!=='case-wheels')y+=sink;
  const c=Math.cos(yaw),s=Math.sin(yaw);dummy.position.set(p.x+h*(x*c+z*s),(p.y||0)+h*y+(name==='shadow'?0:p.jump||0),p.z+h*(-x*s+z*c));
  localQ.setFromEuler(new T.Euler(...rotation));if(upper&&offset[1]>=.88)localQ.premultiply(leanQ.setFromAxisAngle(axisX,lean));dummy.quaternion.copy(localQ).premultiply(yawQ.setFromAxisAngle(axisY,yaw));dummy.scale.set(scale[0]*h,scale[1]*h,scale[2]*h);dummy.updateMatrix();part.mesh.setMatrixAt(i,dummy.matrix);part.mesh.setColorAt(i,color.set(shade));
 }
 function bone(name,p,a,b,r,shade){direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=direction.length();boneQ.setFromUnitVectors(axisY,direction.normalize());const e=new T.Euler().setFromQuaternion(boneQ);put(name,p,a.map((v,i)=>(v+b[i])/2),[r,(length+r*2)/3,r],[e.x,e.y,e.z],shade,name==='arms');}
 function drawPerson(input,time,index){
  const style=avatarStyle(input),p={...input,yaw:Number.isFinite(input.yaw)?input.yaw:0,style},w=style.width,head=style.head,staff=style.staff,phase=p.moving?Math.sin(time*8+index*.7)*.55:0,bob=p.moving?Math.cos(time*16+index)*.018:Math.sin(time*1.8+index)*.005;
  p.y=(p.y||0)+bob;const accent=staff?'#d7be77':PALETTE[((p.color||0)%PALETTE.length+PALETTE.length)%PALETTE.length],faceZ=-(style.stoop||0),hair=style.hair;
  put('coat',p,[0,1.12,0],[w,1,.96],[0,0,0],style.coat);put('shirt',p,[0,1.23,-.232],[.19,.37,.025],[0,0,0],style.shirt);put('hips',p,[0,.765,0],[w,1,.76],[0,0,0],style.trousers,false);put('neck',p,[0,1.47,0],[1,1,1],[0,0,0],style.skin);
  if(style.skirt)put('skirt',p,[0,.73,0],[w,1,1],[0,0,0],style.coat,false);
  put('head',p,[0,1.66,faceZ],[.195*head,.225*head,.185*head],[0,0,0],style.skin);
  for(const sign of [-1,1]){put('ears',p,[sign*.188*head,1.655,faceZ],[.045,.065,.035],[0,0,0],style.skin);put('eyes-white',p,[sign*.072*head,1.7,faceZ-.169*head],[.041,.045,.025],[0,0,0],'#fffaf2');put('pupils',p,[sign*.071*head,1.7,faceZ-.192*head],[.021,.028,.012],[0,0,0],'#273337');put('brows',p,[sign*.073*head,1.768,faceZ-.171*head],[.064,.013,.017],[0,0,sign*.1],hair);put('cheeks',p,[sign*.112*head,1.61,faceZ-.16*head],[.029,.018,.014],[0,0,0],'#d58e7b');
   if(style.glasses)put('glasses',p,[sign*.073*head,1.7,faceZ-.207*head],[1,1,1],[0,0,0],'#625b50');
  }
  put('nose',p,[0,1.64,faceZ-.186*head],[.03,.04,.045],[0,0,0],style.skin);put('smile',p,[0,1.58,faceZ-.175*head],[1,1,1],[0,0,Math.PI],'#81504a');
  if(style.glasses)put('glasses-bridge',p,[0,1.703,faceZ-.212*head],[.04,.009,.009],[0,0,0],'#625b50');if(style.moustache)put('moustache',p,[0,1.595,faceZ-.188*head],[.065,.018,.025],[0,0,0],hair);
  if(style.hairStyle!=='balding')put('hair',p,[0,1.69,faceZ+.015],[.207*head,.225*head,.194*head],[0,0,0],hair);
  if(style.hairStyle==='swept'||style.hairStyle==='crop')put('hair-volume',p,[-.067,1.853,faceZ-.05],[.13,.065,.13],[0,0,-.2],hair);
  if(style.hairStyle==='bob')put('hair-volume',p,[0,1.65,faceZ+.08],[.218,.24,.135],[0,0,0],hair);
  if(style.hairStyle==='bun')put('hair-volume',p,[0,1.86,faceZ+.13],[.092,.10,.092],[0,0,0],hair);
  if(style.hairStyle==='pigtails'||style.hairStyle==='balding')for(const sign of [-1,1]){put('hair-volume',p,[sign*(style.hairStyle==='balding'?.19:.22),style.hairStyle==='balding'?1.74:1.63,faceZ+.035],[.075,style.hairStyle==='balding'?.105:.12,.105],[0,0,sign*.2],hair);if(style.hairStyle==='pigtails')put('ribbon',p,[sign*.213,1.72,faceZ-.02],[.055,.025,.025],[0,0,sign*.5],'#efb0b0');}
  for(let side=0;side<2;side++){
   const sign=side?1:-1,a=phase*sign,hip=[sign*.115,.77,0],knee=p.pose==='sit'?[sign*.115,.4,-.33]:[sign*.115,.43+.34*(1-Math.cos(a)),-.34*Math.sin(a)],ankle=p.pose==='sit'?[sign*.115,.075,-.34]:[sign*.115,.085+Math.max(0,-a)*.2,-.55*Math.sin(a)];
   if(p.pose==='sit')hip[1]-=.38;bone('legs',p,hip,knee,.086,style.trousers);bone('legs',p,knee,ankle,.072,style.trousers);put('shoes',p,[ankle[0],ankle[1]-.015,ankle[2]-.06],[.082,.095,.053],[Math.PI/2,0,0],style.shoes,false);
   const shoulder=[sign*.247*w,1.38,0];let elbow=[sign*.275*w,1.13,-Math.sin(a)*.18],hand=[sign*.30*w,.91,-Math.sin(a)*.29];
   if(p.pose==='cheer'){elbow=[sign*.32,1.68,-.02];hand=[sign*.31,1.99,-.05];}else if(p.pose==='wave'&&side===1){elbow=[sign*.38,1.61,-.03];hand=[sign*(.39+Math.sin(time*8)*.035),1.87,Math.sin(time*9)*.065];}
   else if(p.pose==='bow'){elbow=[sign*.24,1.16,-.16];hand=[sign*.075,1.04,-.29];}
   else if(p.pose==='sit'){elbow=[sign*.28,1.13,-.14];hand=[sign*.18,.92,-.34];}
   if(side===0&&p.heldItem){elbow=[-.29,1.16,-.12];hand=[-.32,1.05,-.31];}
   if(side===1&&style.luggage&&p.pose!=='cheer'&&p.pose!=='wave'&&p.pose!=='sit'){elbow=[.29,1.12,.12];hand=[.34,.94,.29];}
   bone('arms',p,shoulder,elbow,.075,style.coat);bone('arms',p,elbow,hand,.063,style.coat);put('hands',p,hand,[.071,.079,.065],[0,0,0],style.skin);
  }
  for(const sign of [-1,1])put('trim',p,[sign*.123,1.24,-.247],[.018,.38,.015],[0,0,sign*.08],staff?'#c6a85e':accent);
  for(let i=0;i<3;i++)put('buttons',p,[0,1.19-i*.11,-.252],[.014,.014,.01],[0,0,0],staff?'#cfbc7b':'#d9d4c4');
  if(style.backpack){put('backpack',p,[0,1.18,.22],[.17,.16,.085],[0,0,0],style.bag);for(const sign of [-1,1])put('trim',p,[sign*.18,1.25,-.18],[.035,.38,.025],[0,0,sign*.1],style.bag);put('trim',p,[0,1.22,.35],[.24,.055,.02],[0,0,0],accent);}
  if(style.handbag){put('bag',p,[.36,.72,.04],[.20,.20,.11],[0,0,.1],style.bag,false);put('bag-handle',p,[.36,.85,.04],[.75,.85,1],[0,0,0],style.bag,false);}
  if(style.luggage&&p.pose!=='sit'){
   const tilt=-.14+(p.moving?Math.sin(time*8)*.018:0);put('case',p,[.43,.29,.62],[1,1,1],[tilt,0,0],style.bag,false);for(let k=0;k<3;k++)put('case-ridges',p,[.34+k*.09,.29,.495],[.012,.33,.014],[tilt,0,0],'#e0c392',false);
   for(const sign of [-1,1]){const a=[.43+sign*.07,.49,.59],b=[.34+sign*.07,.94,.29];direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=direction.length(),e=new T.Euler().setFromQuaternion(boneQ.setFromUnitVectors(axisY,direction.normalize()));put('case-handle',p,a.map((v,i)=>(v+b[i])/2),[.013,length,.013],[e.x,e.y,e.z],'#bdc4c3',false);put('case-wheels',p,[.43+sign*.125,.055,.64],[1,1,1],[0,0,Math.PI/2],'#25313a',false);}put('case-handle',p,[.34,.94,.29],[.18,.035,.035],[0,0,0],'#3c4549',false);
  }
  if(staff){put('cap',p,[0,1.92,faceZ],[1,1,1],[0,0,0],'#233a59');put('cap-brim',p,[0,1.887,faceZ-.14],[.18,.018,.13],[0,0,0],'#192d46');put('trim',p,[0,1.90,faceZ-.213],[.28,.02,.015],[0,0,0],'#d1b96c');put('badge',p,[0,1.93,faceZ-.219],[.028,.027,.012],[0,0,0],'#edcb69');put('badge',p,[.115,1.28,-.25],[.028,.036,.01],[0,0,0],'#e3c777');put('trim',p,[0,1.29,-.254],[.035,.22,.01],[0,0,0],'#4d8eb0');}
  if(p.heldItem==='rail-block'){
   const at=[-.32,1.085,-.36],part=(name,off,size,shade,rot=[0,0,0])=>put(name,p,off.map((v,i)=>v+at[i]),size,rot,shade);
   part('block-body',[0,0,0],[.36,.13,.15],'#efc74a');part('block-cab',[-.105,.10,.01],[.13,.10,.14],'#e7eee7');for(let k=0;k<3;k++)part('block-windows',[-.105+k*.105,.035,-.078],[.065,.048,.009],'#356a89');for(const x of [-.12,.12])for(const z of [-.071,.071])part('block-wheels',[x,-.072,z],[.032,.032,.016],'#34414c');for(let k=0;k<4;k++)part('block-studs',[-.13+k*.085,.078,0],[1,1,1],'#dba743');
  }
  if(p.heldItem==='storyway-set'){
   const at=[-.34,1.085,-.38],part=(name,off,size,shade,rot=[0,0,0])=>put(name,p,off.map((v,i)=>v+at[i]),size,rot,shade);
   part('package',[.065,0,0],[.25,.23,.14],'#ffffff');for(const x of [.015,.12])part('eggs',[x,.04,-.013],[.052,.069,.047],'#b8753f');part('package-label',[.07,-.025,-.077],[1,1,1],'#ffffff',[0,Math.PI,0]);part('can',[-.13,.015,0],[1,1,1],'#176b49');for(const y of [-.11,.14])part('can-lid',[-.13,y,0],[1,1,1],'#bec9c3');part('can-label',[-.13,.015,-.065],[.75,.9,1],'#ffffff',[0,Math.PI,0]);
  }
  const ground={...p,y:(input.y||0),jump:0};put('shadow',ground,[0,.018,0],[style.luggage?.95:.8,.58,1],[-Math.PI/2,0,0],'#ffffff',false);
 }
 return {
  update(actors,time=0){if(disposed)return;for(const part of parts.values())part.count=0;actors.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)).slice(0,AVATAR_CAPACITY).forEach((p,i)=>drawPerson(p,time,i));for(const {mesh,count}of parts.values()){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}},
  height(person){return avatarStyle(person).height*(person?.npcRole==='staff'?2.01:1.96);},
  async setProductTexture(url,canUrl){const version=++textureVersion;const results=await Promise.allSettled([url,canUrl].map(value=>value?new T.TextureLoader().loadAsync(value):Promise.resolve(null)));let failure=null;for(let i=0;i<results.length;i++){const result=results[i];if(result.status==='rejected'){failure=result.reason;continue;}const texture=result.value;if(!texture)continue;if(disposed||version!==textureVersion){texture.dispose();continue;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;const mesh=i===0?packageLabel:canLabel,old=mesh.material.map;if(old){textures.delete(old);old.dispose();}mesh.material.map=texture;mesh.material.color.set('#ffffff');mesh.material.needsUpdate=true;textures.add(texture);}if(!disposed&&version===textureVersion)onChange();if(failure)throw failure;},
  dispose(){if(disposed)return;disposed=true;textureVersion++;for(const {mesh}of parts.values()){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}for(const texture of textures)texture.dispose();textures.clear();parts.clear();},
 };
}
