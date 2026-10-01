import assert from 'node:assert/strict';
import {placeTourCard} from './tour-layout.js';
for(const width of [320,390,768,1348]){
for(const height of [500,844,936]){
for(const rect of [
{left:16,top:70,right:150,bottom:114,width:134,height:44},
{left:width-160,top:height-80,right:width-16,bottom:height-36,width:144,height:44},
{left:16,top:-80,right:width-16,bottom:height+80,width:width-32,height:height+160}
]){
const p=placeTourCard(rect,{width,height},{width:380,height:360});
assert(p.left>=16&&p.top>=16);
assert(p.left+p.width<=width-16);
assert(p.top+p.height<=height-16);
assert(['left','right','top','bottom','center'].includes(p.placement));
}
}
}
const right=placeTourCard({left:20,top:100,right:80,bottom:140,width:60,height:40},{width:1348,height:936},{width:380,height:300});
assert.equal(right.placement,'right');
const left=placeTourCard({left:1100,top:100,right:1200,bottom:140,width:100,height:40},{width:1348,height:936},{width:380,height:300});
assert.equal(left.placement,'left');
console.log('tour-layout: readable card stays within narrow, short and desktop viewports PASS');
