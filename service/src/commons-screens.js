import * as T from 'three';
import config from '../app/seoul-platform111.json' with {type:'json'};
import windowLayout from '../app/seoul-platform111-window.json' with {type:'json'};
import {platform111Spans,platform111MessageRepeat} from '../app/seoul-platform111.js';
import {PLATFORM111_MEDIA,acquirePlatformSlides} from '../app/platform111-slides.js';
export async function createCommonsScreens(scene,hall,onChange){
 const loader=new T.TextureLoader();
 const images={...PLATFORM111_MEDIA.images,message:PLATFORM111_MEDIA.message,tids:'/data/commons/screens/departures.webp'};
 const textures=Object.fromEntries(await Promise.all(Object.entries(images).map(async ([key,url])=>{
  const texture=await loader.loadAsync(url);texture.colorSpace=T.SRGBColorSpace;return [key,texture];
 })));
 const meshes=[],media=[];
 for(const layout of [config,windowLayout])for(const s of [config.media,config.tids]){const positions=[],uv=[],indices=[];for(const span of platform111Spans(s,layout)){const offset=positions.length/3,a=span.a,b=span.b,c=b.map((v,i)=>v+(i===2?layout.height:0)),d=a.map((v,i)=>v+(i===2?layout.height:0));for(const p of [a,b,c,d])positions.push(p[0]-hall.origin.east0,p[2]-hall.origin.up0,hall.origin.north0-p[1]);const scale=1/(s.end-s.start),u0=(span.start-s.start)*scale,u1=(span.end-s.start)*scale;uv.push(u0,0,u1,0,u1,1,u0,1);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);const material=new T.MeshBasicMaterial({map:textures[s===config.media?layout.floor:'tids'],side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mesh=new T.Mesh(g,material);mesh.renderOrder=2;mesh.userData.floor=layout.floor;scene.add(mesh);meshes.push(mesh);
  if(s===config.media){
   const message=textures.message.clone();message.wrapS=T.RepeatWrapping;message.repeat.x=platform111MessageRepeat(layout);message.needsUpdate=true;
   media.push({mesh,photo:textures[layout.floor],message});
  }
 }
 const playback=acquirePlatformSlides(scene,index=>{for(const {mesh,photo,message} of media)mesh.material.map=index?message:photo;onChange();});
 return {
  setVisibility(floor){for(const mesh of meshes)mesh.visible=mesh.userData.floor===floor;playback.setActive(media.some(({mesh})=>mesh.visible));onChange();},
  dispose(){playback.destroy();for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}for(const {message} of media)message.dispose();for(const t of Object.values(textures))t.dispose();},
 };
}
