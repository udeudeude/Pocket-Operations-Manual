/* PO-35 Speak operational model. No DOM, no audio dependency.
   Protocol based on the official 2017 PO-35 manual; non-exact approximations
   are marked in the UI. */
(function(root){
"use strict";
const clamp=(n,low,high)=>Math.max(low,Math.min(high,Number(n)||0));
const range=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const scales=[
 {name:"Chromatic",notes:range(16,i=>i)},
 {name:"Major",notes:[0,2,4,5,7,9,11,12,14,16,17,19,21,23,24,26]},
 {name:"Minor",notes:[0,2,3,5,7,8,10,12,14,15,17,19,20,22,24,26]},
 {name:"Major pentatonic",notes:[0,2,4,7,9,12,14,16,19,21,24,26,28,31,33,36]},
 {name:"Minor pentatonic",notes:[0,3,5,7,10,12,15,17,19,22,24,27,29,31,34,36]},
 {name:"Dorian",notes:[0,2,3,5,7,9,10,12,14,15,17,19,21,22,24,26]},
 {name:"Mixolydian",notes:[0,2,4,5,7,9,10,12,14,16,17,19,21,22,24,26]},
 {name:"Whole-tone",notes:[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]}
];
const empty16=()=>range(16,()=>false);
const clone=x=>JSON.parse(JSON.stringify(x));
function norm2(x,gen,validate) {
 return range(16,i=>range(16,j=>validate?.(x?.[i]?.[j])?x[i][j]:gen(i,j)));
}
const defaults=()=>({
 sound:1,pattern:1,voice:1,soundVoices:range(16,()=>1),effect:16,write:false,playing:false,bpm:120,volume:5,
 bank:0,params:[[50,50],[0,50]],swing:0,transpose:0,scale:0,
 patterns:range(16,empty16),notes:range(16,()=>range(16,()=>8)),
 sounds:range(16,()=>range(16,()=>1)),voices:range(16,()=>range(16,()=>0)),
 effects:range(16,()=>range(16,()=>0)),locks:range(16,()=>range(16,()=>null)),
 multipliers:range(16,()=>range(16,()=>1)),chain:[],sync:0,
 knobA:50,knobB:50,step:0,bar:0,chainIndex:0,lcdView:"pattern",lastPad:1
});
class PO35Model {
 constructor(source) {
  const d=defaults(),x=source||{};
  this.state={...d,...x,playing:false};
  const s=this.state;
  const bool=x.patterns||x.steps;
  s.patterns=norm2(bool,()=>false,v=>typeof v==="boolean");
  s.notes=norm2(x.notes,()=>8,v=>Number.isInteger(v)&&v>=1&&v<=16);
  s.sounds=norm2(x.sounds,(i,j)=>x.sound||1,v=>Number.isInteger(v)&&v>=1&&v<=16);
  s.voices=norm2(x.voices,()=>0,v=>Number.isInteger(v)&&v>=0&&v<=8);
  s.soundVoices=range(16,i=>Number.isInteger(x.soundVoices?.[i])&&x.soundVoices[i]>=1&&x.soundVoices[i]<=8?x.soundVoices[i]:(x.voice||1));
  s.effects=norm2(x.effects,()=>0,v=>Number.isInteger(v)&&v>=0&&v<=16);
  s.locks=norm2(x.locks,()=>null,v=>v===null||typeof v==="object");
  s.multipliers=norm2(x.multipliers,()=>1,v=>[1,2,4,8].includes(v));
  s.params=Array.isArray(x.params)&&x.params.length===2?clone(x.params):[[clamp(x.knobA??50,0,100),clamp(x.knobB??50,0,100)],[0,50]];
  s.bank=s.bank===1?1:0;
  s.volume=clamp(s.volume,0,16);s.bpm=clamp(s.bpm,60,240);
  s.sound=clamp(s.sound,1,16)|0;s.pattern=clamp(s.pattern,1,16)|0;
  s.voice=clamp(s.voice,1,8)|0;s.effect=(s.effect>=9&&s.effect<=16)?s.effect:16;
  s.scale=clamp(s.scale,0,scales.length-1)|0;s.transpose=clamp(s.transpose,-24,24)|0;
  s.swing=clamp(s.swing,0,65);
  s.chain=Array.isArray(s.chain)?s.chain.filter(n=>Number.isInteger(n)&&n>=1&&n<=16).slice(0,64):[];
  s.chainIndex=0;s.step=0;s.bar=0;s.write=Boolean(s.write);
  this.syncKnobs();
 }
 get s(){return this.state}
 syncKnobs(){const s=this.s;s.knobA=s.params[s.bank][0];s.knobB=s.params[s.bank][1]}
 bankToggle(){this.s.bank=1-this.s.bank;this.syncKnobs();this.s.lcdView="parameter";return this.s.bank}
 param(letter,value){const s=this.s,j=letter==="a"?0:1;s.params[s.bank][j]=clamp(value,0,100);this.syncKnobs();s.lcdView="parameter"}
 swing(value){this.s.swing=clamp(value,0,65);this.s.lcdView="tempo"}
 tempo(value){this.s.bpm=clamp(Math.round(value),60,240);this.s.lcdView="tempo"}
 presetTempo(){const list=[80,120,140],at=list.indexOf(this.s.bpm);this.tempo(list[(at+1)%3]);return this.s.bpm}
 transpose(value){this.s.transpose=clamp(Math.round(value),-24,24);this.s.lcdView="note"}
 scale(value){this.s.scale=((Math.round(value)%scales.length)+scales.length)%scales.length;this.s.lcdView="note"}
 setSound(n){this.s.sound=clamp(n,1,16)|0;this.s.voice=this.s.soundVoices[this.s.sound-1]||1;this.s.lcdView="sound"}
 setPattern(n){this.s.pattern=clamp(n,1,16)|0;this.s.lcdView="pattern"}
 setVolume(n){this.s.volume=clamp(n,0,16)|0;this.s.lcdView="volume"}
 voice(n,step){const s=this.s;s.voice=clamp(n,1,8)|0;s.soundVoices[s.sound-1]=s.voice;s.lcdView="voice";if(Number.isInteger(step)&&s.write)s.voices[s.pattern-1][step]=s.voice}
 fx(n,step){const s=this.s;s.effect=clamp(n,9,16)|0;s.lcdView="fx";if(Number.isInteger(step)&&s.write){if(s.effect===16)this.clearFX();else s.effects[s.pattern-1][step]=s.effect}}
 clearFX(pattern=this.s.pattern){this.s.effects[pattern-1].fill(0);this.s.effect=16}
 toggleStep(n){const s=this.s,i=n-1,p=s.pattern-1;s.patterns[p][i]=!s.patterns[p][i];if(s.patterns[p][i]){s.notes[p][i]=n;s.sounds[p][i]=s.sound} s.lcdView="pattern";return s.patterns[p][i]}
 recordStep(n,step){const s=this.s,p=s.pattern-1,i=step%16;s.patterns[p][i]=true;s.notes[p][i]=n;s.sounds[p][i]=s.sound;s.voices[p][i]=s.voice;s.lcdView="pattern"}
 multiplier(n){const s=this.s,p=s.pattern-1,i=n-1,current=s.multipliers[p][i],values=[1,2,4,8];s.multipliers[p][i]=values[(values.indexOf(current)+1)%values.length];return s.multipliers[p][i]}
 parameterLock(step){const s=this.s;s.locks[s.pattern-1][step%16]={bank:s.bank,a:s.knobA,b:s.knobB}}
 copyPattern(destination){const s=this.s,i=s.pattern-1,j=clamp(destination,1,16)-1;
  for(const key of ["patterns","notes","sounds","voices","effects","locks","multipliers"])s[key][j]=clone(s[key][i]);
 }
 clearPattern(pattern=this.s.pattern){const s=this.s,i=pattern-1;s.patterns[i]=empty16();s.notes[i]=range(16,()=>8);s.sounds[i]=range(16,()=>s.sound);s.voices[i]=range(16,()=>0);s.effects[i]=range(16,()=>0);s.locks[i]=range(16,()=>null);s.multipliers[i]=range(16,()=>1)}
 setChain(sequence){this.s.chain=sequence.filter(n=>Number.isInteger(n)&&n>=1&&n<=16).slice(0,64);this.s.chainIndex=0;if(this.s.chain.length)this.setPattern(this.s.chain[0]);}
 addChain(n){if(this.s.chain.length>=64)return false;this.s.chain.push(clamp(n,1,16)|0);return true}
 nextPatternInChain(){const s=this.s;if(s.chain.length){s.chainIndex=(s.chainIndex+1)%s.chain.length;s.pattern=s.chain[s.chainIndex]}return s.pattern}
 stepSnapshot(index,pattern=this.s.pattern){const s=this.s,i=index%16,p=pattern-1,lock=s.locks[p][i];
  return {active:s.patterns[p][i],note:s.notes[p][i],sound:s.sounds[p][i],
   voice:s.voices[p][i]||s.soundVoices[s.sounds[p][i]-1]||s.voice,effect:s.effects[p][i]||s.effect,
   bank:lock?.bank??s.bank,a:lock?.a??s.knobA,b:lock?.b??s.knobB,
   multiplier:s.multipliers[p][i],pattern,step:i,
   volume:s.volume,transpose:s.transpose,scaleOffsets:scales[s.scale].notes,bar:s.bar};
 }
 beatDuration(step,effect=16){
  const sec=60/this.s.bpm/4;
  if(effect===13)return step%3===0?sec*(4/3):sec*(5/6);
  const swing=this.s.swing/100;
  return step%2===0?sec*(1+swing):sec*(1-swing);
 }
 advance(){const s=this.s;s.step=(s.step+1)%16;if(s.step===0){s.bar++;this.nextPatternInChain()}return s.step}
 snapshot(){return {...clone(this.s),playing:false}}
}
PO35Model.SCALES=scales;PO35Model.VOICES=["neutral","autotune","retro","noise","robot","fifth","vocoder","synth"];
PO35Model.EFFECTS={9:"stutter sweep",10:"trance gate",11:"half rate",12:"16 bar build up",13:"6/8 quantize",14:"retrigger pattern",15:"reverse",16:"no effect"};
root.PO35Model=PO35Model;
})(window);
