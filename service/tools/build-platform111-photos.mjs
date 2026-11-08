// Rebuild the checked-in WebP panels from downloaded originals named in PLATFORM111_PHOTOS.
import path from 'node:path';
import sharp from 'sharp';
import config from '../app/seoul-platform111.json' with {type:'json'};
import windowLayout from '../app/seoul-platform111-window.json' with {type:'json'};
import {PLATFORM111_MEDIA,PLATFORM111_PHOTOS} from '../app/platform111-slides.js';

const source=process.argv[2];
if(!source)throw Error('사용법: node tools/build-platform111-photos.mjs <촬영 원본 폴더>');
const width=4096;
for(const layout of [config,windowLayout]){
 const height=Math.round(width*config.length*layout.height/(layout.length*(config.media.end-config.media.start)));
 const panels=[];let left=0;
 for(const [i,photo] of PLATFORM111_PHOTOS.entries()){
  const w=i===PLATFORM111_PHOTOS.length-1?width-left:Math.round(width*photo.share);
  const input=sharp(path.join(source,photo.file+'.jpg')),size=await input.metadata();
  const cropHeight=Math.round(size.width*height/w);
  const top=Math.max(0,Math.min(size.height-cropHeight,Math.round(size.height*photo.focus-cropHeight/2)));
  const image=await input.extract({left:0,top,width:size.width,height:cropHeight}).resize(w,height)
   .modulate({brightness:photo.brightness}).png().toBuffer();
  const unit=height/144;
  const caption=Buffer.from(`<svg width="${w}" height="${height}" xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="shade" x2="0" y2="1"><stop offset="45%" stop-color="#061725" stop-opacity="0"/><stop offset="100%" stop-color="#061725" stop-opacity=".89"/></linearGradient></defs>
   <rect width="${w}" height="${height}" fill="url(#shade)"/>
   <path d="M0 0V${height}" stroke="#dec795" stroke-opacity=".6" stroke-width="2"/>
   <path d="M${18*unit} ${height-19*unit}h${22*unit}" stroke="#edcc84" stroke-width="2"/>
   <text x="${49*unit}" y="${height-15*unit}" font-family="sans-serif" font-weight="600" font-size="${15*unit}" letter-spacing="${2.2*unit}" fill="#f9f3df">${String(i+1).padStart(2,'0')} · ${photo.title}</text>
  </svg>`);
  panels.push({input:image,left,top:0},{input:caption,left,top:0});
  left+=w;
 }
 await sharp({create:{width,height,channels:3,background:'#081723'}}).composite(panels)
  .webp({quality:83,effort:6}).toFile('public'+PLATFORM111_MEDIA.images[layout.floor]);
}
