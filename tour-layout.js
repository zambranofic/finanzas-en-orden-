export function placeTourCard(target,viewport,card){
const gap=14,edge=16,w=Math.min(card.width,Math.max(1,viewport.width-edge*2)),h=Math.min(card.height,Math.max(1,viewport.height-edge*2));
const clamp=(v,min,max)=>Math.max(min,Math.min(v,Math.max(min,max)));
let placement='bottom',left=clamp(target.left+(target.width-w)/2,edge,viewport.width-w-edge),top;
if(target.right+gap+w<=viewport.width-edge){placement='right';left=target.right+gap;top=clamp(target.top+(target.height-h)/2,edge,viewport.height-h-edge)}
else if(target.left-gap-w>=edge){placement='left';left=target.left-gap-w;top=clamp(target.top+(target.height-h)/2,edge,viewport.height-h-edge)}
else if(target.bottom+gap+h<=viewport.height-edge){top=target.bottom+gap}
else if(target.top-gap-h>=edge){placement='top';top=target.top-gap-h}
else{placement='center';top=clamp(viewport.height-h-edge,edge,viewport.height-h-edge)}
return {left,top,width:w,height:h,placement,arrow:placement==='left'||placement==='right'?clamp(target.top+target.height/2-top,24,h-24):clamp(target.left+target.width/2-left,24,w-24)};
}
