const ORIGINS=new Set(['http://127.0.0.1:4197','http://localhost:4197','https://toolkit.yanerdstation.kr','https://ya-nerd-station.soalsebi.chatgpt.site']);
export function toolkitTarget(search){const params=new URLSearchParams(search),target=params.get('toolkitOrigin');return params.get('toolkit')==='1'&&ORIGINS.has(target)?target:null;}
export function sendToolkitMessage(data){const target=toolkitTarget(location.search);if(target&&window.parent!==window)window.parent.postMessage({channel:'station-toolkit',...data},target);}
