// Same hall coordinate frame as the cached B_1_21_15 / F02MV002 triangles.
// Below-floor foundation is excluded from the photograph's framing bounds.
export const GRAND_STAIRS_PHOTO_BOUNDS=Object.freeze([-10.316,0,38.035,-.029,7.086,54.541]);
export function boundsOfPhotoPositions(positions){
 if(!Array.isArray(positions)||positions.length<9||positions.length%3||!positions.every(Number.isFinite))return null;
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],positions[i+k]);bounds[k+3]=Math.max(bounds[k+3],positions[i+k]);}return bounds;
}
