import {SEOUL_FRAMES,composeSeoulShot,composeSeoulFourcuts,loadFourcutBackgrounds,FOURCUT_BACKGROUND_CREDITS_URL} from './commons-fourcut-frames.js';
import {createLiveSelfie} from './commons-live-selfie.js';
import {runPhotoSequence} from './commons-photo-sequence.js';
const POSES=['wave','cheer','bow','idle'];
const canvas=()=>document.createElement('canvas');
const blobOf=value=>new Promise((resolve,reject)=>value.toBlob(blob=>blob?resolve(blob):reject(Error('사진 파일을 만들지 못했어요.')),'image/png'));
function openDeviceCamera(constraints){
 if(!navigator.mediaDevices?.getUserMedia)throw Error('카메라를 사용할 수 없는 환경이에요. 사진 4장을 선택해 주세요.');
 return navigator.mediaDevices.getUserMedia(constraints);
}
const aborted=()=>new DOMException('촬영을 닫았습니다.','AbortError');

export function createFourcutMiniApp({getAvatar,onAward,onNotice,onComplete,openCamera=openDeviceCamera}={}){
 const dialog=document.createElement('dialog');dialog.className='fourcut-app';dialog.id='fourcut-app';dialog.setAttribute('aria-labelledby','fc-title');dialog.innerHTML=`
  <header class="fc-header"><div><span class="eyebrow">SEOUL FOURCUTS STUDIO</span><h2 id="fc-title">네컷사진 찍기</h2></div><button type="button" id="fc-close" aria-label="네컷 미니앱 닫기">×</button></header>
  <div class="fc-layout"><section class="fc-options" aria-label="네컷 촬영 설정"><h3>오늘의 주인공</h3><div class="fc-mode" role="group" aria-label="촬영 방식"><button type="button" id="fc-avatar" aria-pressed="true">내 캐릭터</button><button type="button" id="fc-selfie" aria-pressed="false">셀카 인물 누끼</button></div>
   <div id="fc-selfie-options" hidden><p class="fc-local">사진은 서버로 보내지 않아요. 이 기기에서 사람을 자동으로 분리해 서울 프레임에 담아요.</p><div class="fc-input-actions"><label class="fc-file-button">사진 4장 선택<input id="fc-files" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><button type="button" id="fc-camera">카메라 켜기</button></div><p id="fc-input-note">한 명의 얼굴과 상반신이 잘 보이는 사진 4장을 골라 주세요. 한 장당 12MB까지.</p><ol id="fc-file-list"></ol></div>
   <h3>서울 명소 프레임</h3><p class="fc-note">서울 명소 사진과 프레임을 골라요. <a id="fc-credits" target="_blank" rel="noopener">사진 출처</a></p><div id="fc-frames" class="fc-frame-list" role="group" aria-label="서울 명소 프레임 선택"></div><h3>완성 모양</h3><div class="fc-mode" role="group" aria-label="네컷 레이아웃"><button type="button" id="fc-strip" aria-pressed="true">세로 네컷</button><button type="button" id="fc-grid" aria-pressed="false">네컷 카드</button></div>
  </section><section class="fc-main" aria-label="촬영 화면"><div class="fc-stage"><canvas id="fc-preview" width="600" height="800" aria-label="선택한 서울 프레임 촬영 미리보기"></canvas><video id="fc-video" autoplay playsinline muted hidden aria-hidden="true"></video><span id="fc-countdown" hidden aria-live="assertive"></span><span class="fc-shot-count" id="fc-progress">프레임과 촬영 방식을 골라요</span></div><div id="fc-thumbs" class="fc-thumbs" aria-label="촬영한 네 장"></div><p id="fc-status" class="fc-status" role="status">내 캐릭터와 서울에서 네 번의 순간을 남겨요.</p><div class="fc-actions"><button type="button" id="fc-start" class="primary">네컷 촬영 시작</button><button type="button" id="fc-again" hidden>다시 촬영</button><button type="button" id="fc-save" class="primary" hidden>네컷사진 저장 ↓</button></div><p class="fc-footnote">촬영 중에도 닫을 수 있어요. 닫으면 카메라 연결과 인물 분리 엔진을 종료합니다.</p></section></div>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id);
 const preview=$('fc-preview'),video=$('fc-video');
 const emptyPortrait=canvas();
 emptyPortrait.width=1;
 emptyPortrait.height=1;
 $('fc-credits').href=FOURCUT_BACKGROUND_CREDITS_URL;

 let mode='avatar',theme='seoul-trip',layout='strip',place=null,scope=null;
 let files=[],cuts=[],last=null,selectedShot=0,reviewing=false;
 let busy=false,disposed=false,serial=0,previewSerial=0,reviewSerial=0;
 let avatar=null,avatarLoading=null,segmenter=null,engineSerial=0,filePortraits=new WeakMap();
 let stream=null,liveCamera=null,cameraSegmenter=null,cameraPending=false;
 let cameraRequest=0,cameraBackdrop=null,cameraPortrait,liveIndex=0,detachTracks=()=>{};

 function status(text){
  if($('fc-status').textContent!==text)$('fc-status').textContent=text;
 }
 function progress(text){
  if($('fc-progress').textContent!==text)$('fc-progress').textContent=text;
 }
 function show(image){
  if(preview.width!==image.width||preview.height!==image.height){
   preview.width=image.width;
   preview.height=image.height;
  }
  const context=preview.getContext('2d');
  context.clearRect(0,0,preview.width,preview.height);
  context.drawImage(image,0,0);
 }
 function paintPortrait(portrait,backdrop,index){
  composeSeoulShot(portrait||emptyPortrait,{theme:backdrop,index,canvas:()=>preview});
 }
 function cameraReady(){
  return Boolean(liveCamera&&cameraPortrait&&cameraBackdrop===theme);
 }
 function sync(){
  $('fc-avatar').setAttribute('aria-pressed',String(mode==='avatar'));
  $('fc-selfie').setAttribute('aria-pressed',String(mode==='selfie'));
  $('fc-selfie-options').hidden=mode!=='selfie';
  $('fc-strip').setAttribute('aria-pressed',String(layout==='strip'));
  $('fc-grid').setAttribute('aria-pressed',String(layout==='grid'));
  for(const button of dialog.querySelectorAll('[data-fc-frame]')){
   button.setAttribute('aria-pressed',String(button.dataset.fcFrame===theme));
  }
  for(const id of ['fc-avatar','fc-selfie','fc-files','fc-strip','fc-grid'])$(id).disabled=busy;
  for(const button of dialog.querySelectorAll('#fc-frames button,#fc-file-list button'))button.disabled=busy;
  $('fc-camera').disabled=busy||cameraPending;
  $('fc-start').disabled=busy||mode==='selfie'&&(cameraPending||(stream?!cameraReady():files.length!==4));
  $('fc-again').disabled=busy;
  $('fc-countdown').hidden=!busy;
  $('fc-save').hidden=!last||!reviewing||busy;
 }
 function listFiles(){
  const list=$('fc-file-list');
  list.replaceChildren();
  files.forEach((file,index)=>{
   const row=document.createElement('li');
   const name=document.createElement('span'),remove=document.createElement('button');
   name.textContent=(index+1)+'. '+file.name;
   remove.type='button';
   remove.textContent='×';
   remove.setAttribute('aria-label',(index+1)+'번째 사진 삭제');
   remove.onclick=()=>{
    if(index===0)stopFileEngine();
    files.splice(index,1);
    listFiles();
    sync();
    requestPreview();
   };
   row.append(name,remove);
   list.append(row);
  });
  $('fc-input-note').textContent=stream
   ?'합성 미리보기를 보면서 네 번 촬영해요. 화면 중앙에 얼굴과 상반신을 맞춰 주세요.'
   :files.length+' / 4장 · 사람 한 명이 또렷한 사진을 골라 주세요.';
 }

 function stopCamera(){
  cameraRequest++;
  cameraPending=false;
  liveCamera?.dispose();
  liveCamera=null;
  cameraSegmenter?.dispose();
  cameraSegmenter=null;
  detachTracks();
  detachTracks=()=>{};
  for(const track of stream?.getTracks()||[])track.stop();
  stream=null;
  if(video.srcObject){
   video.pause();
   video.srcObject=null;
  }
  cameraBackdrop=null;
  cameraPortrait=undefined;
  liveIndex=0;
  $('fc-camera').textContent='카메라 켜기';
 }
 function stopFileEngine(){
  engineSerial++;
  segmenter?.dispose();
  segmenter=null;
  filePortraits=new WeakMap();
 }
 function stopEngines(){
  stopCamera();
  stopFileEngine();
  avatar?.dispose();
  avatar=null;
  avatarLoading=null;
 }
 async function avatarEngine(){
  if(avatar)return avatar;
  if(!avatarLoading){
   const revision=engineSerial;
   avatarLoading=import('./commons-fourcut-avatar.js').then(({createFourcutAvatar})=>{
    if(disposed||revision!==engineSerial)throw aborted();
    avatar=createFourcutAvatar();
    return avatar;
   }).finally(()=>{if(revision===engineSerial)avatarLoading=null;});
  }
  return avatarLoading;
 }
 async function decodePortrait(file){
  const revision=engineSerial;
  const {decodedSelfie,cutoutSelfie,createSelfieSegmenter}=await import('./commons-selfie.js');
  const source=await decodedSelfie(file);
  if(disposed||revision!==engineSerial||mode!=='selfie'||!dialog.open)throw aborted();
  if(!segmenter)segmenter=createSelfieSegmenter({onStatus:status});
  const mask=await segmenter.segment(source);
  if(revision!==engineSerial)throw aborted();
  return cutoutSelfie(source,mask);
 }
 function personFromFile(file){
  let pending=filePortraits.get(file);
  if(!pending){
   const cache=filePortraits;
   pending=decodePortrait(file);
   cache.set(file,pending);
   pending.catch(()=>cache.delete(file));
  }
  return pending;
 }
 function paintLivePreview(){
  if(cameraBackdrop!==theme)return;
  paintPortrait(cameraPortrait,cameraBackdrop,liveIndex);
  if(busy)return;
  progress(cameraPortrait?'카메라 합성 미리보기':'카메라 미리보기');
  if(cameraPortrait)status('이 구도로 네 번 촬영해요. 준비되면 촬영 시작을 눌러 주세요.');
  else if(cameraPortrait===null)status('화면 중앙에 얼굴과 상반신을 맞춰 주세요.');
  else status('기기 안에서 인물을 분리하고 있어요…');
 }
 async function requestPreview(message){
  if(disposed||!dialog.open||busy)return;
  const revision=++previewSerial,backdrop=theme;
  const current=()=>revision===previewSerial&&!disposed&&dialog.open&&!busy;
  if(liveCamera){
   liveCamera.pause();
   cameraBackdrop=null;
   sync();
  }
  try{
   await loadFourcutBackgrounds(backdrop);
   if(!current())return;
   if(liveCamera){
    cameraBackdrop=backdrop;
    paintLivePreview();
    liveCamera.resume();
    sync();
    return;
   }
   if(cuts.length===4){
    paintPortrait(cuts[selectedShot],backdrop,selectedShot);
    return;
   }
   let portrait;
   if(mode==='avatar')portrait=(await avatarEngine()).capture({...getAvatar?.()},'wave',0);
   else if(files.length){
    status('선택한 사진에서 인물을 자동으로 분리하고 있어요…');
    portrait=await personFromFile(files[0]);
   }
   if(!current())return;
   paintPortrait(portrait,backdrop,0);
   if(message)status(message);
   else if(mode==='avatar')status('실제 3D 캐릭터로 네 가지 포즈를 촬영해요.');
   else if(files.length)status('자동 인물 분리 미리보기예요. 네 장을 골라 촬영을 시작하세요.');
   else status('사진 4장을 고르거나 카메라를 켜 주세요.');
  }catch(error){
   if(error.name==='AbortError'||!current())return;
   status(error.message||'촬영을 준비하지 못했어요. 다시 시도해 주세요.');
   $('fc-again').hidden=false;
  }
 }
 async function makeReview(capturedFrames){
  if(cuts.length!==4)return false;
  const revision=++reviewSerial,backdrop=theme,outputLayout=layout;
  const current=()=>!disposed&&revision===reviewSerial&&dialog.open;
  await loadFourcutBackgrounds(backdrop);
  if(!current())return false;
  const frames=capturedFrames||cuts.map((cutout,index)=>composeSeoulShot(cutout,{theme:backdrop,index}));
  const sheet=composeSeoulFourcuts(frames,{theme:backdrop,layout:outputLayout});
  const blob=await blobOf(sheet);
  if(!current())return false;
  const previous=last;
  last={place,scope,frames,blob,url:URL.createObjectURL(blob),awarded:reviewing&&previous?.awarded===true,theme:backdrop,layout:outputLayout};
  reviewing=true;
  if(previous)URL.revokeObjectURL(previous.url);
  const thumbs=$('fc-thumbs');
  thumbs.replaceChildren();
  frames.forEach((frame,index)=>{
   const button=document.createElement('button'),image=document.createElement('img');
   button.type='button';
   button.setAttribute('aria-label',(index+1)+'번째 네컷사진 크게 보기');
   image.src=frame.toDataURL('image/jpeg',.8);
   image.alt=(index+1)+'번째 촬영한 서울 네컷사진';
   button.append(image);
   button.onclick=()=>{selectedShot=index;show(frame);};
   thumbs.append(button);
  });
  const complete=document.createElement('button');
  complete.type='button';
  complete.textContent='완성본 보기';
  complete.onclick=()=>show(sheet);
  thumbs.append(complete);
  selectedShot=0;
  show(frames[0]);
  progress('4 / 4 · 네컷사진 완성');
  $('fc-again').hidden=false;
  $('fc-start').hidden=true;
  sync();
  return true;
 }
 function resetShots(){
  reviewSerial++;
  reviewing=false;
  cuts=[];
  $('fc-thumbs').replaceChildren();
  $('fc-start').hidden=false;
  $('fc-again').hidden=true;
 }

 async function shoot(){
  if(busy||disposed||!dialog.open||$('fc-start').disabled)return;
  const revision=++serial,shotCamera=liveCamera,shotMode=mode,shotFiles=files.slice(),backdrop=theme;
  const current=()=>!disposed&&revision===serial&&dialog.open;
  const person={...getAvatar?.()};
  previewSerial++;
  resetShots();
  busy=true;
  $('fc-countdown').textContent='';
  sync();
  try{
   await loadFourcutBackgrounds(backdrop);
   if(!current())return;
   const frames=await runPhotoSequence({
    count:4,isCurrent:current,
    onCountdown(value,index){
     $('fc-countdown').textContent=value;
     progress((index+1)+' / 4');
     if(shotCamera&&value===3){
      liveIndex=index;
      paintLivePreview();
      shotCamera.resume();
     }
    },
    async capture(index){
     status((index+1)+' / 4 · '+(shotMode==='selfie'?'사람을 자동으로 분리하고 있어요…':'캐릭터 포즈를 촬영하고 있어요…'));
     let portrait;
     if(shotMode==='avatar')portrait=(await avatarEngine()).capture(person,POSES[index],index*.61);
     else if(shotCamera)portrait=await shotCamera.capture();
     else portrait=await personFromFile(shotFiles[index]);
     if(!current())throw aborted();
     cuts[index]=portrait;
     return composeSeoulShot(portrait,{theme:backdrop,index});
    },
    onFrame:show,
   });
   if(!frames||!current())return;
   stopCamera();
   listFiles();
   if(!await makeReview(frames)||!current())return;
   try{
    await onAward?.(place,4,scope);
    if(!current())return;
    last.awarded=true;
    status('네컷사진과 여행 스탬프가 준비됐어요. 사진을 저장해 보세요.');
   }catch(error){
    if(!current())return;
    status('사진은 완성됐어요. '+error.message);
    onNotice?.(error.message);
   }
   onComplete?.(last);
  }catch(error){
   if(current()&&error.name!=='AbortError'){
    status(error.name==='NoPersonError'&&shotCamera
     ?'촬영 순간에 인물을 찾지 못했어요. 화면 중앙에 서서 다시 촬영해 주세요.'
     :error.message||'사진 촬영을 마치지 못했어요. 다시 시도해 주세요.');
    $('fc-again').hidden=false;
    if(shotCamera===liveCamera&&liveCamera){
     liveIndex=0;
     liveCamera.resume();
    }
   }
  }finally{
   if(current()){
    busy=false;
    sync();
   }
  }
 }
 function interruptCamera(message){
  serial++;
  previewSerial++;
  busy=false;
  stopCamera();
  resetShots();
  listFiles();
  sync();
  progress('프레임과 촬영 방식을 골라요');
  status(message);
  requestPreview(message);
 }
 async function cameraOn(){
  if(busy||cameraPending)return;
  if(stream){interruptCamera('카메라를 껐어요. 다시 켜거나 사진을 선택해 주세요.');return;}
  const request=++cameraRequest;
  const current=()=>!disposed&&request===cameraRequest&&dialog.open&&mode==='selfie'&&!document.hidden;
  previewSerial++;
  stopFileEngine();
  cameraPending=true;
  $('fc-camera').textContent='카메라 준비 중…';
  status('카메라와 합성 미리보기를 준비하고 있어요…');
  sync();
  try{
   const media=await openCamera({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}}});
   if(!current()){
    for(const track of media.getTracks())track.stop();
    if(request===cameraRequest){stopCamera();sync();}
    return;
   }
   stream=media;
   const tracks=media.getVideoTracks();
   if(!tracks.length)throw Error('카메라 영상이 연결되지 않았어요. 다시 켜 주세요.');
   const ended=()=>interruptCamera('카메라 연결이 끝났어요. 다시 켜거나 사진을 선택해 주세요.');
   for(const track of tracks)track.addEventListener('ended',ended);
   detachTracks=()=>{for(const track of tracks)track.removeEventListener('ended',ended);};
   video.srcObject=media;
   await video.play();
   const {createSelfieSegmenter,readCameraFrame,cutoutSelfie}=await import('./commons-selfie.js');
   if(!current())return;
   files=[];
   resetShots();
   listFiles();
   cameraSegmenter=createSelfieSegmenter({onStatus:text=>{if(current())status(text);}});
   const engine=cameraSegmenter;
   liveCamera=createLiveSelfie({
    readFrame:()=>readCameraFrame(video),
    async processFrame(frame){
     const mask=await engine.segment(frame);
     if(!current())throw aborted();
     return cutoutSelfie(frame,mask,{primary:true,mirror:true});
    },
    onPortrait(portrait){
     if(!current())return;
     const wasReady=cameraReady();
     cameraPortrait=portrait;
     paintLivePreview();
     if(cameraReady()!==wasReady)sync();
    },
    onError(error){
     if(current())interruptCamera(error.message||'인물 분리를 준비하지 못했어요. 다시 시도해 주세요.');
    },
   });
   cameraPending=false;
   $('fc-camera').textContent='카메라 끄기';
   sync();
   await requestPreview();
  }catch(error){
   if(request!==cameraRequest)return;
   stopCamera();
   listFiles();
   sync();
   status(error.name==='NotAllowedError'
    ?'카메라 권한을 확인하거나 사진 4장을 선택해 주세요.'
    :error.message||'카메라 연결을 준비하지 못했어요. 다시 켜거나 사진을 선택해 주세요.');
  }
 }
 function selectMode(value){
  if(busy||mode===value)return;
  serial++;
  previewSerial++;
  stopEngines();
  mode=value;
  files=[];
  resetShots();
  progress('프레임과 촬영 방식을 골라요');
  listFiles();
  sync();
  requestPreview();
 }
 for(const frame of SEOUL_FRAMES){
  const button=document.createElement('button');
  const name=document.createElement('b'),note=document.createElement('small');
  button.type='button';
  button.dataset.fcFrame=frame.id;
  button.style.setProperty('--frame-color',frame.color);
  name.textContent=frame.name;
  note.textContent=frame.note;
  button.append(name,note);
  button.onclick=()=>{
   if(busy)return;
   theme=frame.id;
   sync();
   if(cuts.length===4)makeReview().catch(error=>status(error.message));
   else requestPreview();
  };
  $('fc-frames').append(button);
 }
 $('fc-avatar').onclick=()=>selectMode('avatar');
 $('fc-selfie').onclick=()=>selectMode('selfie');
 $('fc-camera').onclick=cameraOn;
 $('fc-files').onchange=()=>{
  if(busy)return;
  const selected=[...$('fc-files').files];
  if(!selected.length)return;
  stopCamera();
  stopFileEngine();
  files=selected.length>=4?selected.slice(0,4):[...files,...selected].slice(0,4);
  $('fc-files').value='';
  resetShots();
  progress('사진 '+files.length+' / 4장 선택');
  listFiles();
  sync();
  requestPreview();
 };
 for(const value of ['strip','grid'])$('fc-'+value).onclick=()=>{
  if(busy)return;
  layout=value;
  sync();
  if(cuts.length===4)makeReview().catch(error=>status(error.message));
 };
 $('fc-start').onclick=shoot;
 $('fc-again').onclick=()=>{
  if(cuts.length===4){
   resetShots();
   progress('프레임과 촬영 방식을 골라요');
  }
  sync();
  requestPreview();
 };
 $('fc-save').onclick=()=>{
  if(!last||!reviewing)return;
  const link=document.createElement('a');
  link.href=last.url;
  link.download='서울-네컷사진-'+last.theme+'.png';
  document.body.append(link);
  link.click();
  link.remove();
 };
 $('fc-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  serial++;
  previewSerial++;
  reviewSerial++;
  busy=false;
  reviewing=false;
  files=[];
  stopEngines();
  sync();
 });
 const visibility=()=>{
  if(document.hidden&&(stream||cameraPending)){
   interruptCamera('화면을 벗어나 카메라를 껐어요. 다시 켜서 촬영해 주세요.');
  }
 };
 document.addEventListener('visibilitychange',visibility);
 return {
  open(value,token){
   serial++;
   previewSerial++;
   place=value;
   scope=token;
   files=[];
   busy=false;
   stopEngines();
   resetShots();
   progress('프레임과 촬영 방식을 골라요');
   listFiles();
   if(!dialog.open)dialog.showModal();
   sync();
   requestPreview();
  },
  openLast(){
   if(!last)return;
   reviewing=true;
   const revision=++previewSerial;
   place=last.place;
   scope=last.scope;
   theme=last.theme;
   layout=last.layout;
   if(!dialog.open)dialog.showModal();
   const image=new Image();
   image.onload=()=>{if(dialog.open&&!disposed&&revision===previewSerial)show(image);};
   image.src=last.url;
   $('fc-start').hidden=true;
   $('fc-again').hidden=false;
   progress('4 / 4 · 네컷사진 완성');
   status('저장한 네컷사진을 다시 보고 있어요.');
   sync();
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   serial++;
   stopEngines();
   if(last)URL.revokeObjectURL(last.url);
   last=null;
   cuts=[];
   files=[];
   document.removeEventListener('visibilitychange',visibility);
   if(dialog.open)dialog.close();
   dialog.remove();
  },
 };
}
