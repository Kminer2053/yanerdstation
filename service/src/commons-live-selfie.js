// The preview drops frames while inference is busy. A shutter snapshots the
// camera immediately and waits for that single inference before processing it.
export function createLiveSelfie({
 readFrame,processFrame,onPortrait,onError,
 interval=125,setTimer=setTimeout,clearTimer=clearTimeout,
}){
 let timer=null,inFlight=null,paused=true,stopped=false,capturing=false,generation=0;

 function process(frame){
  inFlight=Promise.resolve().then(()=>processFrame(frame)).finally(()=>{inFlight=null;});
  return inFlight;
 }

 function schedule(delay){
  if(stopped||paused||capturing||timer!==null||inFlight)return;
  timer=setTimer(renderNext,delay);
 }

 async function renderNext(){
  timer=null;
  if(stopped||paused)return;
  const revision=generation;
  try{
   const frame=readFrame();
   if(!frame)return;
   const portrait=await process(frame);
   if(!stopped&&!paused&&revision===generation)onPortrait(portrait);
  }catch(error){
   if(!stopped&&!paused&&revision===generation){
    if(error.name==='NoPersonError')onPortrait(null);
    else if(error.name!=='AbortError')onError(error);
   }
  }finally{
   schedule(interval);
  }
 }

 function pause(){
  paused=true;
  generation++;
  if(timer!==null)clearTimer(timer);
  timer=null;
 }

 return {
  pause,
  resume(){if(!stopped&&!capturing){paused=false;schedule(0);}},
  async capture(){
   if(stopped||capturing)throw new DOMException('촬영이 중단되었습니다.','AbortError');
   const frame=readFrame();
   if(!frame)throw Error('카메라 화면이 준비되면 다시 촬영해 주세요.');
   pause();
   capturing=true;
   try{
    await inFlight?.catch(()=>{});
    if(stopped)throw new DOMException('촬영이 중단되었습니다.','AbortError');
    const portrait=await process(frame);
    if(stopped)throw new DOMException('촬영이 중단되었습니다.','AbortError');
    return portrait;
   }finally{
    capturing=false;
   }
  },
  dispose(){stopped=true;pause();},
 };
}
