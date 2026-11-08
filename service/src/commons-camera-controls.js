export const wrapYaw=yaw=>Math.atan2(Math.sin(yaw),Math.cos(yaw));
export const cameraYaw=person=>Number.isFinite(person.cameraYaw)?person.cameraYaw:person.yaw;
export function orbitPerson(person,delta){person.cameraYaw=wrapYaw(cameraYaw(person)+delta);}
export function viewPersonFront(person,front=true){person.cameraYaw=wrapYaw(person.yaw+(front?Math.PI:0));person.pitch=0;}
export function movementFromCamera(person,forward,side,distance){const yaw=cameraYaw(person),length=Math.max(1,Math.hypot(forward,side));return [(Math.sin(yaw)*forward+Math.cos(yaw)*side)/length*distance,(-Math.cos(yaw)*forward+Math.sin(yaw)*side)/length*distance];}
