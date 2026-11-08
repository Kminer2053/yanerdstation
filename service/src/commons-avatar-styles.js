// Shared, DOM-free identities for the client and presence validation.
export const AVATAR_IDS=Object.freeze(['child-boy','child-girl','adult-man','adult-woman','elder-man','elder-woman']);
export const DEFAULT_AVATAR_ID='adult-woman';
export const AVATAR_STYLES=Object.freeze({
 'child-boy':Object.freeze({name:'어린이 · 남',height:.74,width:.88,head:1.14,skin:'#e9b58f',hair:'#50392e',hairStyle:'crop',coat:'#e89c3d',shirt:'#fff4d9',trousers:'#456a91',shoes:'#f1f4e9',bag:'#4f8eae',backpack:true}),
 'child-girl':Object.freeze({name:'어린이 · 여',height:.72,width:.86,head:1.15,skin:'#efc1a0',hair:'#382d2e',hairStyle:'pigtails',coat:'#9674bd',shirt:'#fff4e6',trousers:'#575e7f',shoes:'#f3ddbd',bag:'#eaa4b6',skirt:true,backpack:true}),
 'adult-man':Object.freeze({name:'성인 · 남',height:1.02,width:1.04,head:1,skin:'#c89470',hair:'#352e29',hairStyle:'swept',coat:'#3e7e7a',shirt:'#f0e5d2',trousers:'#344453',shoes:'#293438',bag:'#ce9c52',luggage:true}),
 'adult-woman':Object.freeze({name:'성인 · 여',height:.96,width:.94,head:1.02,skin:'#e7b18d',hair:'#302d31',hairStyle:'bob',coat:'#bf6d60',shirt:'#fff0d9',trousers:'#394453',shoes:'#ebd5bb',bag:'#6f657e',luggage:true}),
 'elder-man':Object.freeze({name:'어르신 · 남',height:.94,width:1.06,head:1.02,skin:'#d7a887',hair:'#c4c4bb',hairStyle:'balding',coat:'#9b9274',shirt:'#ecdfc5',trousers:'#59646a',shoes:'#493c31',bag:'#8c6049',glasses:true,moustache:true,stoop:.06}),
 'elder-woman':Object.freeze({name:'어르신 · 여',height:.89,width:.97,head:1.04,skin:'#e1b291',hair:'#d6d2c8',hairStyle:'bun',coat:'#a789a5',shirt:'#fff0d8',trousers:'#5e6268',shoes:'#5a4440',bag:'#ba795b',glasses:true,skirt:true,handbag:true,stoop:.035}),
});
export function avatarStyle(person={}){const base=AVATAR_STYLES[person.character]||AVATAR_STYLES[DEFAULT_AVATAR_ID];return person.npcRole==='staff'?{...base,height:person.character==='adult-woman'?.97:1.02,width:.98,coat:'#233d60',shirt:'#f1f2e7',trousers:'#233347',shoes:'#17242f',luggage:false,backpack:false,handbag:false,skirt:false,glasses:false,staff:true}:base;}
