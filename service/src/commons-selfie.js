export const SELFIE_LIMITS=Object.freeze({bytes:12_000_000,pixels:16_000_000,edge:1280});
function noPerson(){
 const error=Error('사진에서 사람을 찾지 못했어요. 얼굴과 상반신이 잘 보이는 사진을 골라 주세요.');
 error.name='NoPersonError';
 return error;
}
export function confidenceAlpha(values){
 const rgba=new Uint8ClampedArray(values.length*4);
 rgba.fill(255);
 let foreground=0;
 for(let i=0;i<values.length;i++){
  const probability=Number.isFinite(values[i])?Math.max(0,Math.min(1,(values[i]-.18)/.64)):0;
  const opacity=probability*probability*(3-2*probability);
  rgba[i*4+3]=Math.round(opacity*255);
  if(opacity>.35)foreground++;
 }
 if(foreground<values.length*.008)throw noPerson();
 return rgba;
}
export function personMaskBounds(rgba,width,height){let x0=width,y0=height,x1=-1,y1=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>90){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x1<0)throw Error('사진에서 사람을 찾지 못했어요.');return [Math.max(0,x0-2)/width,Math.max(0,y0-2)/height,Math.min(width,x1+3)/width,Math.min(height,y1+3)/height];}
export function createSelfieSegmenter({onStatus=()=>{},workerFactory=()=>new Worker('/assets/commons/segmentation/selfie-worker.js')}={}){
 let worker=null,disposed=false,seq=0;const pending=new Map();
 function stop(error){worker?.terminate();worker=null;for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error);}pending.clear();}
 function start(){if(worker)return;worker=workerFactory();worker.onmessage=({data})=>{if(data.type==='loading'){onStatus('기기 안에서 자동 인물 분리를 준비하고 있어요…');return;}const item=pending.get(data.id);if(!item)return;pending.delete(data.id);clearTimeout(item.timer);data.type==='error'?item.reject(Error(data.message)):item.resolve(data);};worker.onerror=()=>stop(Error('자동 인물 분리 엔진을 불러오지 못했어요. 다시 시도해 주세요.'));}
 return {async segment(source){if(disposed)throw new DOMException('촬영 화면을 다시 열어 주세요.','AbortError');start();const activeWorker=worker,image=await createImageBitmap(source),id=++seq;try{if(disposed||worker!==activeWorker)throw new DOMException('인물 촬영을 닫았습니다.','AbortError');return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>stop(Error('자동 인물 분리 응답이 지연됩니다. 다시 시도해 주세요.')),45000);pending.set(id,{resolve,reject,timer});activeWorker.postMessage({type:'segment',id,image},[image]);});}catch(error){image.close();throw error;}},dispose(){if(disposed)return;disposed=true;stop(new DOMException('인물 촬영을 닫았습니다.','AbortError'));}};
}
export async function decodedSelfie(file,{canvas=()=>document.createElement('canvas')}={}){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>SELFIE_LIMITS.bytes)throw Error('PNG·JPEG·WebP 사진을 한 장당 12MB 이하로 선택해 주세요.');const bitmap=await createImageBitmap(file);try{if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>SELFIE_LIMITS.pixels)throw Error('사진은 1,600만 화소 이하로 선택해 주세요.');const scale=Math.min(1,SELFIE_LIMITS.edge/Math.max(bitmap.width,bitmap.height)),out=canvas();out.width=Math.round(bitmap.width*scale);out.height=Math.round(bitmap.height*scale);out.getContext('2d').drawImage(bitmap,0,0,out.width,out.height);return out;}finally{bitmap.close();}
}
// The model outputs a foreground probability, without instance identities.
// Keep the dominant central connected silhouette and its soft boundary.
export function keepPrimaryPerson(rgba,width,height){
 const length=width*height,labels=new Uint32Array(length),queue=new Int32Array(length);
 let label=0,best=0,bestArea=0,bestScore=0;
 const strong=index=>rgba[index*4+3]>=128;
 for(let seed=0;seed<length;seed++){
  if(labels[seed]||!strong(seed))continue;
  label++;
  let head=0,tail=0,totalX=0,totalY=0;
  function visit(index){
   if(labels[index]||!strong(index))return;
   labels[index]=label;
   queue[tail++]=index;
  }
  visit(seed);
  while(head<tail){
   const index=queue[head++],x=index%width,y=Math.floor(index/width);
   totalX+=x;
   totalY+=y;
   if(x>0)visit(index-1);
   if(x<width-1)visit(index+1);
   if(y>0)visit(index-width);
   if(y<height-1)visit(index+width);
  }
  const dx=(totalX/tail+.5)/width-.5,dy=(totalY/tail+.5)/height-.5;
  const score=tail/(1+4*(dx*dx+dy*dy));
  if(score>bestScore){best=label;bestArea=tail;bestScore=score;}
 }
 if(!best||bestArea<length*.008)throw noPerson();
 for(let index=0;index<length;index++){
  const alpha=index*4+3;
  if(!rgba[alpha]||labels[index]===best)continue;
  const x=index%width,y=Math.floor(index/width);
  let fringe=false;
  if(labels[index]===0){
   for(let dy=-2;dy<=2&&!fringe;dy++){
    for(let dx=-2;dx<=2;dx++){
     const xx=x+dx,yy=y+dy;
     if(xx>=0&&xx<width&&yy>=0&&yy<height&&labels[yy*width+xx]===best){fringe=true;break;}
    }
   }
  }
  if(!fringe)rgba[alpha]=0;
 }
}

export function readCameraFrame(video,{canvas=()=>document.createElement('canvas')}={}){
 if(video.readyState<2||!video.videoWidth||!video.videoHeight)return null;
 const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight)),source=canvas();
 source.width=Math.round(video.videoWidth*scale);
 source.height=Math.round(video.videoHeight*scale);
 source.getContext('2d').drawImage(video,0,0,source.width,source.height);
 return source;
}

export function cutoutSelfie(source,{width,height,values},{canvas=()=>document.createElement('canvas'),primary=false,mirror=false}={}){
 if(!width||!height||values?.length!==width*height)throw Error('인물 분리 결과를 읽지 못했어요. 다시 시도해 주세요.');
 const rgba=confidenceAlpha(values);
 if(primary)keepPrimaryPerson(rgba,width,height);
 const [x0,y0,x1,y1]=personMaskBounds(rgba,width,height);
 const mask=canvas();
 mask.width=width;
 mask.height=height;
 const maskContext=mask.getContext('2d'),pixels=maskContext.createImageData(width,height);
 pixels.data.set(rgba);
 maskContext.putImageData(pixels,0,0);
 const cropped=canvas(),fractionWidth=x1-x0,fractionHeight=y1-y0;
 cropped.width=Math.max(1,Math.round(fractionWidth*source.width));
 cropped.height=Math.max(1,Math.round(fractionHeight*source.height));
 const context=cropped.getContext('2d');
 if(mirror){context.translate(cropped.width,0);context.scale(-1,1);}
 context.drawImage(mask,x0*width,y0*height,fractionWidth*width,fractionHeight*height,0,0,cropped.width,cropped.height);
 context.globalCompositeOperation='source-in';
 context.drawImage(source,x0*source.width,y0*source.height,fractionWidth*source.width,fractionHeight*source.height,0,0,cropped.width,cropped.height);
 context.globalCompositeOperation='source-over';
 return cropped;
}
