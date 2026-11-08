import assert from 'node:assert/strict';
import {createAdventureUI} from '../src/commons-adventure.js';
import {emptyGame} from '../src/commons-game-core.js';
import {createDestinationPreference} from '../src/commons-navigation.js';
const original=Object.fromEntries(['document','window','localStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const all=[],byId=new Map(),storage={getItem:()=>null,setItem(){}};let doc;
const contains=(node,child)=>node===child||node.children.some(n=>contains(n,child));
function element(tag='div'){
 const e={tagName:tag,children:[],dataset:{},style:{setProperty(){}},attributes:{},hidden:false,disabled:false,replacements:0,listeners:new Map(),
  setAttribute(k,v){this.attributes[k]=String(v);},append(...children){for(const child of children)child.parent=this;this.children.push(...children);},prepend(...children){this.children.unshift(...children);},
  querySelector(selector){return selector.startsWith('#')?doc.getElementById(selector.slice(1)):null;},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);},
  replaceChildren(...children){if(this.children.some(n=>contains(n,doc.activeElement)))doc.activeElement=null;this.children=children;this.replacements++;},
  addEventListener(name,fn){this.listeners.set(name,fn);},focus(){doc.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;this.listeners.get('close')?.();},
 };all.push(e);return e;
}
const documentEvents=new EventTarget();
doc={body:element('body'),activeElement:null,getElementById(id){if(!byId.has(id))byId.set(id,element());return byId.get(id);},createElement:element,querySelectorAll:s=>s==='[data-character]'?all.filter(e=>e.dataset.character):[],querySelector:()=>null,addEventListener:documentEvents.addEventListener.bind(documentEvents),removeEventListener:documentEvents.removeEventListener.bind(documentEvents)};
globalThis.document=doc;globalThis.window=new EventTarget();Object.defineProperty(globalThis,'localStorage',{value:storage,writable:true,configurable:true});
const modeStore=new Map(),preferences={getItem:key=>modeStore.get(key),setItem:(key,value)=>modeStore.set(key,value)},destination=createDestinationPreference(preferences),visits=[],notices=[];
const places=[{id:'staff-center',name:'서울역 안내센터',kind:'staff'},{id:'rail-block',name:'TRAIN MATES',kind:'claim',item:'rail-block'}];
let participant='one',invalidations=0;const ui=createAdventureUI({self:{character:'adult-woman'},places,indexes:{},presence:{id:()=>participant},world:{invalidate(){invalidations++;}},clearInput(){},goTo:async place=>{visits.push([place.id,destination.mode]);return destination.mode!=='route';},getDestinationMode:()=>destination.mode,onNotice:message=>notices.push(message),storage});
try{
 ui.setConnected(true);const list=byId.get('mission-list'),bag=byId.get('bag-items'),button=list.children[0].children[1].children.at(-1),replacements=list.replacements,bagReplacements=bag.replacements;button.focus();
 for(let i=0;i<4;i++)ui.receive(emptyGame());
 assert.equal(list.children[0].children[1].children.at(-1),button,'unchanged sync must preserve the actual mission button');assert.equal(doc.activeElement,button,'keyboard focus survives unchanged snapshots');assert.equal(list.replacements,replacements);assert.equal(bag.replacements,bagReplacements);
 const game={...emptyGame(),inventory:['rail-block'],stamps:['rail-block'],heldItem:'rail-block'};ui.receive(game);assert.equal(byId.get('passport-progress').textContent,'1 / 6');assert.equal(list.replacements,replacements+1);assert.equal(bag.replacements,bagReplacements+1);const completedButton=list.children[0].children[1].children.at(-1);completedButton.focus();
 ui.receive({...game,lastResult:{requestId:'11111111-1111-4111-8111-111111111111',kind:'equip',target:'rail-block',message:'확인',awarded:false}});ui.setConnected(true);assert.equal(list.replacements,replacements+1,'receipt-only changes do not rebuild visible cards');assert.equal(doc.activeElement,completedButton);
 ui.receive({...game,heldItem:''});assert.equal(byId.get('held-label').hidden,true);assert.equal(list.replacements,replacements+2,'equipment changes still update the visible state');ui.setConnected(false);assert.equal(byId.get('passport-mode').textContent,'나만의 서울역 여행');assert.equal(byId.get('passport-progress').textContent,'0 / 6');
 const firstMission=()=>list.children[0].children[1].children.at(-1),firstBag=()=>bag.children[0].children[1].children.at(-1);
 assert.equal(destination.mode,'walk');assert.equal(firstMission().textContent,'경로 따라 걷기');assert.equal(firstBag().textContent,'경로 따라 걷기');await firstMission().listeners.get('click')();
 destination.set('teleport');ui.refreshDestinationMode();assert.equal(createDestinationPreference(preferences).mode,'teleport');assert.equal(firstMission().textContent,'순간이동');assert.equal(firstBag().textContent,'순간이동');await firstMission().listeners.get('click')();await firstBag().listeners.get('click')();
 destination.set('route');ui.refreshDestinationMode();assert.equal(createDestinationPreference(preferences).mode,'route');assert.equal(firstMission().textContent,'경로 표시');assert.equal(firstBag().textContent,'경로 표시');
 const noticeCount=notices.length;await firstMission().listeners.get('click')();await firstBag().listeners.get('click')();assert.equal(notices.length,noticeCount,'previewing a path must not show an arrival notice');
 assert.deepEqual(visits,[['staff-center','walk'],['staff-center','teleport'],['rail-block','teleport'],['staff-center','route'],['rail-block','route']]);
 console.log('PASS: journey UI retains focus during sync, renders progress/equipment, and updates both mission and bag actions from the remembered movement preference');
}finally{ui.dispose();for(const [key,descriptor]of Object.entries(original))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
