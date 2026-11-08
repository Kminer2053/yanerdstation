// Editor draft contract: local metres, x right, y back, z above the base.
// UVs are supplied per vertex with (0,0) at the image's lower-left; never flip or crop them here.
export function assetLocalPosition(asset, [x,y,z]) {
  const p=asset.position,a=-asset.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [p[0]+(x*c-y*s)/(111320*Math.cos(p[1]*Math.PI/180)),p[1]+(x*s+y*c)/111320,p[2]+z];
}

export function partTexturePlanes(part) {
  if(part.type==='plane')return [part];
  const [w,d,h]=part.size,[x,y,z]=part.offset;
  const sides={front:[[-w/2,-d/2,0],[w/2,-d/2,0],[w/2,-d/2,h],[-w/2,-d/2,h]],right:[[w/2,-d/2,0],[w/2,d/2,0],[w/2,d/2,h],[w/2,-d/2,h]],back:[[w/2,d/2,0],[-w/2,d/2,0],[-w/2,d/2,h],[w/2,d/2,h]],left:[[-w/2,d/2,0],[-w/2,-d/2,0],[-w/2,-d/2,h],[-w/2,d/2,h]]};
  return Object.entries(part.facades||{}).filter(([side])=>sides[side]).map(([side,texture])=>({id:part.id+':'+side,type:'plane',texture,vertices:sides[side].map(p=>[p[0]+x,p[1]+y,p[2]+z]),uv:[[0,0],[1,0],[1,1],[0,1]]}));
}

export function quadNormal(points) {
  const a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
  if(!Number.isFinite(length)||length<1e-8)throw Error('초안 평면의 정점이 겹칩니다.');
  return n.map(v=>v/length);
}

// Keep an indoor preview near eye level. The old generic overview starts 30 m
// above the floor, where the station's upper floors/roof hide a small new asset.
export function assetFocusView(asset,{fovy=Math.PI/3,aspectRatio=1,near=.1}={}) {
  if(!Array.isArray(asset.size)||asset.size.length!==3||!asset.size.every(v=>Number.isFinite(v)&&v>0))return null;
  const [w,d,h]=asset.size,radius=Math.hypot(w,d,h)/2;
  const vertical=Number.isFinite(fovy)&&fovy>0&&fovy<Math.PI?fovy:Math.PI/3;
  const aspect=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:1;
  const halfAngle=Math.min(vertical/2,Math.atan(Math.tan(vertical/2)*aspect));
  const nearMargin=Math.max(.75,Number.isFinite(near)&&near>0?near*4:0);
  const range=Math.max(2.5,radius/Math.sin(halfAngle)*1.15,radius+nearMargin);
  // Lift at most 0.75 m above the centre, rather than climbing over the roof.
  const lift=Math.min(.75,h*.2);
  const pitch=-Math.asin(Math.min(Math.sin(Math.PI/15),lift/range));
  return {center:assetLocalPosition(asset,[0,0,h/2]),radius,heading:asset.heading*Math.PI/180,pitch,range};
}

export function unobstructedAssetView(view,clearance) {
  let best=view,room=-1;
  for(const turn of [0,25,-25,45,-45,65,-65]){
    const candidate={...view,heading:view.heading+turn*Math.PI/180},distance=clearance(candidate);
    if(distance===null)return view; // Picking unavailable: retain size-based framing.
    if(distance>=view.range+.35)return candidate;
    if(Number.isFinite(distance)&&distance>room){best=candidate;room=distance;}
  }
  return best;
}
