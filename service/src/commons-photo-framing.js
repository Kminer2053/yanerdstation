import * as T from 'three';
import {avatarStyle} from './commons-avatar-styles.js';
export function boundsCorners(bounds){return [0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>new T.Vector3(bounds[x*3],bounds[1+y*3],bounds[2+z*3]))));}
export function placePhotoView(self,preset,aspect=1.6){
 if(!preset?.bounds||preset.bounds.length!==6||!preset.bounds.every(Number.isFinite)||!Array.isArray(preset.front))return null;
 const height=avatarStyle(self).height*2.15,bounds=[...preset.bounds];for(const p of [[self.x-.5,self.y||0,self.z-.5],[self.x+.5,(self.y||0)+height,self.z+.5]])for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],p[k]);bounds[k+3]=Math.max(bounds[k+3],p[k]);}
 const points=boundsCorners(bounds),target=new T.Vector3((bounds[0]+bounds[3])/2,(bounds[1]+bounds[4])/2,(bounds[2]+bounds[5])/2),out=new T.Vector3(preset.front[0],0,preset.front[1]).normalize();
 if(out.lengthSq()<.5)return null;
 const fov=preset.kind==='stairs'?68:54,probe=new T.PerspectiveCamera(fov,aspect,.07,1200),eye=(self.y||0)+(preset.eyeHeight||1.65);let distance=preset.kind==='stairs'?12:4;
 for(let step=0;step<28;step++){
  probe.position.copy(target).addScaledVector(out,distance);probe.position.y=eye;probe.lookAt(target);probe.updateMatrixWorld();probe.updateProjectionMatrix();
  if(points.every(p=>{const v=p.clone().project(probe);return Math.abs(v.x)<.88&&Math.abs(v.y)<.88&&v.z>-1&&v.z<1;}))break;
  distance*=1.12;
 }
 return {position:probe.position.clone(),target,fov,aspect,bounds,eyeHeight:eye};
}
