// Preview-only bridge: there is deliberately no save, fetch, or database operation.
import { addAssetEntities } from './toolkit-approved-layer.js';
import { assetFocusView, unobstructedAssetView } from './toolkit-geometry.js';
import {firstVisibleTile} from './map-load-lifecycle.js';
import {toolkitTarget} from './toolkit-messages.js';
export function createToolkitScene(C,viewer,hooks){
  const target=toolkitTarget(location.search);
  if(!target||window.parent===window)return;
  const send=data=>parent.postMessage({channel:'station-toolkit',...data},target);
  const layer=new C.CustomDataSource('toolkit-preview');viewer.dataSources.add(layer);
  const surfaces=viewer.scene.primitives.add(new C.PrimitiveCollection());
  const markers=new C.PointPrimitiveCollection();viewer.scene.primitives.add(markers);
  let project=null,floor=hooks.initialFloor||'2F',grid=true,selected=null,cancelFocusRefine=null,focusVersion=0,renderAbort=null,disposed=false;
  function watchFloor(){
    renderAbort?.abort();if(!hooks.tileset)return;const controller=new AbortController();renderAbort=controller;const f=floor;
    send({event:'loading',stage:'first-tile',floor:f});
    firstVisibleTile(hooks.tileset,20000,{scene:viewer.scene,signal:controller.signal}).then(()=>{if(!disposed&&!controller.signal.aborted&&floor===f)send({event:'rendered',floor:f});},error=>{if(!disposed&&error.name!=='AbortError')send({event:'error',stage:'first-tile',floor:f,message:error.message});});
  }
  const clearFocusRefine=()=>{focusVersion++;cancelFocusRefine?.();cancelFocusRefine=null;};
  const colors={origin:'#35c978',via:'#eef4f2',connection:'#398bef',facility:'#f3be35'};
  const pos=p=>C.Cartesian3.fromDegrees(...p),col=s=>C.Color.fromCssColorString(s);
  function draw(){
    layer.entities.removeAll();surfaces.removeAll();markers.removeAll();if(!project)return;
    const byId=new Map(project.points.map(p=>[p.id,p]));
    for(const p of project.points){if(p.floor!==floor||p.role==='via'&&!grid)continue;
      markers.add({id:{toolkit:{kind:'points',id:p.id}},position:pos([p.position[0],p.position[1],p.position[2]+.14]),pixelSize:p.role==='via'?5:12,color:col(colors[p.role]||'#fff'),outlineWidth:1,outlineColor:C.Color.BLACK});
      if(p.role!=='via')layer.entities.add({position:pos(p.position),label:{text:p.name,font:'12px sans-serif',fillColor:C.Color.WHITE,showBackground:true,pixelOffset:new C.Cartesian2(0,-18),distanceDisplayCondition:new C.DistanceDisplayCondition(0,150)}});
      if(p.area)layer.entities.add({polygon:{hierarchy:p.area.map(pos),perPositionHeight:true,material:col(colors.origin).withAlpha(.22)}});
    }
    for(const c of project.connections||[]){const pts=c.point_ids.map(id=>byId.get(id)).filter(Boolean);if(!pts.some(p=>p.floor===floor))continue;
      const route=c.path?.length?c.path.map(id=>byId.get(id)).filter(Boolean):pts;
      if(route.length>1)layer.entities.add({polyline:{positions:route.map(p=>pos(p.position)),width:3,material:col('#398bef')}});
    }
    const routes=selected?.kind==='routes'?project.routes.filter(r=>r.id===selected.id):[];
    for(const r of routes){const ids=r.preview_changed?r.point_ids:(r.raw_point_ids||r.point_ids);const pts=ids.map(id=>byId.get(id)).filter(Boolean);
      for(let i=1;i<pts.length;i++)if(pts[i-1].floor===floor||pts[i].floor===floor)layer.entities.add({polyline:{positions:[pts[i-1],pts[i]].map(p=>pos([p.position[0],p.position[1],p.position[2]+.2])),width:6,material:new C.PolylineArrowMaterialProperty(col('#f4b437'))}});
    }
    for(const a of project.assets||[]){if(a.floor!==floor||a.hidden||a.source_record&&!a.preview_changed||a.proposal&&!a.preview_changed&&hooks.hasApprovedAsset?.(a.id))continue;
      const asset={...a,facades:Object.fromEntries(Object.entries(a.facades||{}).map(([side,image])=>[side,new URL(image,target).href]))};
      addAssetEntities(C,layer.entities,asset,{preview:!a.proposal||a.preview_changed,primitives:surfaces});
    }
    viewer.scene.requestRender();
  }
  function focus(p,refined=false){
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))return;
    if(!refined)clearFocusRefine();
    const version=focusVersion;
    const asset=project?.assets?.find(a=>a.floor===floor&&!a.hidden&&!a.source_record&&a.position?.length===3&&a.position.every((v,i)=>Math.abs(v-p[i])<1e-8));
    const frustum=viewer.camera.frustum||{},canvas=viewer.scene.canvas;
    let view=asset&&assetFocusView(asset,{fovy:frustum.fovy,aspectRatio:frustum.aspectRatio||canvas.clientWidth/canvas.clientHeight,near:frustum.near});
    if(view){
      const center=pos(view.center);
      view=unobstructedAssetView(view,candidate=>{
        // Same pinned Cesium ray API as the exploration camera; optional because
        // Cesium marks it private. A missing/unsupported picker keeps the front view.
        if(typeof viewer.scene.drillPickFromRay!=='function')return null;
        try{
          const h=candidate.heading,p=candidate.pitch,back=new C.Cartesian3(-Math.sin(h)*Math.cos(p),-Math.cos(h)*Math.cos(p),-Math.sin(p));
          const direction=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(C.Transforms.eastNorthUpToFixedFrame(center),back,new C.Cartesian3()),new C.Cartesian3());
          const excluded=Array.from({length:surfaces.length},(_,i)=>surfaces.get(i));
          let nearest=Infinity;
          for(const hit of viewer.scene.drillPickFromRay(new C.Ray(center,direction),16,excluded)||[]){
            const object=hit?.object;
            if(!hit.position||!(object instanceof C.Cesium3DTileFeature||object?.primitive instanceof C.Cesium3DTileset))continue;
            const distance=C.Cartesian3.distance(center,hit.position);if(distance>.2)nearest=Math.min(nearest,distance);
          }
          return nearest;
        }catch{return null;}
      });
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center,view.radius),{offset:new C.HeadingPitchRange(view.heading,view.pitch,view.range),duration:.4,
        complete:!refined&&hooks.afterTilesLoaded?()=>{if(version===focusVersion)cancelFocusRefine=hooks.afterTilesLoaded(()=>{cancelFocusRefine=null;if(version===focusVersion)focus(p,true);});}:undefined});return;
    }
    viewer.camera.flyTo({destination:pos([p[0],p[1]-.0003,p[2]+30]),orientation:{heading:0,pitch:C.Math.toRadians(-45),roll:0},duration:.4});
  }
  const onMessage=e=>{if(e.origin!==target||e.source!==parent||e.data?.channel!=='station-toolkit')return;const d=e.data;
    if(d.action==='render'&&d.project?.site_id==='S202103'){clearFocusRefine();project=d.project;selected=d.selected;hooks.setDraftFacades?.([...new Set((project.assets||[]).filter(a=>typeof a.id==='string'&&a.approved_facade?.alias===a.id).map(a=>a.id))]);draw();}
    if(d.action==='floor'&&/^(B[1-9]|[1-9]F|RF)$/.test(d.floor)){clearFocusRefine();floor=d.floor;watchFloor();hooks.setFloor(floor);draw();}
    if(d.action==='grid'){grid=!!d.value;draw();}
    if(d.action==='focus')focus(d.position);
    if(d.action==='fit'){clearFocusRefine();hooks.overview();}
    if(d.action==='hello')send({event:'ready'});
    if(d.action==='capture'&&typeof d.request_id==='string'&&/^[a-f0-9-]{36}$/.test(d.request_id)){
      try{viewer.render();const source=viewer.scene.canvas,k=Math.min(1,2048/Math.max(source.width,source.height)),canvas=document.createElement('canvas');if(!source.width||!source.height)throw Error('지도 화면이 준비되지 않았습니다.');canvas.width=Math.max(1,Math.round(source.width*k));canvas.height=Math.max(1,Math.round(source.height*k));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);const image=canvas.toDataURL('image/jpeg',.86);if(image.length>5_400_000)throw Error('캡처 이미지 용량이 큽니다. 시야를 좁혀 다시 캡처하세요.');send({event:'capture',request_id:d.request_id,image});}
      catch(error){send({event:'capture',request_id:d.request_id,error:'현재 화면을 캡처하지 못했습니다. 지도 표시를 확인한 뒤 다시 시도하세요.'});}
    }
    // Report review (야!너두 console): show a proposed facade on its slot and fly to the slot's front. Preview only.
    if(d.action==='facade-preview'){const clear=d.imageUrl===null;if(clear||typeof d.slotAlias==='string'&&d.slotAlias.length<=120&&typeof d.imageUrl==='string'&&d.imageUrl.length<=6400040&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.imageUrl))hooks.previewFacade?.(clear?null:{slotAlias:d.slotAlias,imageUrl:d.imageUrl});}
    if(d.action==='facade-focus'&&d.focus&&typeof d.focus==='object'){const f=d.focus,n=v=>Number.isFinite(v)?v:undefined;if(/^(B[1-9]|[1-9]F|RF)$/.test(f.floor)&&Number.isFinite(f.longitude)&&Number.isFinite(f.latitude)){clearFocusRefine();floor=f.floor;watchFloor();hooks.focusFacade?.({floor:f.floor,longitude:f.longitude,latitude:f.latitude,height:n(f.height),cameraHeading:n(f.cameraHeading),surfaceWidth:n(f.surfaceWidth),surfaceHeight:n(f.surfaceHeight),label:String(f.label||'').slice(0,80),imageId:String(f.imageId||'').slice(0,120),model:String(f.model||'').slice(0,40),tdId:String(f.tdId||'').slice(0,80)});draw();}}
  };
  addEventListener('message',onMessage);
  viewer.scene.canvas.addEventListener?.('pointerdown',clearFocusRefine);
  viewer.scene.canvas.addEventListener?.('wheel',clearFocusRefine,{passive:true});
  const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(e=>{let p;try{p=viewer.scene.pickPosition(e.position);}catch{}if(!p)return;const c=C.Cartographic.fromCartesian(p),picked=viewer.scene.pick(e.position);
    const tag=picked?.id?.toolkit||picked?.id?.properties?.toolkit?.getValue(C.JulianDate.now())||null;
    send({event:'pick',pick:{floor,position:[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),c.height],tag,sourceId:picked?.getProperty?.('TD_ID')||null,view:{heading:C.Math.toDegrees(viewer.camera.heading),pitch:C.Math.toDegrees(viewer.camera.pitch)}}});
  },C.ScreenSpaceEventType.LEFT_CLICK);
  send({event:'ready'});
  send({event:'rendered',floor});
  return {refresh:draw,dispose(){disposed=true;renderAbort?.abort();clearFocusRefine();hooks.setDraftFacades?.([]);removeEventListener('message',onMessage);viewer.scene.canvas.removeEventListener?.('pointerdown',clearFocusRefine);viewer.scene.canvas.removeEventListener?.('wheel',clearFocusRefine);handler.destroy();viewer.dataSources.remove(layer,true);viewer.scene.primitives.remove(surfaces);viewer.scene.primitives.remove(markers);}};
}
