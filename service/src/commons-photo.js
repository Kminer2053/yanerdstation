import * as T from 'three';
import {avatarStyle} from './commons-avatar-styles.js';
import {placePhotoView} from './commons-photo-framing.js';
const poses=new Set(['idle','wave','bow','cheer','sit']);
// Game navigation guides are useful while walking but do not belong in a photo.
export function hidePhotoGuides(scene){const saved=[];scene.traverse(object=>{if(object.name==='walking-route'||object.name?.startsWith('commons-connection-')){saved.push([object,object.visible]);object.visible=false;}});return ()=>{for(const[object,visible]of saved)object.visible=visible;};}

// A photograph is a fresh scene render followed immediately by a canvas copy.
// No camera device, image substitution or persistent drawing buffer is used.
export function captureCommonsFrame({renderer,scene,camera,actors,self,people=[],time=0,pose='wave',lookAt,photoView,clip,createCanvas=()=>document.createElement('canvas')}){
 if(!self||![self.x,self.z].every(Number.isFinite))throw Error('사진을 찍을 보행 위치를 확인해 주세요.');
 const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,aspect:camera.aspect,size:renderer.getSize?.(new T.Vector2())},style=avatarStyle(self),height=style.height*1.96;
 const target=new T.Vector3(self.x,(self.y||0)+height*.53,self.z),away=new T.Vector3(Math.sin(self.yaw||0),0,-Math.cos(self.yaw||0));
 if(Array.isArray(lookAt)&&lookAt.length===3&&lookAt.every(Number.isFinite)&&Math.hypot(lookAt[0]-self.x,lookAt[2]-self.z)>.3)away.set(self.x-lookAt[0],0,self.z-lookAt[2]).normalize();
 const destination=target.clone().addScaledVector(away,Math.max(2.35,height*1.65));destination.y=(self.y||0)+height*.64;
 const placeView=placePhotoView(self,photoView,1.6);if(placeView){target.copy(placeView.target);destination.copy(placeView.position);}
 clip?.(new T.Vector3(self.x,(self.y||0)+height*.53,self.z),destination,destination);
 const photographed={...self,moving:false,jump:0,pose:poses.has(pose)?pose:'wave',yaw:Math.atan2(destination.x-self.x,-(destination.z-self.z))};
 const cast=[photographed,...people.filter(p=>!p.self&&p.id!==self.id&&(!p.floor||p.floor===self.floor))];
 try{
  if(placeView&&saved.size&&renderer.setSize){renderer.setSize(1280,800,false);camera.aspect=1.6;}camera.position.copy(destination);camera.fov=placeView?.fov||42;camera.lookAt(target);camera.updateProjectionMatrix();actors.update(cast,time);renderer.render(scene,camera);
  const source=renderer.domElement,canvas=createCanvas(),scale=Math.min(1,1440/source.width);canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('이 브라우저에서 사진을 복사하지 못했어요.');context.drawImage(source,0,0,canvas.width,canvas.height);return canvas;
 }finally{camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.aspect=saved.aspect;if(placeView&&saved.size&&renderer.setSize)renderer.setSize(saved.size.x,saved.size.y,false);camera.updateProjectionMatrix();actors.update(people,time);}
}
