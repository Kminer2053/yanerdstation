import {validPoint,traversable} from './commons-core.js';
// The interaction point belongs to the visitor. A guide stands on a separate
// reachable cell and faces that point, so two bodies never share a position.
export function makeGuidePeople(hall,indexes,places){
 return places.filter(p=>p.kind==='staff').map((p,i)=>{
  const ix=indexes[p.floor],look=p.lookAt||p.point,candidates=ix.nodes.map(n=>hall.walk.points[n]).filter(at=>{const d=Math.hypot(at[0]-p.point[0],at[2]-p.point[2]);return d>=1.2&&d<=2.5&&validPoint(ix,at[0],at[2])&&traversable(ix,[p.point[0],p.point[2]],[at[0],at[2]]);}).sort((a,b)=>Math.hypot(a[0]-look[0],a[2]-look[2])-Math.hypot(b[0]-look[0],b[2]-look[2]));
  const at=candidates[0];if(!at)throw Error('역무원과 만날 보행 위치를 준비하지 못했어요.');
  return {id:p.id,npc:true,npcRole:'staff',character:i?'adult-woman':'adult-man',heldItem:'',floor:p.floor,x:at[0],y:at[1],z:at[2],yaw:Math.atan2(p.point[0]-at[0],-(p.point[2]-at[2])),color:1,pose:'idle',moving:false};
 });
}
