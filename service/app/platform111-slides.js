// The same locally served stills are used by the hall and travel game.
export const PLATFORM111_PHOTOS=[
 {file:'seoul-sunset',title:'SEOUL AT DUSK',label:'구 서울역의 황혼',author:'Matthias Ripp',license:'BY 2.0',source:'Seoul_Station_at_sunset,_shout_with_Leica_M10_and_Summicron_50mm.jpg',share:.21,focus:.56,brightness:1.15},
 {file:'keukenhof',title:'THE GARDEN',label:'케우켄호프의 튤립',author:'Omar AV',license:'BY 3.0',source:'Tulips_at_Keukenhof_-_panoramio.jpg',share:.16,focus:.69,brightness:1.02},
 {file:'zhangjiajie',title:'STONE AND MIST',label:'장가계 우링위안',author:'gdczjkk',license:'BY 3.0',source:'Wulingyuan,_Zhangjiajie,_Hunan,_China_-_panoramio.jpg',share:.22,focus:.43,brightness:1.04},
 {file:'ktx-cheongryong',title:'THE NEXT DEPARTURE',label:'서울역의 KTX-청룡',author:'생각하는 나무',license:'BY-SA 4.0',source:'KTX-Cheongryong_Waiting_at_Seoul_Station.jpg',share:.23,focus:.59,brightness:1.02},
 {file:'seoul-night',title:'TRACKS AFTER DARK',label:'서울역 선로 야경',author:'Tildin Han',license:'BY-SA 4.0',source:'Seoul_Station_Train_Tracks_at_Night.jpg',share:.18,focus:.66,brightness:1.09},
];
const link=(href,text)=>'<a href="'+href+'" target="_blank" rel="noopener noreferrer">'+text+'</a>';
const licenseUrl=license=>'https://creativecommons.org/licenses/'+license.toLowerCase().replace(' ','/')+'/';
export const PLATFORM111_MEDIA=Object.freeze({
 images:Object.freeze({'2F':'/assets/seoul-platform111/photo-panorama-2f.webp','3F':'/assets/seoul-platform111/photo-panorama-3f.webp'}),
 message:'/data/commons/screens/message.webp',messageAspect:3,
 holdMs:Object.freeze([8000,5000]),
 basis:'서울역과 자연 풍경의 공개 촬영 사진 다섯 장을 이어 만든 화면과 텍스트 안내를 번갈아 보여 줍니다.',
 creditHtml:PLATFORM111_PHOTOS.map(p=>link('https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(p.source),p.label+' · '+p.author)+' ('+link(licenseUrl(p.license),'CC '+p.license)+')').join(' · ')
  +' · 가로 크롭·밝기 보정·편성 · 편성 이미지 '+link(licenseUrl('BY-SA 4.0'),'CC BY-SA 4.0'),
});

// One slow clock per scene, shared by its two floor presentations.
const shared=new WeakMap();
export function acquirePlatformSlides(owner,notify,runtime={}){
 let controller=shared.get(owner);
 if(!controller){
  const doc=runtime.document??document,reduce=runtime.reduce??matchMedia('(prefers-reduced-motion: reduce)');
  const later=runtime.setTimeout??setTimeout,cancel=runtime.clearTimeout??clearTimeout,users=new Set();
  let timer=null,index=0;
  const running=()=>!doc.hidden&&!reduce.matches&&[...users].some(user=>user.active);
  const announce=()=>{for(const user of users)user.notify(index);};
  const tick=()=>{timer=null;if(!running())return;index=1-index;announce();update();};
  function update(){
   if(!running()){
    if(timer!==null)cancel(timer);
    timer=null;
    if(reduce.matches&&index!==0){index=0;announce();}
    return;
   }
   if(timer===null)timer=later(tick,PLATFORM111_MEDIA.holdMs[index]);
  }
  doc.addEventListener('visibilitychange',update);reduce.addEventListener('change',update);
  controller={
   add(fn){const user={active:false,notify:fn};users.add(user);fn(index);return user;},
   set(user,active){if(user.active!==active){user.active=active;update();}},
   remove(user){users.delete(user);update();if(!users.size){doc.removeEventListener('visibilitychange',update);reduce.removeEventListener('change',update);shared.delete(owner);}},
  };
  shared.set(owner,controller);
 }
 const user=controller.add(notify);
 return {setActive(active){controller.set(user,!!active);},destroy(){controller.remove(user);}};
}
