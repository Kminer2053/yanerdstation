// A shared source image can cover distant shops/fixtures. Its union rectangle
// is unsuitable for streaming priority: empty space inside it is not a surface.
export function sourceDetailRegions(page,sourceGroups,metadata){
 const regions=new Map();for(const part of page.parts){const geometry=sourceGroups.get(part.group),floor=metadata.find(g=>g.name===part.group)?.floor;if(!geometry||!floor)continue;const position=geometry.getAttribute('position'),indices=part.indices||part.ranges.flatMap(([start,count])=>Array.from(geometry.index.array.subarray(start,start+count)));if(!regions.has(floor))regions.set(floor,[]);const out=regions.get(floor);
  for(let i=0;i+2<indices.length;i+=3){let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;for(const id of indices.slice(i,i+3)){const x=position.getX(id),y=position.getY(id),z=position.getZ(id);x0=Math.min(x0,x);y0=Math.min(y0,y);z0=Math.min(z0,z);x1=Math.max(x1,x);y1=Math.max(y1,y);z1=Math.max(z1,z);}out.push(x0,y0,z0,x1,y1,z1);}
 }return new Map([...regions].map(([floor,list])=>[floor,new Float32Array(list)]));
}
export function detailRegionDistance(position,regions,floor,inTransit=false){
 let best=Infinity;for(const [key,boxes]of regions){if(!inTransit&&key!==floor)continue;for(let i=0;i<boxes.length;i+=6){const dx=Math.max(boxes[i]-position.x,0,position.x-boxes[i+3]),dy=Math.max(boxes[i+1]-position.y,0,position.y-boxes[i+4]),dz=Math.max(boxes[i+2]-position.z,0,position.z-boxes[i+5]),d=dx*dx+dy*dy+dz*dz;if(d<best)best=d;}}return Math.sqrt(best);
}
export function selectDetailEntries(candidates,{position,floor,inTransit=false,mobile=false,cached=new Set(),focus=null}){
 const chosen = [];
 for (const type of ['facade','source']) {
  const source = type === 'source';
  const cap = mobile ? 3 : source ? 6 : 5;
  const range = source ? 28 : 24;
  let ranked = candidates.filter(entry => entry.type === type && (inTransit || entry.floors.includes(floor)))
   .map(entry => {
    const [minX,minZ,maxX,maxZ] = entry.bounds;
    const distance = source ? detailRegionDistance(position,entry.regions,floor,inTransit) : Math.hypot(
     Math.max(minX-position.x,0,position.x-maxX),Math.max(minZ-position.z,0,position.z-maxZ));
    const focused = source && focus && detailRegionDistance(focus,entry.regions,floor,inTransit) < .35;
    return {entry,distance,score:distance+(entry.penalty||0)-(cached.has(entry.id)?.8:0)-(focused?100:0)};
   }).filter(item => item.distance < range).sort((a,b) => a.score-b.score).map(item => item.entry);
  if (source) {
   // If either central StoryWay front would receive detail, keep its adjacent
   // photograph in the same budget. The approved-facade budget is independent.
   const pairs = new Set(ranked.slice(0,cap).map(entry => entry.data?.detailPair).filter(Boolean));
   if (pairs.size) {
    const paired = entry => pairs.has(entry.data?.detailPair);
    ranked = [...ranked.filter(paired),...ranked.filter(entry => !paired(entry))];
   }
  }
  chosen.push(...ranked.slice(0,cap));
 }
 return chosen;
}
