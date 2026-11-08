import {runPhotoSequence} from './commons-photo-sequence.js';
import {createFourcutMiniApp} from './commons-fourcut-miniapp.js';
export {runPhotoSequence} from './commons-photo-sequence.js';
const makeCanvas=()=>document.createElement('canvas');
export function fitPhoto(source,{maxEdge=1280,canvas=makeCanvas}={}){
 if(!source?.width||!source?.height)throw Error('사진 화면을 준비하지 못했어요.');
 const ratio=Math.min(1,maxEdge/Math.max(source.width,source.height)),out=canvas();out.width=Math.max(1,Math.round(source.width*ratio));out.height=Math.max(1,Math.round(source.height*ratio));out.getContext('2d').drawImage(source,0,0,out.width,out.height);return out;
}
export function composePhotoSheet(frames,{title='서울역의 오늘',date=new Date(),canvas=makeCanvas}={}){
 if(![1,4].includes(frames.length))throw Error('사진을 모두 촬영해 주세요.');
 const out=canvas(),w=720,pad=30,header=112,row=frames.length===4?410:510,gap=16;out.width=w;out.height=header+frames.length*(row+gap)+82;
 const c=out.getContext('2d');c.fillStyle='#f7f4e9';c.fillRect(0,0,w,out.height);c.fillStyle='#214f45';c.font='bold 13px sans-serif';c.fillText('STATION ONE  /  SEOUL TRAVEL CLUB',pad,35);c.font='bold 26px sans-serif';c.fillText(title,pad,77,w-pad*2);
 frames.forEach((frame,i)=>{const y=header+i*(row+gap),r=Math.min((w-pad*2)/frame.width,row/frame.height),fw=frame.width*r,fh=frame.height*r;c.fillStyle='#dfe5dc';c.fillRect(pad,y,w-pad*2,row);c.drawImage(frame,pad+(w-pad*2-fw)/2,y+(row-fh)/2,fw,fh);c.fillStyle='#214f45';c.fillRect(pad+10,y+10,29,27);c.fillStyle='#fff';c.font='bold 13px sans-serif';c.fillText(String(i+1).padStart(2,'0'),pad+16,y+29);});
 c.fillStyle='#214f45';c.font='bold 15px sans-serif';c.fillText(frames.length===4?'FOUR MOMENTS, ONE JOURNEY.':'A LITTLE STOP, A LOVELY MEMORY.',pad,out.height-43);c.font='12px sans-serif';c.fillStyle='#748074';c.fillText(date.toLocaleDateString('ko-KR')+'  ·  서울역 2F + 3F',pad,out.height-21);return out;
}
export function createPhotoStudio({capture,getAvatar,onAward,onNotice,onComplete}){
 const $=id=>document.getElementById(id),dialog=$('photo-dialog');let current=null,currentScope=null,last=null,serial=0,busy=false,previewURL=null,downloadURL=null,disposed=false;
 let lastKind='station';const fourcuts=createFourcutMiniApp({getAvatar,onAward,onNotice,onComplete:photo=>{lastKind='fourcuts';onComplete?.(photo);}});
 const urls=new Set(),revoke=url=>{if(url){URL.revokeObjectURL(url);urls.delete(url);}},url=blob=>{const value=URL.createObjectURL(blob);urls.add(value);return value;};
 const blobOf=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('사진 파일을 만들지 못했어요.')),'image/png'));
 const setStatus=text=>$('photo-status').textContent=text;
 function setBusy(on){busy=on;for(const id of ['photo-start','photo-retake','photo-pose'])$(id).disabled=on;$('photo-close').disabled=on;}
 async function preview(place){try{const generation=serial,frame=fitPhoto(await capture(place,0,$('photo-pose').value==='auto'?'wave':$('photo-pose').value));const blob=await blobOf(frame);if(generation!==serial||disposed)return;revoke(previewURL);previewURL=url(blob);$('photo-frame').src=previewURL;$('photo-frame').hidden=false;}catch(e){setStatus(e.message||'촬영을 준비하고 있어요.');}}
 function showReview(photo){current=photo.place;currentScope=photo.scope;$('photo-title').textContent=photo.place.frames===4?'네 장의 여행':'서울역 인증샷';$('photo-place').textContent=photo.place.name;$('photo-frame').src=photo.url;$('photo-frame').hidden=false;$('photo-countdown').hidden=true;$('photo-download').hidden=false;$('photo-retake').hidden=false;$('photo-start').hidden=true;$('photo-share').hidden=!(navigator.canShare&&navigator.share);setStatus(photo.awarded?'여행 스탬프와 사진이 준비됐어요. 사진을 저장해 보세요.':'사진이 준비됐어요.');}
 async function shoot(){
  if(!current||busy)return;const place=current,scope=currentScope,generation=++serial;setBusy(true);$('photo-thumbs').replaceChildren();$('photo-countdown').hidden=false;$('photo-download').hidden=true;$('photo-share').hidden=true;setStatus(place.frames===4?'서로 다른 포즈로 네 번의 순간을 담아요.':'철도블럭과 함께 지금의 순간을 담아요.');
  try{
   const frames=await runPhotoSequence({count:place.frames,isCurrent:()=>!disposed&&serial===generation&&dialog.open,capture:async i=>fitPhoto(await capture(place,i,$('photo-pose').value==='auto'?['wave','cheer','bow','idle'][i]:$('photo-pose').value)),onCountdown:(n,i)=>{$('photo-countdown').textContent=n;$('photo-progress').textContent=(i+1)+' / '+place.frames;},onFrame:frame=>{const image=document.createElement('img');image.src=frame.toDataURL('image/jpeg',.72);image.alt='촬영한 여행 사진';$('photo-thumbs').append(image);}});
   if(!frames)return;const sheet=composePhotoSheet(frames,{title:place.name}),blob=await blobOf(sheet);if(generation!==serial||disposed)return;revoke(downloadURL);downloadURL=url(blob);last={place,scope,blob,url:downloadURL,awarded:false};showReview(last);
   try{await onAward(place,frames.length,scope);if(generation!==serial)return;last.awarded=true;showReview(last);}catch(e){setStatus('사진은 준비됐어요. '+e.message);onNotice?.(e.message);}
   lastKind='station';onComplete?.(last);
  }catch(e){if(generation===serial)setStatus(e.message||'사진 촬영을 마치지 못했어요. 다시 찍어 주세요.');}
  finally{if(generation===serial){setBusy(false);$('photo-countdown').hidden=true;$('photo-start').hidden=!!last&&last.place===place;$('photo-retake').hidden=false;}}
 }
 $('photo-start').addEventListener('click',shoot);$('photo-retake').addEventListener('click',shoot);$('photo-pose').addEventListener('change',()=>{if(current&&!busy)preview(current);});
 $('photo-download').addEventListener('click',()=>{if(!last)return;const a=document.createElement('a');a.href=last.url;a.download='서울역-'+(last.place.frames===4?'인생네컷':'인증샷')+'.png';a.click();});
 $('photo-share').addEventListener('click',async()=>{if(!last)return;try{const file=new File([last.blob],'서울역-여행.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'서울역, 오늘의 여행'});else onNotice?.('사진 저장으로 여행 사진을 간직해 주세요.');}catch(e){if(e.name!=='AbortError')onNotice?.('사진 저장으로 여행 사진을 간직해 주세요.');}});
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{serial++;setBusy(false);revoke(previewURL);previewURL=null;});
 return {
  open(place,scope){if(place.frames===4){fourcuts.open(place,scope);return;}serial++;current=place;currentScope=scope;$('photo-title').textContent=place.frames===4?'네 장의 여행':'서울역 인증샷';$('photo-place').textContent=place.name;$('photo-start').textContent=place.frames===4?'네 컷 촬영 시작':'인증샷 촬영';$('photo-start').hidden=false;$('photo-retake').hidden=true;$('photo-download').hidden=true;$('photo-share').hidden=true;$('photo-frame').hidden=true;$('photo-countdown').hidden=true;$('photo-progress').textContent=place.frames===4?'4가지 포즈 · 네 번의 순간':'한 장의 여행';$('photo-thumbs').replaceChildren();setStatus('화면 속 나와 서울역을 담아요. 마음에 드는 포즈를 골라 보세요.');if(!dialog.open)dialog.showModal();preview(place);},
  openLast(){if(lastKind==='fourcuts'){fourcuts.openLast();return;}if(last){serial++;showReview(last);if(!dialog.open)dialog.showModal();}},
  dispose(){fourcuts.dispose();disposed=true;serial++;for(const value of urls)URL.revokeObjectURL(value);urls.clear();if(dialog.open)dialog.close();},
 };
}
