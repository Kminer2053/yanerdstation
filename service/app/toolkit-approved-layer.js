// Administrator-approved changes only. Unapproved report drafts never enter this public layer.
import {assetLocalPosition,partTexturePlanes,quadNormal} from './toolkit-geometry.js';
export function toolkitMapData(data, siteId, origin) {
  const image = url => new URL(url, origin).href;
  return {
    assets: (data.assets || []).filter(a => a.proposal && !a.hidden).map(a => ({...a, facades: Object.fromEntries(Object.entries(a.facades || {}).map(([side, url]) => [side, image(url)]))})),
    replacements: (data.overlays || []).filter(o => Array.isArray(o.position) && Array.isArray(o.surface)).map(o => ({
      id: 'toolkit:' + o.alias + ':' + (o.at || ''), slot_key: o.alias, image_url: image(o.image),
      replacement_width_px: o.px?.[0] ?? null, replacement_height_px: o.px?.[1] ?? null,
      current_store_name: o.name, review_status: 'approved', is_active: true, toolkit_approved: true,
      slot: {site_id: siteId, slot_alias: o.alias, object_label: o.name, floor: o.floor,
        longitude: o.position[0], latitude: o.position[1], height_m: o.position[2],
        camera_heading_deg: o.heading, surface_width_m: o.surface[0], surface_height_m: o.surface[1],
        crop_width_px: o.px?.[0] ?? null, crop_height_px: o.px?.[1] ?? null},
    })),
  };
}

export function mergeApprovedReplacements(base, updates) {
  const merged = new Map(base.map(r => [r.slot?.slot_alias || r.slot_key, {...r}]));
  for (const update of updates) {
    const alias = update.slot.slot_alias, previous = merged.get(alias);
    // Preserve reviewed mesh surfaces, special-asset routing and hashed slot IDs.
    merged.set(alias, previous ? {...previous, ...update, slot_key: previous.slot_key, slot: {...previous.slot}} : update);
  }
  return [...merged.values()];
}

export function assetFacePositions(asset, side) {
  const [w,d] = asset.size, p = asset.position;
  const sides = {front:[[-w/2,-d/2-.03],[w/2,-d/2-.03]],right:[[w/2+.03,-d/2],[w/2+.03,d/2]],back:[[w/2,d/2+.03],[-w/2,d/2+.03]],left:[[-w/2-.03,d/2],[-w/2-.03,-d/2]]};
  const angle = -asset.heading * Math.PI/180;
  return (sides[side] || []).map(([x,y]) => [p[0]+(x*Math.cos(angle)-y*Math.sin(angle))/(111320*Math.cos(p[1]*Math.PI/180)),p[1]+(x*Math.sin(angle)+y*Math.cos(angle))/111320,p[2]]);
}

function addPartPlane(C, primitives, asset, face, props, prefix) {
  const image=asset.facades?.[face.texture];if(!image)return null;
  if(!primitives)throw Error('구성요소 텍스처를 그릴 3D 레이어가 없습니다.');
  const points=face.vertices.map(v=>C.Cartesian3.fromDegrees(...assetLocalPosition(asset,v))),values=new Float64Array(points.flatMap(p=>[p.x,p.y,p.z]));
  const normal=quadNormal(points.map(p=>[p.x,p.y,p.z]));
  const geometry=new C.Geometry({attributes:{
    position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values}),
    normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(Array(4).fill(normal).flat())}),
    st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array(face.uv.flat())}),
  },indices:new Uint16Array([0,1,2,0,2,3]),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(values)});
  // Position, normal and st match MaterialAppearance's TEXTURED vertex format.
  // An explicit quad preserves vertical/tilted surfaces and doorway gaps; a polygon projected onto the globe would not.
  const primitive=primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry,id:{id:prefix+asset.id+':part:'+face.id,...props}}),
    appearance:new C.MaterialAppearance({material:C.Material.fromType('Image',{image}),flat:true,faceForward:true,translucent:true,closed:false,
      renderState:{depthTest:{enabled:true},depthMask:false,cull:{enabled:false},polygonOffset:{enabled:true,factor:-1,units:-1}}}),asynchronous:false}));
  return {primitive,floor:asset.floor,assetId:asset.id,partId:face.id};
}

export function addAssetEntities(C, entities, asset, {preview=false,primitives=null}={}) {
  const p = asset.position, h = asset.size[2], pos = q => C.Cartesian3.fromDegrees(...q);
  const props = {floor:asset.floor,approvedProposal:asset.proposal || '',toolkit:{kind:'assets',id:asset.id}};
  const prefix=preview?'draft:':'approved:',records=[];
  if(Array.isArray(asset.parts)){
    // The label anchors the facility, while each real part is separate. Never fill the parent bounding box.
    entities.add({id:prefix+asset.id,position:pos([p[0],p[1],p[2]+h+.15]),properties:props,
      label:{text:asset.name+(preview?' · 임시':''),font:'12px sans-serif',showBackground:true,distanceDisplayCondition:new C.DistanceDisplayCondition(0,100)}});
    for(const part of asset.parts){
      if(part.type==='box'){
        const [x,y,z]=part.offset,[w,d,hh]=part.size;
        entities.add({id:prefix+asset.id+':part:'+part.id,position:pos(assetLocalPosition(asset,[x,y,z+hh/2])),
          orientation:C.Transforms.headingPitchRollQuaternion(pos(p),new C.HeadingPitchRoll(C.Math.toRadians(asset.heading),0,0)),
          box:{dimensions:new C.Cartesian3(w,d,hh),material:C.Color.fromCssColorString(part.color||asset.color).withAlpha(asset.source_record ? .3 : 1)},properties:props});
      }
      for(const face of partTexturePlanes(part)){const record=addPartPlane(C,primitives,asset,face,props,prefix);if(record)records.push(record);}
    }
    return records;
  }
  entities.add({id:(preview?'draft:':'approved:')+asset.id,position:pos([p[0],p[1],p[2]+h/2]),
    orientation:C.Transforms.headingPitchRollQuaternion(pos(p),new C.HeadingPitchRoll(C.Math.toRadians(asset.heading),0,0)),
    box:{dimensions:new C.Cartesian3(...asset.size),material:C.Color.fromCssColorString(asset.color).withAlpha(asset.source_record ? .3 : 1)},
    properties:props,label:{text:asset.name+(preview?' · 임시':''),font:'12px sans-serif',showBackground:true,distanceDisplayCondition:new C.DistanceDisplayCondition(0,100)}});
  for (const [side,image] of Object.entries(asset.facades || {})) {
    const points=assetFacePositions(asset,side);if(points.length!==2)continue;
    entities.add({id:(preview?'draft:':'approved:')+asset.id+':'+side,properties:props,wall:{positions:points.map(pos),minimumHeights:[p[2],p[2]],maximumHeights:[p[2]+h,p[2]+h],material:new C.ImageMaterialProperty({image,transparent:false})}});
  }
  return records;
}
