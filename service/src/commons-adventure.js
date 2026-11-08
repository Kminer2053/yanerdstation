import {emptyGame,cleanGame,applyGameAction,nearGamePlace,ITEMS,GAME_STAMPS} from './commons-game-core.js';
import {AVATAR_IDS,DEFAULT_AVATAR_ID} from './commons-avatar-styles.js';
import {createPhotoStudio} from './commons-photo-studio.js';
import {createJourneyScope} from './commons-journey-scope.js';
import {destinationModeLabel} from './commons-navigation.js';
const CHARACTERS=[['child-boy','꼬마 소년','가벼운 첫걸음'],['child-girl','꼬마 소녀','발견하는 즐거움'],['adult-man','청년 여행자','오늘은 조금 느리게'],['adult-woman','여성 여행자','설렘을 가방에'],['elder-man','할아버지','여유로운 서울 나들이'],['elder-woman','할머니','함께 남기는 추억']];
const MISSIONS=[['briefing','staff-center','01','안내센터에서 출발','역무원에게 오늘의 여행을 안내받아요.'],['rail-block','rail-block','02','손안의 작은 철도','TRAIN MATES에서 철도블럭을 받아요.'],['photo-hanjeongseon','photo-hanjeongseon','03','한정선 앞, 한 컷','철도블럭을 들고 인증샷을 찍어요.'],['photo-stairs','photo-stairs','04','계단 앞의 여행자','선상통로 계단에서도 블럭과 한 컷.'],['storyway','storyway-center','05','여행의 작은 간식','스토리웨이에서 구운란사이를 만나요.'],['fourcuts','fourcuts','06','네컷사진 찍기','서울 명소 프레임에 캐릭터나 셀카를 담아요.']];
const $=id=>document.getElementById(id);
export function rememberedCharacter(storage=globalThis.localStorage){try{const id=storage?.getItem('station-one-character');return AVATAR_IDS.includes(id)?id:DEFAULT_AVATAR_ID;}catch{return DEFAULT_AVATAR_ID;}}
const artwork=(id,productImage)=>{const div=document.createElement('div');div.className='item-art '+id;if(id==='storyway-set'&&productImage){const img=document.createElement('img');img.src=productImage;img.alt='코레일유통 구운란사이';div.append(img);}else if(id==='rail-block'){div.innerHTML='<span class="toy-engine"><i></i><b>TRAIN</b></span><span class="toy-rail"></span>';}else div.innerHTML='<span class="egg-pack"><i></i><i></i></span><span class="soda-can">칠성<br><b>사이다</b></span>';return div;};
function characterButton(id,name,note,onChoose){const b=document.createElement('button');b.type='button';b.dataset.character=id;b.className='character-card';b.setAttribute('aria-label',name+' 선택');b.innerHTML='<span class="mini-avatar '+id+'" aria-hidden="true"><i class="mini-hair"></i><i class="mini-head"></i><i class="mini-body"></i><i class="mini-arm left"></i><i class="mini-arm right"></i><i class="mini-leg left"></i><i class="mini-leg right"></i><i class="mini-case"></i></span>';const label=document.createElement('b'),small=document.createElement('small');label.textContent=name;small.textContent=note;b.append(label,small);b.addEventListener('click',()=>onChoose(id));return b;}
export function createAdventureUI({self,places,indexes,presence,world,clearInput,goTo,onNotice,getDestinationMode=()=> 'walk',productImage='',storage=globalThis.sessionStorage}){
 let solo=emptyGame(),state=emptyGame(),connected=false,busy=false,near=null,lastPeople=[],lastTime=0,signature='',renderedState='',disposed=false;const journey=createJourneyScope();
 try{solo=cleanGame(storage?.getItem('station-one-solo-passport'));}catch{}state=solo;
 const save=()=>{try{storage?.setItem('station-one-solo-passport',JSON.stringify(solo));}catch{}};
 function equipVisual(){self.heldItem=state.heldItem;world.invalidate();}
 function chooseCharacter(id){if(!AVATAR_IDS.includes(id))return;self.character=id;try{localStorage.setItem('station-one-character',id);}catch{}for(const b of document.querySelectorAll('[data-character]'))b.setAttribute('aria-pressed',String(b.dataset.character===id));$('character-name').textContent=CHARACTERS.find(c=>c[0]===id)?.[1]||'나의 여행자';world.invalidate();}
 for(const container of [$('welcome-characters'),$('traveller-characters')])for(const c of CHARACTERS)container.append(characterButton(...c,chooseCharacter));chooseCharacter(self.character);
 const closePanels=()=>{for(const id of ['passport-panel','bag-panel','facility-panel','facility-info'])$(id).hidden=true;};
 function panel(id){clearInput();const opening=$(id).hidden;closePanels();$(id).hidden=!opening;render();}
 function render(){
  if(disposed)return;
  const moveLabel=destinationModeLabel(getDestinationMode());
  const key=JSON.stringify([connected,busy,[...state.inventory].sort(),[...state.stamps].sort(),state.heldItem,moveLabel]);if(key===renderedState)return;renderedState=key;
  const done=state.stamps.length;$('passport-progress').textContent=done+' / '+GAME_STAMPS.length;$('passport-fill').style.width=done/GAME_STAMPS.length*100+'%';$('passport-caption').textContent=done===GAME_STAMPS.length?'서울역 여행 완주! 사진 속 오늘을 간직해요.':MISSIONS.find(m=>!state.stamps.includes(m[0]))?.[3]||'서울역을 자유롭게 둘러보세요.';$('bag-count').textContent=state.inventory.length;
  $('passport-mode').textContent=connected?'친구들과 함께하는 오늘의 여행':'나만의 서울역 여행';$('passport-stamps').replaceChildren();for(const m of MISSIONS){const chip=document.createElement('span');chip.className='passport-stamp'+(state.stamps.includes(m[0])?' complete':'');chip.textContent=state.stamps.includes(m[0])?'✓':m[2];chip.setAttribute('aria-label',m[3]+(state.stamps.includes(m[0])?' 완료':' 미완료'));$('passport-stamps').append(chip);}
  $('mission-list').replaceChildren();
  for(const [stamp,id,num,title,description] of MISSIONS){
   const place=places.find(p=>p.id===id),complete=state.stamps.includes(stamp),card=document.createElement('article');
   card.className='mission-card'+(complete?' complete':'');
   const number=document.createElement('span'),content=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),button=document.createElement('button');
   number.className='mission-number';number.textContent=complete?'✓':num;h.textContent=title;p.textContent=description;
   button.textContent=moveLabel;button.disabled=!place||busy;button.setAttribute('aria-label',(place?.name||title)+' · '+moveLabel);
   button.addEventListener('click',async()=>{closePanels();clearInput();if(await goTo(place))onNotice(place.kind==='staff'?'역무원에게 말을 걸어 보세요.':place.kind==='photo'?'가까이에서 촬영 버튼을 눌러 보세요.':'매장 앞에서 여행 소품을 받아 보세요.');});
   content.append(h,p,button);card.append(number,content);$('mission-list').append(card);
  }
  $('bag-items').replaceChildren();
  for(const item of Object.values(ITEMS)){
   const owned=state.inventory.includes(item.id),held=state.heldItem===item.id,target=places.find(p=>p.item===item.id),card=document.createElement('article');
   card.className='bag-item'+(owned?' owned':' locked');card.append(artwork(item.id,productImage));
   const body=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),button=document.createElement('button');
   h.textContent=item.name;p.textContent=owned?item.description:item.id==='rail-block'?'TRAIN MATES를 찾아 여행 소품을 받아 보세요.':'스토리웨이에서 만나는 구운란과 사이다.';
   button.textContent=owned?(held?'가방에 넣기':'손에 들기'):moveLabel;
   button.disabled=busy||!owned&&!target;
   if(owned)button.setAttribute('aria-pressed',String(held));else button.setAttribute('aria-label',(target?.name||item.name)+' · '+moveLabel);
   button.addEventListener('click',async()=>{if(owned){try{await act('equip',held?'':item.id);}catch(e){onNotice(e.message);}}else if(target){closePanels();await goTo(target);}});
   body.append(h,p,button);
   if(held){const tag=document.createElement('span');tag.className='equipped-tag';tag.textContent='지금 들고 있어요';body.prepend(tag);}
   card.append(body);$('bag-items').append(card);
  }
  $('held-label').hidden=!state.heldItem;$('held-label').textContent=state.heldItem?'손에 든 소품 · '+ITEMS[state.heldItem].short:'';signature='';equipVisual();
 }
 async function act(kind,target,frames){
  if(busy)throw Error('잠깐만요. 여행 기록을 남기고 있어요.');busy=true;clearInput();render();const action={requestId:crypto.randomUUID(),kind,target,...(frames===undefined?{}:{frames})};
  try{let result;if(connected){result=await presence.act(action);}else{const applied=applyGameAction(solo,action,self,places,indexes);solo=applied.state;state=solo;save();result=applied.result;}render();onNotice(result.message);return result;}finally{busy=false;render();}
 }
 const photos=createPhotoStudio({getAvatar:()=>({...self}),capture:(place,index,pose)=>world.captureFrame({self:{...self,pose},people:lastPeople.map(p=>p.self?{...self,pose}:p),time:lastTime,pose,lookAt:place.lookAt,photoView:place.photoView}),onAward:(place,frames,scope)=>{journey.assert(scope);return act('photo',place.id,frames);},onNotice,onComplete:()=>{$('last-photo').hidden=false;}});
 function showReward(id){const item=ITEMS[id];if(!item)return;$('reward-art').replaceChildren(artwork(id,productImage));$('reward-name').textContent=item.name+' 획득!';$('reward-note').textContent=id==='rail-block'?'작은 철도를 손에 들었어요. 한정선과 선상통로 계단에서 인증샷을 남겨 보세요.':'여행엔 작은 간식이 빠질 수 없죠. 구운란사이와 함께 다음 장소로 떠나 보세요.';$('reward-dialog').showModal();}
 async function interact(){
  if(!near||busy)return;const place=near;clearInput();
  if(place.kind==='photo'){if(place.requires&&(!state.inventory.includes(place.requires)||state.heldItem!==place.requires)){onNotice('가방에서 철도블럭을 손에 든 뒤 사진을 찍어 주세요.');panel('bag-panel');return;}photos.open(place,journey.capture());return;}
  try{await act(place.kind==='staff'?'greet':place.kind,place.id);if(place.kind==='staff'){$('staff-name').textContent=place.name;$('staff-dialog').showModal();}else if(place.item)showReward(place.item);}catch(e){onNotice(e.message);}
 }
 $('passport-open').addEventListener('click',()=>panel('passport-panel'));$('passport-hud-open').addEventListener('click',()=>panel('passport-panel'));$('bag-open').addEventListener('click',()=>panel('bag-panel'));$('nearby-action').addEventListener('click',interact);$('traveller-open').addEventListener('click',()=>{clearInput();$('traveller-dialog').showModal();});$('last-photo').addEventListener('click',()=>{clearInput();photos.openLast();});$('staff-missions').addEventListener('click',()=>{$('staff-dialog').close();panel('passport-panel');});$('reward-continue').addEventListener('click',()=>$('reward-dialog').close());
 for(const b of document.querySelectorAll('[data-game-close]'))b.addEventListener('click',()=>$(b.dataset.gameClose).hidden=true);
 const key=e=>{if(e.code!=='KeyE'||e.repeat||e.target?.closest?.('input,select,textarea,[contenteditable=true],button,a')||document.querySelector('dialog[open]'))return;if(near){e.preventDefault();interact();}};window.addEventListener('keydown',key);
 render();
 return {
  update({available,people,time}){lastPeople=people;lastTime=time;near=available?places.filter(p=>nearGamePlace(p,self,indexes)).sort((a,b)=>Math.hypot(self.x-a.point[0],self.z-a.point[2])-Math.hypot(self.x-b.point[0],self.z-b.point[2]))[0]||null:null;const key=(near?.id||'')+':'+busy+':'+state.heldItem;if(key===signature)return;signature=key;$('nearby-prompt').hidden=!near;document.body.dataset.gameNear=String(!!near);if(near){$('nearby-name').textContent=near.name;$('nearby-note').textContent=near.kind==='staff'?'역무원과 이야기하고 여행을 시작해요.':near.kind==='photo'?near.frames===4?'서울 명소 프레임 · 캐릭터 또는 셀카 촬영':'철도블럭과 함께 남기는 한 장':state.inventory.includes(near.item)?'여행 소품은 가방에서 다시 꺼낼 수 있어요.':'매장에서 특별한 여행 소품을 받아요.';$('nearby-action').textContent=busy?'기록하는 중…':near.kind==='staff'?'말 걸기 · E':near.kind==='photo'?near.frames===4?'네컷사진 찍기 · E':'인증샷 · E':state.inventory.includes(near.item)?'다시 받기 · E':'소품 받기 · E';$('nearby-action').disabled=busy;}},
  setConnected(on){const changed=journey.update(on,presence.id());if(connected===on&&!changed)return;connected=on;state=on?emptyGame():solo;render();},
  receive(raw){if(!connected||disposed)return;state=cleanGame(raw);render();},
  refreshDestinationMode:render,
  getState:()=>structuredClone(state),
  dispose(){disposed=true;photos.dispose();window.removeEventListener('keydown',key);},
 };
}
