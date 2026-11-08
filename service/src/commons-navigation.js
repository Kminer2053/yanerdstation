import {routeAcross,traversable,groundAt,roundWalk,relocationNode} from './commons-core.js';

const DESTINATION_MODE_KEY='station-one-destination-mode';
const destinationModes={teleport:'순간이동',route:'경로 표시',walk:'경로 따라 걷기'};
export function createDestinationPreference(storage){
 let mode='walk';
 try{const saved=(storage??globalThis.localStorage)?.getItem(DESTINATION_MODE_KEY);if(Object.hasOwn(destinationModes,saved))mode=saved;}catch{}
 return {
  get mode(){return mode;},
  set(value){
   if(!Object.hasOwn(destinationModes,value))return;
   mode=value;
   try{(storage??globalThis.localStorage)?.setItem(DESTINATION_MODE_KEY,mode);}catch{}
  },
 };
}
export const destinationModeLabel=mode=>Object.hasOwn(destinationModes,mode)?destinationModes[mode]:destinationModes.walk;

export function createWalkNavigation({hall,indexes,getSelf,onConnection,onRoute,onState=()=>{}}){
 let trip=null,generation=0;
 const finish=(ok,reason='')=>{const old=trip;trip=null;generation++;old?.resolve(ok);onState({active:false,reason,arrived:ok});};
 return {
  start(target){
   if(trip)finish(false,'replaced');const self=getSelf(),plan=routeAcross(hall,indexes,self.floor,self.x,self.z,target.floor,target.point[0],target.point[2]);if(!plan)return Promise.resolve(false);
   const token=++generation;return new Promise(resolve=>{trip={target,plan,leg:0,point:0,waiting:false,token,resolve};onRoute?.(plan);onState({active:true,target,plan});});
  },
  async teleport(id,moveTo){
   const target=relocationNode(hall,indexes,id);
   if(!target)return false;
   if(trip)finish(false,'teleport');
   await moveTo({floor:target.floor,point:target.point,move:{kind:'node',id:target.id}});
   return true;
  },
  cancel(reason='cancelled'){if(trip)finish(false,reason);},
  get active(){return !!trip;},
  get target(){return trip?.target||null;},
  tick(dt,{paused=false,canMove=true,inTransit=false}={}){
   if(!trip||paused||!canMove||inTransit||trip.waiting)return false;const self=getSelf();let budget=Math.min(.05,Math.max(0,dt))*2.6,moved=false;
   for(let guard=0;trip&&guard<64;guard++){
    const leg=trip.plan.legs[trip.leg];if(!leg){finish(true);break;}
    if(leg.kind==='connection'){
     const token=trip.token;trip.waiting=true;Promise.resolve().then(()=>onConnection(leg.connection)).then(ok=>{if(!trip||trip.token!==token)return;if(ok===false){finish(false,'connection');return;}trip.leg++;trip.point=0;trip.waiting=false;}).catch(()=>{if(trip?.token===token)finish(false,'connection');});break;
    }
    if(leg.floor!==self.floor){finish(false,'floor');break;}
    const point=leg.points[trip.point];if(!point){trip.leg++;trip.point=0;continue;}
    const dx=point[0]-self.x,dz=point[2]-self.z,d=Math.hypot(dx,dz);if(d<.002){trip.point++;continue;}if(budget<=0)break;
    const step=Math.min(d,budget),next=[roundWalk(self.x+dx/d*step),roundWalk(self.z+dz/d*step)],ix=indexes[self.floor];if(!traversable(ix,[self.x,self.z],next)){finish(false,'blocked');break;}
    self.x=next[0];self.z=next[1];self.y=groundAt(ix,self.x,self.z);self.yaw=Math.atan2(dx,-dz);moved=true;budget-=step;if(step>=d-.001)trip.point++;
   }
   return moved;
  },
 };
}
