import * as T from 'three';
import {createAvatarBatch} from './commons-avatars.js';
import {avatarStyle} from './commons-avatar-styles.js';
export function createFourcutAvatar(){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setSize(600,800,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.setClearColor('#000000',0);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,.75,.07,30);scene.add(new T.HemisphereLight('#fff6e5','#829b90',2.8));const light=new T.DirectionalLight('#fff1db',2.4);light.position.set(-3,6,-5);scene.add(light);const batch=createAvatarBatch(scene);let disposed=false;
 batch.setProductTexture('/assets/commons/guunran-sai-package.png','/assets/commons/guunran-sai-can.png').catch(()=>{});
 return {capture(person,pose='wave',time=0){if(disposed)throw Error('촬영 화면을 다시 열어 주세요.');const height=avatarStyle(person).height*2.15,at={...person,id:'fourcut-portrait',self:true,x:0,y:0,z:0,yaw:0,moving:false,jump:0,pose};camera.position.set(0,height*.52,-height*1.7);camera.lookAt(0,height*.51,0);batch.update([at],time);renderer.render(scene,camera);const result=document.createElement('canvas');result.width=600;result.height=800;result.getContext('2d').drawImage(renderer.domElement,0,0);return result;},dispose(){if(disposed)return;disposed=true;batch.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
