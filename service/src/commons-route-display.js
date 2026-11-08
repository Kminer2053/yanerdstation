import * as T from 'three';
export function routeRibbon(points,width,lift=.06){
 const out=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz);if(d<.001)continue;const nx=-dz/d*width/2,nz=dx/d*width/2,p=[a[0]+nx,a[1]+lift,a[2]+nz],q=[a[0]-nx,a[1]+lift,a[2]-nz],r=[b[0]+nx,b[1]+lift,b[2]+nz],s=[b[0]-nx,b[1]+lift,b[2]-nz];out.push(...p,...q,...r,...q,...s,...r);}return out;
}
export function createRouteDisplay(scene){
 let root=null,floor='2F',overview=false;
 const clear=()=>{if(!root)return;scene.remove(root);root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});root=null;};
 const visibility=()=>{for(const group of root?.children||[])group.visible=group.userData.floor===floor||group.userData.toFloor===floor;};
 return {
  show(plan){clear();root=new T.Group();root.name='walking-route';for(const leg of plan.legs||[]){const group=new T.Group();group.userData={floor:leg.floor,toFloor:leg.connection?.to.floor};for(const [width,lift,color]of [[.38,.065,'#28473d'],[.2,.071,'#ffe269']]){const data=routeRibbon(leg.points,width,lift);if(!data.length)continue;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data,3));const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));mesh.renderOrder=4;group.add(mesh);}root.add(group);}scene.add(root);visibility();},
  setFloor(next,onOverview=false){floor=next;overview=onOverview;visibility();},
  clear,
  dispose:clear,
 };
}
