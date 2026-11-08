import {roundWalk} from './commons-core.js';
// Keep every bend needed by the server's straight-segment validation. A pending
// request owns an immutable prefix; newly walked points may only compress its
// suffix, never replace coordinates the acknowledgement will later remove.
export function createWalkTrail({canTraverse,limit=32}={}){
 let points=[],origin=[0,0],last=[0,0],floor='2F',locked=0;
 return {
  reset(next,position){floor=next;origin=position.map(roundWalk);last=origin;points=[];locked=0;},
  record(x,z){const p=[roundWalk(x),roundWalk(z)];if(Math.hypot(p[0]-last[0],p[1]-last[1])<.0001)return true;if(canTraverse&&!canTraverse(floor,last,p))return false;
   const previous=points.length>=2?points.at(-2):origin;if(points.length>locked&&canTraverse?.(floor,previous,p))points[points.length-1]=p;else{if(points.length>=limit)return false;points.push(p);}last=p;return true;
  },
  freeze(){locked=points.length;return {count:locked,path:points.map(p=>p.slice())};},
  acknowledge(count,position){points.splice(0,count);origin=position.map(roundWalk);locked=0;last=points.at(-1)||origin;},
  get length(){return points.length;},
 };
}
