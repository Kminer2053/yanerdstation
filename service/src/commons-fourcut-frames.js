export const SEOUL_FRAMES=Object.freeze([
 {id:'seoul-trip',name:'서울 한 바퀴',note:'네 장에 네 곳의 서울',color:'#d9ac69'},
 {id:'namsan',name:'남산의 밤',note:'N서울타워와 팔각정 야경',color:'#37556f'},
 {id:'palace',name:'궁궐 산책',note:'경복궁 근정전과 푸른 하늘',color:'#9b6653'},
 {id:'hangang',name:'한강 노을',note:'월드컵대교에 물드는 노을',color:'#d79b87'},
 {id:'station',name:'서울역의 시간',note:'불을 밝힌 옛 서울역',color:'#77917e'},
 {id:'platform111',name:'플랫폼111 테라스',note:'서울역 3층 맞이방 · 재현 이미지',color:'#5988a5'},
]);
const photoDir='/assets/commons/fourcut-photos/';
export const FOURCUT_BACKGROUND_CREDITS_URL=photoDir+'credits.html';
const scenes=Object.freeze({
 namsan:{title:'N SEOUL TOWER',anchor:.5},
 palace:{title:'GYEONGBOKGUNG',anchor:.5},
 hangang:{title:'HANGANG AT DUSK',anchor:.71},
 station:{title:'OLD SEOUL STATION',anchor:.5},
 platform111:{title:'PLATFORM 111',anchor:.5,recreated:true},
});
const stops=['namsan','palace','hangang','station'];
const canvas=()=>document.createElement('canvas');
export const sceneForFrame=(theme,index)=>theme==='seoul-trip'?stops[index%stops.length]:Object.hasOwn(scenes,theme)?theme:'namsan';

const photographs=new Map();
const downloads=new Map();
function loadPhotograph(id){
 if(photographs.has(id))return Promise.resolve(photographs.get(id));
 if(downloads.has(id))return downloads.get(id);
 const image=new Image();
 const pending=new Promise((resolve,reject)=>{
  image.onload=resolve;
  image.onerror=()=>reject(new Error('배경 사진을 불러오지 못했어요. 다시 시도해 주세요.'));
  image.src=photoDir+id+'.webp';
 }).then(async()=>{
  if(typeof image.decode==='function')await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('배경 사진을 열 수 없어요. 다시 시도해 주세요.');
  photographs.set(id,image);
  return image;
 }).finally(()=>downloads.delete(id));
 downloads.set(id,pending);
 return pending;
}
export async function loadFourcutBackgrounds(theme='seoul-trip'){
 await Promise.all((theme==='seoul-trip'?stops:[sceneForFrame(theme,0)]).map(loadPhotograph));
}

function background(c,id,w,h){
 const source=photographs.get(id);
 if(!source)throw new Error('배경 사진을 준비하고 있어요.');
 const {naturalWidth:iw,naturalHeight:ih}=source,scene=scenes[id];
 const cover=Math.max(w/iw,h/ih),sw=w/cover,sh=h/cover;
 c.drawImage(source,(iw-sw)*scene.anchor,(ih-sh)*.48,sw,sh,0,0,w,h);
 const shade=c.createLinearGradient(0,0,0,h);
 shade.addColorStop(0,'rgba(13,24,30,.47)');
 shade.addColorStop(.25,'rgba(13,24,30,0)');
 shade.addColorStop(.75,'rgba(13,24,30,0)');
 shade.addColorStop(1,'rgba(13,24,30,.27)');
 c.fillStyle=shade;
 c.fillRect(0,0,w,h);
}
export function composeSeoulShot(person,{theme='seoul-trip',index=0,canvas:create=canvas}={}){
 if(!person?.width||!person?.height)throw new Error('촬영할 인물을 준비해 주세요.');
 const out=create();
 if(out.width!==600||out.height!==800){out.width=600;out.height=800;}
 const c=out.getContext('2d'),id=sceneForFrame(theme,index),w=out.width,h=out.height;
 c.imageSmoothingQuality='high';
 background(c,id,w,h);
 const box={x:w*.22,y:h*.19,w:w*.76,h:h*.78};
 const scale=Math.min(box.w/person.width,box.h/person.height);
 c.drawImage(person,box.x+(box.w-person.width*scale)/2,box.y+box.h-person.height*scale,person.width*scale,person.height*scale);
 c.strokeStyle='#f8f3e5';c.lineWidth=12;c.strokeRect(6,6,w-12,h-12);
 c.fillStyle='#f9f1df';
 c.font='600 13px sans-serif';c.fillText('STATION ONE   /   SEOUL',w*.065,h*.073);
 c.font='700 24px sans-serif';c.fillText(scenes[id].title,w*.065,h*.111);
 if(scenes[id].recreated){
  c.font='500 13px sans-serif';c.fillText('서울역 3층 맞이방 · 재현 이미지',w*.065,h*.138);
 }
 c.fillStyle='#f7f1df';c.fillRect(w*.065,h*.92,w*.18,h*.032);
 c.fillStyle='#2e534a';c.font='600 13px sans-serif';c.fillText('SEOUL  '+String(index+1).padStart(2,'0'),w*.08,h*.943);
 return out;
}
export function composeSeoulFourcuts(frames,{theme='seoul-trip',date=new Date(),layout='strip',canvas:create=canvas}={}){
 if(frames.length!==4||frames.some(f=>!f?.width||!f?.height))throw Error('네 장을 모두 촬영해 주세요.');const out=create(),pad=26,gap=18,cols=layout==='grid'?2:1,cellW=cols===2?500:600,cellH=cellW*4/3,header=110,rows=4/cols;out.width=pad*2+cellW*cols+gap*(cols-1);out.height=header+rows*cellH+(rows-1)*gap+78;const c=out.getContext('2d');c.fillStyle='#f7f2e6';c.fillRect(0,0,out.width,out.height);c.fillStyle='#234c43';c.font='600 16px sans-serif';c.fillText('SEOUL FOURCUTS / STATION ONE',pad,35);c.font='700 29px sans-serif';c.fillText(SEOUL_FRAMES.find(f=>f.id===theme)?.name||'서울 한 바퀴',pad,78);frames.forEach((frame,i)=>c.drawImage(frame,pad+(i%cols)*(cellW+gap),header+Math.floor(i/cols)*(cellH+gap),cellW,cellH));c.font='16px sans-serif';c.fillText(date.toLocaleDateString('ko-KR')+'  ·  나의 서울 네컷',pad,out.height-37);return out;
}
