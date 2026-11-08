const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runPhotoSequence({count,capture,onCountdown=()=>{},onFrame=()=>{},wait=pause,isCurrent=()=>true}){
 if(![1,4].includes(count))throw Error('촬영 장수를 확인해 주세요.');const frames=[];
 for(let i=0;i<count;i++){for(let n=3;n>0;n--){if(!isCurrent())return null;onCountdown(n,i);await wait(650);}if(!isCurrent())return null;onCountdown('찰칵!',i);const frame=await capture(i);if(!isCurrent())return null;frames.push(frame);onFrame(frame,i);await wait(180);}return isCurrent()?frames:null;
}
