// Rasterize the repo-native package drawings for the lightweight WebGL item.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
for(const [name,width]of [['package',512],['can',256],['item',640]]){
 const source=new URL('../public/assets/commons/guunran-sai-'+name+'.svg',import.meta.url),output=new URL('../public/assets/commons/guunran-sai-'+name+'.png',import.meta.url);
 const image=await sharp(await readFile(source)).resize({width}).png({compressionLevel:9}).toBuffer();await writeFile(output,image);
 const info=await sharp(image).metadata();console.log(JSON.stringify({asset:'guunran-sai-'+name+'.png',width:info.width,height:info.height,bytes:image.length}));
}
