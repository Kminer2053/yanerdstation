import {build} from 'esbuild';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sdk=JSON.parse(await readFile(new URL('../node_modules/@mediapipe/tasks-vision/package.json',import.meta.url),'utf8'));
if(sdk.version!=='0.10.32')throw Error('Selfie SDK version must remain pinned to the reviewed 0.10.32 assets.');
// MediaPipe's official WASM loader uses importScripts. Keep this worker classic
// instead of a module worker; bundle the SDK here without a remote CDN import.
await build({entryPoints:[new URL('../src/commons-selfie-worker.js',import.meta.url).pathname],outfile:new URL('../public/assets/commons/segmentation/selfie-worker.js',import.meta.url).pathname,bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'inline'});

const root=new URL('../public/assets/commons/segmentation/',import.meta.url);
const assets=['LICENSE.Apache-2.0.txt','selfie-worker.js','selfie_segmenter.tflite',...['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'].map(name=>'wasm/'+name)];
for(const name of assets.filter(v=>v.startsWith('wasm/')))await copyFile(new URL('../node_modules/@mediapipe/tasks-vision/'+name,import.meta.url),new URL(name,root));
const files=await Promise.all(assets.map(async path=>{const data=await readFile(new URL(path,root));return {path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}));
await writeFile(new URL('manifest.json',root),JSON.stringify({sdk:'@mediapipe/tasks-vision@0.10.32',model:'selfie_segmenter/float16/1',license:'Apache-2.0',files},null,2)+'\n');
