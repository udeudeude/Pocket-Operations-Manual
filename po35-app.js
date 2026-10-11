/* PO-35 Speak interactive instrument / training app.
 * Hardware gestures follow the official guide where possible. For one-handed
 * touchscreens, a modifier can be latched by tapping SOUND/PATTERN/REC, or
 * double-tapping/long-pressing FX. Two simultaneous touches form real chords.
 */
(()=>{
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const get=id=>document.getElementById(id);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number(x)||0));
const names=window.PO35Model.VOICES,fxNames=window.PO35Model.EFFECTS,scales=window.PO35Model.SCALES;
const KEY="po35-v3";
let data=null;
try{data=JSON.parse(localStorage.getItem(KEY)||"null");if(!data)data=JSON.parse(localStorage.getItem("po35-v2")||"null")}catch{}
const model=new window.PO35Model(data),s=model.s;
const recordings=new Map(),audio=new window.PO35SoundEngine(slot=>recordings.get(slot));
let db=null,recorder=null,recStream=null,recordStopTimer=null,recordSlot=1;
let tab="learn",lessonIndex=0,armed=null,held=new Set(),used=new Set(),pressedPad=null;
let fxLastTap=0,fxLatchTimer=null,fxTapTimer=null,performanceFxUsed=false,patternGesture=[],patternHeld=false;
let sequencerTimer=null,nextAudioTime=0,stepPointer=0,lastStepPosition=0,refreshTime=0;
let lessonCompleted=false,undo=null,latestEvent="";
const lessons=[
 ["First sound","Tap pad 1. Slots 1–15 start with synthetic practice syllables until you record over them.","pad:1","pad-1"],
 ["Choose a slot","Tap SOUND, then 2. On the physical PO-35 you hold SOUND while pressing 2.","sound:2","sound"],
 ["Record your voice","Open STUDIO and record into slot 2. This uses the same eight-second limit as the PO-35.","recorded","record"],
 ["Select a voice","Double-tap FX, then pad 5 to choose ROBOT. Holding FX + 5 works too.","voice:5","fx"],
 ["Change parameters","Tap FX once to switch between pitch/formant and start/speed banks.","bank","fx"],
 ["Turn a knob","Drag knob A up or down to alter the sound. Use PLAY mode to audition afterward.","knob:a","knob-a"],
 ["Pattern writing","Tap WRITE to enable 16-step pattern entry.","write:on","write"],
 ["Write a note","Tap pad 1 in WRITE mode. Step 1 should light up.","step:1:on","pad-1"],
 ["Add a second step","Tap pad 5 to add another note on step 5.","step:5:on","pad-5"],
 ["Play the pattern","Tap PLAY to start the sequencer.","play:on","play"],
 ["Stop the pattern","Tap PLAY again to stop.","play:off","play"],
 ["Change tempo","Tap BPM to select another preset tempo.","tempo","bpm"],
 ["Change volume","Hold BPM and press pad 5, or hold BPM to use the one-handed gesture.","volume:5","bpm"],
 ["Performance effect","Double-tap FX and press pad 9 for STUTTER SWEEP. The audio will actually stutter.","effect:9","fx"],
 ["Clear the effect","Double-tap FX and press 16 to select NO EFFECT.","effect:16","fx"],
 ["Change pattern","Tap PATTERN, then 2, to switch patterns.","pattern:2","pattern"],
 ["Chain patterns","Use PLAY → Edit chain, or hold PATTERN and tap multiple pads in sequence.","chain","pattern"],
 ["Swing","Hold BPM and turn knob A, or use the Swing slider in PLAY.","swing","bpm"],
 ["Transpose","Hold PATTERN and turn knob A, or use the Transpose control in PLAY.","transpose","pattern"],
 ["Parameter lock","During playback, hold WRITE and turn a knob to record a per-step parameter lock.","lock","write"],
 ["Explore the instrument","Try all eight voices, effects 9–15, and slot 16's synthetic drum sounds.","explore",null]
];
const reference=[
 ["SOUND + 1–16","Select vocal sound 1–15 or the single-channel PO-32-style drum voice on slot 16."],
 ["REC + 1–15","Record microphone input while held, maximum 8 seconds. On iPhone, tap REC then a pad to record until stopped or timed out."],
 ["WRITE","Toggle pattern-entry mode. During playback, hold WRITE + pad to punch notes into the moving sequence."],
 ["PLAY","Start/stop the 16-step sequencer."],
 ["PATTERN + pad","Select pattern; hold PATTERN and enter several pads to build a repeating chain of up to 64 patterns."],
 ["FX tap","Switch the two knob banks: pitch/formant and sample start/speed."],
 ["FX + 1–8","Voice algorithms: neutral, autotune, retro, noise, robot, fifth, vocoder, synth."],
 ["FX + 9","Stutter sweep: short repetitions with upward filter sweep."],
 ["FX + 10","Trance gate: rhythmic volume chopping."],
 ["FX + 11","Half rate: slowed playback."],
 ["FX + 12","16-bar buildup: progressively opening filter and rising level."],
 ["FX + 13","6/8 quantize: approximate compound-meter accent and timing."],
 ["FX + 14","Retrigger pattern: restart the active pattern."],
 ["FX + 15","Reverse: play a reversed sample."],
 ["FX + 16","No effect. Clears recorded effect automation while WRITE is on."],
 ["BPM tap","Cycle 80 / 120 / 140 BPM presets."],
 ["BPM + pads 1–16","Master volume levels. Default volume is deliberately conservative."],
 ["BPM + knob A","Swing. BPM + knob B: fine tempo, 60–240 BPM."],
 ["PATTERN + knob A/B","Transpose / choose scale."],
 ["WRITE + knob","During playback, record the parameter values for the current step."],
 ["WRITE + PATTERN + pad","Copy the current pattern to the indicated destination."],
 ["REC + PATTERN","Clear the active pattern."],
 ["Pad held + BPM (μ)","Cycle a step multiplier through 1, 2, 4 and 8 (educational approximation)."],
 ["SOUND + BPM","Battery indicator. A web app cannot measure the physical PO-35 battery."],
 ["REC + BPM","Cycle sync-mode display. Physical analogue clock synchronization is not available."],
 ["WRITE + SOUND / REC + SOUND","The real device transmits/receives audio data backups; this app's JSON export is not hardware-compatible."],
 ["Mobile gestures","Tap SOUND/PATTERN to arm the next pad; double-tap FX to arm effects. Two-finger holds work, and long-press FX also arms. Drag knobs vertically."]
];
const notify=text=>{get("status").textContent=text};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(model.snapshot()))}catch(e){notify("Local storage full: export a backup of your patterns.")}}
function emit(ev){latestEvent=ev;if(tab==="learn"&&!lessonCompleted){const lesson=lessons[lessonIndex];if(lesson[2]===ev||(lesson[2]==="explore"&&ev.startsWith("voice:"))){lessonCompleted=true;get("mini-status").textContent="✓ Correct";get("lesson-status").textContent="✓ Correct. Continue whenever ready.";}}render()}
function fxLabel(n){return n===16?"No effect":fxNames[n]||"No effect"}
function viewInstrument(){
 get("screen-state").textContent=(s.write?"WRITE":"PLAY")+" · S"+String(s.sound).padStart(2,"0");
 get("screen-tempo").textContent=s.bpm+" BPM";
 get("screen-main").textContent="PATTERN "+String(s.pattern).padStart(2,"0");
 get("screen-voice").textContent=names[s.voice-1].toUpperCase();
 get("screen-bank").textContent=s.bank?"START / SPEED":"PITCH / FORMANT";
 get("voice-select").value=String(s.voice);
 get("volume").value=String(s.volume);
 get("tempo").value=String(s.bpm);get("tempo-readout").textContent=s.bpm;
 get("pattern-select").value=String(s.pattern);get("sound-select").value=String(s.sound);
 get("knob-a").value=String(s.knobA);get("knob-b").value=String(s.knobB);
 if(get("swing")){get("swing").value=String(s.swing);get("swing-readout").textContent=Math.round(s.swing)+"%"}
 if(get("transpose")){get("transpose").value=String(s.transpose);get("transpose-readout").textContent=(s.transpose>0?"+":"")+s.transpose}
 if(get("scale-select"))get("scale-select").value=String(s.scale);
 if(get("fx-select"))get("fx-select").value=String(s.effect);
 if(get("chain-display"))get("chain-display").textContent=s.chain.length?s.chain.join(" → ")+"  ↺":"No chain; repeats pattern "+s.pattern;
 if(get("bank-indicator"))get("bank-indicator").textContent=s.bank?"START / SPEED":"PITCH / FORMANT";
 $$(".instrument-hit").forEach(el=>{
  const k=el.dataset.control;
  el.classList.toggle("active",k===armed||held.has(k)||k==="write"&&s.write||k==="play"&&s.playing);
 });
 $$(".instrument-led").forEach(el=>{
  const i=+el.dataset.step,active=s.patterns[s.pattern-1][i];
  el.classList.toggle("on",active);el.classList.toggle("current",s.playing&&s.step===i);
 });
 window.PO35LCD?.render(s,held.has("fx")?"fx":armed,{recording:!!recorder,slot:recordSlot});
}
function render(){viewInstrument()}
function showLesson(){
 const l=lessons[lessonIndex];lessonCompleted=false;
 get("mini-title").textContent="LESSON "+(lessonIndex+1)+"/"+lessons.length+" · "+l[0];
 get("mini-body").textContent=l[1];get("mini-status").textContent="";
 get("lesson-count").textContent="LESSON "+(lessonIndex+1)+" OF "+lessons.length;
 get("lesson-title").textContent=l[0];get("lesson-body").textContent=l[1];
 get("lesson-progress").style.width=(100*(lessonIndex+1)/lessons.length)+"%";
 get("lesson-status").textContent="Waiting for the correct control…";
 $$(".instrument-hit").forEach(x=>x.classList.toggle("highlight",x.dataset.control===l[3]));
 setTab("learn");
}
function setTab(name){
 tab=name;document.body.dataset.tab=name;
 get("lesson-compact").classList.toggle("hidden",name!=="learn");
 $$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 for(const key of ["learn","play","studio","reference"])get(key+"-panel").classList.toggle("hidden",key!==name);
 if(name!=="reference")window.PO35LCD?.setTest(null);
 render();
}
function setSound(n){model.setSound(n);notify("SOUND "+n+(n===16?" · Tonic-style drum voice":" · recorded or synthetic practice voice"));emit("sound:"+n);persist()}
function setPattern(n){model.setPattern(n);notify("PATTERN "+n);emit("pattern:"+n);persist()}
function selectVoice(n){
 model.voice(n,s.write&&s.playing?s.step:undefined);
 notify("VOICE "+n+" · "+names[n-1].toUpperCase()+(s.write&&s.playing?" · step automation recorded":""));
 emit("voice:"+n);persist();
}
function selectEffect(n){
 if(n===16&&s.write){clearEffects();return}
 if(n===14&&s.playing){stepPointer=0;nextAudioTime=audio.context().currentTime+.035;s.step=0;notify("RETRIGGER · pattern restarted")}
 else notify("FX "+n+" · "+fxLabel(n));
 model.fx(n,s.write&&s.playing?s.step:undefined);
 emit("effect:"+n);persist();
}
function setVolume(n){model.setVolume(n);notify("VOLUME "+n+"/16");emit("volume:"+n);persist()}
function toggleWrite(){s.write=!s.write;s.lcdView="pattern";notify(s.write?"WRITE · step entry enabled":"PLAY · live pad performance");emit("write:"+(s.write?"on":"off"));persist()}
function toggleBank(){const bank=model.bankToggle();notify("FX knob bank: "+(bank?"START / SPEED":"PITCH / FORMANT"));emit("bank");persist()}
function clearPattern(){model.clearPattern();notify("Pattern "+s.pattern+" cleared.");emit("clear");persist();render()}
function copyPattern(n){model.copyPattern(n);notify("Copied pattern "+s.pattern+" to "+n+".");emit("copy");persist();render()}
function setChain(nums){model.setChain(nums);notify("Pattern chain: "+(s.chain.join(" → ")||"off"));emit("chain");persist()}
function clearEffects(){model.clearFX();notify("Recorded effects cleared for pattern "+s.pattern);emit("effect:16");persist()}
function changeKnob(letter,value){
 if(held.has("bpm")){
   if(letter==="a"){model.swing(value*.65);notify("SWING "+Math.round(s.swing)+"%");emit("swing")}
   else{model.tempo(60+value*1.8);notify("FINE TEMPO "+s.bpm+" BPM");emit("tempo")}
 }else if(held.has("pattern")){
   if(letter==="a"){model.transpose(Math.round(value*.36-18));notify("TRANSPOSE "+s.transpose+" semitones");emit("transpose")}
   else{model.scale(Math.round(value/100*(scales.length-1)));notify("SCALE "+scales[s.scale].name);emit("scale")}
 }else{
   model.param(letter,value);
   let label=s.bank?(letter==="a"?"START":"SPEED"):(letter==="a"?"PITCH":"FORMANT");
   notify(label+" "+Math.round(value)+"%");
   emit("knob:"+letter);
   if(s.playing&&held.has("write")){model.parameterLock(s.step);emit("lock");notify(label+" · parameter lock recorded on step "+(s.step+1))}
 }
 persist();render();
}
function makeNote(note,when,step){
 const state=step||{sound:s.sound,voice:s.voice,effect:s.effect,bank:s.bank,a:s.knobA,b:s.knobB,
   volume:s.volume,transpose:s.transpose,scaleOffsets:scales[s.scale].notes,bar:s.bar,step:s.step};
 return audio.play({slot:state.sound,note,voice:state.voice,effect:state.effect,
  bank:state.bank,a:state.a,b:state.b,volume:state.volume,
  transpose:state.transpose,scaleOffsets:state.scaleOffsets,bar:state.bar,step:state.step,when});
}
function padSolo(n){
 if(s.write&&!s.playing){
  undo={pattern:s.pattern,index:n-1,old:s.patterns[s.pattern-1][n-1],
        oldNote:s.notes[s.pattern-1][n-1],oldSound:s.sounds[s.pattern-1][n-1]};
  const enabled=model.toggleStep(n);
  notify("STEP "+n+(enabled?" ON":" OFF")+" · sound "+s.sound);
  emit("step:"+n+":"+(enabled?"on":"off"));
 }else if(s.playing&&s.write){
  model.recordStep(n,s.step);makeNote(n);notify("LIVE PUNCH · note "+n+" at step "+(s.step+1));emit("punch");
 }else{
  s.lastPad=n;s.lcdView="note";makeNote(n);notify("PAD "+n+" · "+names[s.voice-1]+" · "+fxLabel(s.effect));emit("pad:"+n);
 }
 persist();render();
}
function performChord(mod,n,physical=false){
 used.add(mod);
 if(mod==="sound"){setSound(n);return}
 if(mod==="pattern"){
  if(physical){
   patternGesture.push(n);model.setPattern(n);
   if(patternGesture.length>=2){model.setChain(patternGesture);notify("CHAIN: "+patternGesture.join(" → "));emit("chain")}
   else {notify("PATTERN "+n+" selected; keep holding PATTERN and tap more pads to chain.");emit("pattern:"+n)}
  }else setPattern(n);
  persist();render();return;
 }
 if(mod==="bpm"){setVolume(n);return}
 if(mod==="fx"){
  if(n<=8)selectVoice(n);
  else {selectEffect(n);if(physical&&n>=9&&n<=15&&!s.write)performanceFxUsed=true;}
  return;
 }
 if(mod==="record"){
  if(n===16){notify("Sound 16 is the Tonic drum voice; cannot record over this slot.");return}
  startRecording(n,!physical);
  return;
 }
 if(mod==="write"){if(s.playing){model.recordStep(n,s.step);makeNote(n);notify("WRITE + "+n+" · quantized live note");emit("punch");persist()}return}
}
function handlePad(n,physical=true){
 audio.context();pressedPad=n;
 if(held.has("record")&&held.has("pattern")){used.add("record");used.add("pattern");clearPattern();return}
 if(held.has("write")&&held.has("pattern")){used.add("write");used.add("pattern");copyPattern(n);return}
 if(held.has("record"))return performChord("record",n,true);
 for(const key of ["sound","pattern","fx","bpm","write"])if(held.has(key)){performChord(key,n,true);return}
 if(armed){let k=armed;armed=null;performChord(k,n,false);render();return}
 padSolo(n);
}
function modifierCombo(k){
 if(k==="pattern"&&held.has("record")||k==="record"&&held.has("pattern")){used.add("pattern");used.add("record");clearPattern();return true}
 if(k==="bpm"&&held.has("record")||k==="record"&&held.has("bpm")){
  used.add("bpm");used.add("record");s.sync=(s.sync+1)%6;notify("SYNC SY"+s.sync+" · display only; hardware sync unavailable.");persist();render();return true
 }
 if(k==="sound"&&held.has("bpm")||k==="bpm"&&held.has("sound")){
  used.add("sound");used.add("bpm");notify("BATTERY: web simulator cannot read the PO-35 battery.");return true
 }
 if(k==="sound"&&held.has("write")||k==="write"&&held.has("sound")){
  used.add("sound");used.add("write");notify("DATA TRANSMIT: real PO-35 uses stereo audio backup. Use STUDIO → Export for app patterns.");return true
 }
 if(k==="sound"&&held.has("record")||k==="record"&&held.has("sound")){
  used.add("sound");used.add("record");notify("DATA RECEIVE: hardware audio decoding not implemented.");return true
 }
 return false;
}
function buttonDown(k,e){
 audio.context();
 if(k==="m"){
  if(pressedPad){const x=model.multiplier(pressedPad);notify("STEP "+pressedPad+" MULTIPLIER ×"+x);emit("multiplier");persist()}
  else notify("μ multiplier: hold a numbered step, then press BPM/μ.");
  render();return;
 }
 if(k==="bpm"&&pressedPad){
  const x=model.multiplier(pressedPad);notify("STEP "+pressedPad+" MULTIPLIER ×"+x);emit("multiplier");persist();used.add("bpm");render();return;
 }
 held.add(k);
 if(k==="pattern"){patternGesture=[];patternHeld=true}
 modifierCombo(k);
 if(k==="fx"){
  clearTimeout(fxLatchTimer);
  fxLatchTimer=setTimeout(()=>{if(held.has("fx")&&!used.has("fx")){armed="fx";notify("FX armed · select pad 1–16.");render()}},550);
 }
 render();
}
function buttonUp(k,e){
 const wasUsed=used.has(k);held.delete(k);used.delete(k);
 if(k==="fx")clearTimeout(fxLatchTimer);
 if(k==="pattern"){
   if(patternGesture.length===1)s.chain=[];
   patternGesture=[];patternHeld=false;
 }
 if(k==="record"&&recorder&&recordMode==="held")stopRecording();
 if(wasUsed){
   if(k==="fx"&&performanceFxUsed){performanceFxUsed=false;if(!s.write){s.effect=16;s.lcdView="fx";notify("PERFORMANCE FX released; effect off.")}}
   persist();render();return
 }
 if(k==="fx"){
   const now=Date.now();
   if(armed==="fx"&&!held.has("fx")){fxLastTap=0;clearTimeout(fxTapTimer);fxTapTimer=null;notify("FX armed · choose voice 1–8 or effect 9–16.");render();return}
   if(now-fxLastTap<450){clearTimeout(fxTapTimer);fxTapTimer=null;armed="fx";fxLastTap=0;notify("FX armed · choose a pad.");}
   else{
     fxLastTap=now;
     clearTimeout(fxTapTimer);
     fxTapTimer=setTimeout(()=>{fxTapTimer=null;fxLastTap=0;if(armed!=="fx"&&!held.has("fx"))toggleBank()},350);
   }
 }else if(k==="bpm"){
   model.presetTempo();notify("TEMPO "+s.bpm+" BPM");emit("tempo");persist();
 }else if(k==="play")transport();
 else if(k==="write")toggleWrite();
 else if(k==="record"){if(recorder){stopRecording()}else{armed="record";setTab("studio");notify("REC armed · tap pad 1–15 to record, or use STUDIO.");}}
 else if(k==="sound"||k==="pattern"){armed=k;notify(k.toUpperCase()+" armed · choose pad 1–16.")}
 render();
}
function attachControl(b,k){
 let down=false;
 b.addEventListener("pointerdown",e=>{
  if(e.button!=null&&e.button!==0)return;
  down=true;
  try{b.setPointerCapture(e.pointerId)}catch{}
  if(k.startsWith("pad-")){const n=+k.slice(4);pressedPad=n;handlePad(n,true)}
  else buttonDown(k,e);
  e.preventDefault();
 });
 b.addEventListener("pointerup",e=>{
  if(!down)return;down=false;
  if(k.startsWith("pad-")){if(recordMode==="held"&&recorder)stopRecording();pressedPad=null}
  else buttonUp(k,e);
  e.preventDefault();
 });
 b.addEventListener("pointercancel",()=>{down=false;if(k.startsWith("pad-")){pressedPad=null;if(recordMode==="held")stopRecording()}else{held.delete(k);render()}});
 b.addEventListener("click",e=>{if(e.detail===0){if(k.startsWith("pad-"))handlePad(+k.slice(4),false);else{buttonDown(k,e);buttonUp(k,e)}}});
}
function buildHotspots(){
 const host=get("instrument-hit-overlay"),x0=20,y0=185,W=490,H=848;
 // All controls use original SVG source coordinates in viewBox 20 185 490 848.
 const button=(key,title,x,y,width=16,height=8)=>{
  const b=document.createElement("button");b.type="button";b.className="instrument-hit";
  b.dataset.control=key;b.title=title;b.setAttribute("aria-label",title);
  Object.assign(b.style,{left:x+"%",top:y+"%",width:width+"%",height:height+"%"});
  host.append(b);attachControl(b,key);return b;
 };
 // Five-column physical layout in the 490-unit viewBox (91,179,265,352,439):
 const xvals=[(91-20)/490*100,(179-20)/490*100,(265-20)/490*100,(352-20)/490*100,(439-20)/490*100];
 const yvals=[(551-185)/848*100,(652-185)/848*100,(751-185)/848*100,(851-185)/848*100,(950-185)/848*100];
 for(const [key,x,y] of [["sound",0,0],["pattern",1,0],["bpm",2,0],["record",4,1],["fx",4,2],["play",4,3],["write",4,4]])
   button(key,key.toUpperCase(),xvals[x],yvals[y],15.5,8.7);
 for(let n=1;n<=16;n++){const col=(n-1)%4,row=1+Math.floor((n-1)/4);
   button("pad-"+n,"Pad "+n,xvals[col],yvals[row],15.5,8.7);}
 // μ is not an extra physical button: the BPM button doubles as multiplier,
 // with the numbered step held down first.
 for(const [key,i] of [["a",3],["b",4]]){
   const b=document.createElement("button");b.type="button";b.className="instrument-hit knob-hit";
   b.dataset.control="knob-"+key;b.title="Knob "+key.toUpperCase()+": drag vertically";
   b.setAttribute("aria-label",b.title);Object.assign(b.style,{left:xvals[i]+"%",top:yvals[0]+"%",width:"16%",height:"9.6%"});
   host.append(b);let dragging=false,y0=0,starting=50,moved=false;
   b.addEventListener("pointerdown",e=>{
     dragging=true;moved=false;y0=e.clientY;
     starting=held.has("bpm")?(key==="a"?s.swing/65*100:(s.bpm-60)/180*100):held.has("pattern")?(key==="a"?(s.transpose+18)/36*100:s.scale/(scales.length-1)*100):(key==="a"?s.knobA:s.knobB);
     try{b.setPointerCapture(e.pointerId)}catch{}
     e.preventDefault();
   });
   b.addEventListener("pointermove",e=>{if(!dragging)return;const delta=(y0-e.clientY)*.75;if(Math.abs(delta)>2)moved=true;if(moved)changeKnob(key,clamp(starting+delta,0,100));e.preventDefault()});
   b.addEventListener("pointerup",e=>{if(dragging&&!moved)changeKnob(key,clamp(starting+5,0,100));dragging=false;e.preventDefault()});
   b.addEventListener("pointercancel",()=>{dragging=false});
   b.addEventListener("keydown",e=>{if(["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"].includes(e.key)){const v=key==="a"?s.knobA:s.knobB;changeKnob(key,v+(e.key==="ArrowUp"||e.key==="ArrowRight"?5:-5));e.preventDefault()}});
 }
}
function schedule(){
 if(!s.playing)return;const c=audio.context();
 let iterations=0;
 while(nextAudioTime<c.currentTime+.16&&iterations++<24){
   const snap=model.stepSnapshot(stepPointer);
   if(snap.active){
     const dt=model.beatDuration(stepPointer,snap.effect);
     for(let m=0;m<snap.multiplier;m++)
       makeNote(snap.note,nextAudioTime+m*dt/snap.multiplier,snap);
   }
   s.step=stepPointer;
   const duration=model.beatDuration(stepPointer,snap.effect);
   nextAudioTime+=duration;stepPointer++;
   if(stepPointer===16){stepPointer=0;s.bar++;model.nextPatternInChain()}
 }
 if(Date.now()-refreshTime>45){render();refreshTime=Date.now()}
 sequencerTimer=setTimeout(schedule,25);
}
function transport(){
 audio.context();
 if(s.playing){stopSequencer();notify("PLAYBACK STOPPED");emit("play:off")}
 else{s.playing=true;s.lcdView="pattern";stepPointer=0;s.step=0;s.bar=0;s.chainIndex=0;
   if(s.chain.length)s.pattern=s.chain[0];
   nextAudioTime=audio.context().currentTime+.07;schedule();notify("PLAYBACK STARTED · "+s.bpm+" BPM");emit("play:on")}
 persist();render();
}
function stopSequencer(){s.playing=false;clearTimeout(sequencerTimer);sequencerTimer=null;render()}
let recordMode="auto";
function recordingStatus(str){get("record-status").textContent=str}
async function openDatabase(){
 if(!("indexedDB"in window))return;
 return await new Promise((resolve,reject)=>{
   const r=indexedDB.open("po35-audio-v1",1);
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("samples"))r.result.createObjectStore("samples")};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
async function loadRecordings(){
 try{
  db=await openDatabase();if(!db)return;
  const r=db.transaction("samples","readonly").objectStore("samples").openCursor();
  r.onsuccess=e=>{const cursor=e.target.result;if(!cursor)return;
    const key=+cursor.key,blob=cursor.value;cursor.continue();
    blob.arrayBuffer().then(b=>audio.context().decodeAudioData(b)).then(decoded=>recordings.set(key,decoded)).catch(()=>{});
  };
 }catch(e){recordingStatus("Audio storage unavailable: "+e.message)}
}
function saveRecording(slot,blob){
 if(!db)return;
 try{db.transaction("samples","readwrite").objectStore("samples").put(blob,slot)}catch(e){recordingStatus("Recorded, but permanent storage failed: "+e.message)}
}
async function startRecording(slot,automatic=true){
 if(slot===16){notify("Slot 16 is the drum voice, not a microphone slot.");return}
 if(recorder){notify("Already recording. Stop the current capture first.");return}
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){recordingStatus("Microphone recording requires HTTPS, permission, and a supported browser.");return}
 recordSlot=slot;recordMode=automatic?"auto":"held";setTab("studio");
 try{
  recStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const prefs=["audio/mp4","audio/webm;codecs=opus","audio/webm"];
  const mime=prefs.find(t=>typeof MediaRecorder.isTypeSupported==="function"&&MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(recStream,mime?{mimeType:mime}:{});
  const chunks=[];const active=recorder;
  active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  active.onstop=async()=>{
   clearTimeout(recordStopTimer);recordStopTimer=null;
   recStream?.getTracks().forEach(t=>t.stop());recStream=null;recorder=null;
   const blob=new Blob(chunks,{type:active.mimeType||"audio/mp4"});
   try{
    const buff=await audio.context().decodeAudioData(await blob.arrayBuffer());
    recordings.set(slot,buff);saveRecording(slot,blob);model.setSound(slot);
    recordingStatus("Slot "+slot+": "+buff.duration.toFixed(2)+"s recording saved. Tap a pad to audition.");
    notify("RECORDED SOUND "+slot);emit("recorded");persist();
   }catch(e){recordingStatus("Recording captured but could not be decoded by this browser: "+e.message)}
   render();
  };
  active.start();recordingStatus("RECORDING slot "+slot+" (up to 8 seconds). "+(automatic?"Tap STOP to finish.":"Release pad or REC to finish."));
  notify("RECORDING SOUND "+slot);render();
  recordStopTimer=setTimeout(stopRecording,8000);
 }catch(e){recStream?.getTracks().forEach(t=>t.stop());recStream=null;recordingStatus("Microphone unavailable: "+e.message)}
}
function stopRecording(){clearTimeout(recordStopTimer);recordStopTimer=null;if(recorder&&recorder.state==="recording")recorder.stop();recordMode="auto";render()}
function setControlData(){
 const option=(value,label)=>{const o=document.createElement("option");o.value=value;o.textContent=label;return o};
 for(let n=1;n<=16;n++){
  get("pattern-select").append(option(n,"Pattern "+n));
  get("sound-select").append(option(n,n===16?"16 · Tonic drums":"Sound "+n));
  if(n<=15)get("record-slot").append(option(n,"Slot "+n));
 }
 names.forEach((n,i)=>get("voice-select").append(option(i+1,(i+1)+" · "+n)));
 scales.forEach((x,i)=>get("scale-select")?.append(option(i,x.name)));
 for(let n=9;n<=16;n++)get("fx-select")?.append(option(n,n+" · "+fxLabel(n)));
 reference.forEach(([title,text])=>{
  const d=document.createElement("div"),strong=document.createElement("strong"),span=document.createElement("span");
  strong.textContent=title;span.textContent=text;d.append(strong,span);get("refgrid").append(d);
 });
}
function listeners(){
 $$("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
 get("mini-prev").onclick=get("lesson-prev").onclick=()=>{lessonIndex=Math.max(0,lessonIndex-1);showLesson()};
 get("mini-next").onclick=get("lesson-next").onclick=()=>{lessonIndex=Math.min(lessons.length-1,lessonIndex+1);showLesson()};
 get("mini-hint").onclick=get("lesson-hint").onclick=()=>notify("HINT: "+lessons[lessonIndex][1]);
 get("panic").onclick=()=>{stopSequencer();notify("STOPPED.")};
 get("undo").onclick=()=>{
  if(!undo){notify("Nothing to undo.");return}
  const p=undo.pattern-1,i=undo.index;s.patterns[p][i]=undo.old;s.notes[p][i]=undo.oldNote;s.sounds[p][i]=undo.oldSound;
  undo=null;persist();render();notify("Step edit undone.")
 };
 get("help-control").onclick=()=>setTab("reference");
 const bind=(id,fn)=>{const e=get(id);if(e)e.onchange=ev=>fn(ev.target.value)};
 bind("pattern-select",x=>setPattern(+x));bind("sound-select",x=>setSound(+x));
 bind("voice-select",x=>selectVoice(+x));bind("fx-select",x=>selectEffect(+x));
 bind("scale-select",x=>{model.scale(+x);notify("SCALE: "+scales[s.scale].name);emit("scale");persist()});
 const slider=(id,fn)=>{const e=get(id);if(e)e.oninput=ev=>fn(+ev.target.value)};
 slider("volume",x=>setVolume(x));slider("tempo",x=>{model.tempo(x);notify("TEMPO "+s.bpm);emit("tempo");persist()});
 slider("swing",x=>{model.swing(x);notify("SWING "+Math.round(s.swing)+"%");emit("swing");persist()});
 slider("transpose",x=>{model.transpose(x);notify("TRANSPOSE "+s.transpose);emit("transpose");persist()});
 get("clear-pattern").onclick=clearPattern;
 get("copy-pattern").onclick=()=>{
   const answer=prompt("Copy pattern "+s.pattern+" to which slot (1–16)?");
   if(answer===null)return;const n=Number(answer);
   if(!Number.isInteger(n)||n<1||n>16){notify("Choose a pattern from 1 to 16.");return}
   copyPattern(n)
 };
 get("random-pattern").onclick=()=>{
   const p=s.pattern-1;
   for(let i=0;i<16;i++){s.patterns[p][i]=i===0||Math.random()<.28;if(s.patterns[p][i]){s.notes[p][i]=i+1;s.sounds[p][i]=s.sound}}
   notify("Randomized pattern "+s.pattern);persist();render();
 };
 if(get("chain-edit"))get("chain-edit").onclick=()=>{
   const answer=prompt("Enter pattern numbers (1–16), separated by commas. Repeats allowed; max 64.",s.chain.join(", "));
   if(answer===null)return;
   const entries=answer.split(/[,;\s]+/).filter(Boolean).map(Number);
   if(entries.some(n=>!Number.isInteger(n)||n<1||n>16)||entries.length>64){notify("Chain must contain up to 64 entries, each 1–16.");return}
   setChain(entries);
 };
 if(get("chain-clear"))get("chain-clear").onclick=()=>setChain([]);
 if(get("fx-clear"))get("fx-clear").onclick=clearEffects;
 get("record").onclick=()=>startRecording(+get("record-slot").value,true);
 get("stop-record").onclick=stopRecording;
 get("play-record").onclick=()=>{const slot=+get("record-slot").value;if(!recordings.has(slot)){recordingStatus("No recorded voice in slot "+slot+". Press Record first.");return}
   const old=s.sound;s.sound=slot;makeNote(8);s.sound=old;render()
 };
 get("delete-record").onclick=()=>{
   const slot=+get("record-slot").value;recordings.delete(slot);
   if(db)db.transaction("samples","readwrite").objectStore("samples").delete(slot);
   recordingStatus("Slot "+slot+" deleted; synthetic practice voice remains available.")
 };
 get("export").onclick=()=>{
   const blob=new Blob([JSON.stringify({format:"po35-practice-v3",state:model.snapshot()},null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="po35-patterns-v3.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 };
 get("import").onclick=()=>get("import-file").click();
 get("import-file").onchange=async e=>{
   try{
    const blob=e.target.files?.[0];if(!blob)return;
    const val=JSON.parse(await blob.text());if(!["po35-practice-v2","po35-practice-v3"].includes(val.format))throw Error("Unrecognized pattern format");
    stopSequencer();const copy=new window.PO35Model(val.state).snapshot();
    Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,copy);
    persist();notify("Imported patterns and automation.");render();
   }catch(e){notify("Import failed: "+e.message)}
   e.target.value="";
 };
 for(const [id,mode] of [["lcd-test-normal",null],["lcd-test-all","all"],["lcd-test-off","off"]]){
  get(id).onclick=()=>{window.PO35LCD?.setTest(mode);get("lcd-test-state").textContent=mode===null?"Normal":mode==="all"?"All segments on":"All segments off (1.8% ghost)"}
 }
 get("lcd-test-next").onclick=()=>{const n=window.PO35LCD?.nextTestSegment();get("lcd-test-state").textContent="Segment "+(n+1)+"/"+(window.PO35LCD?.diagnostics().individuallyAddressableParts||0)};
 document.addEventListener("keydown",e=>{
  if(e.repeat||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
  if(e.code==="Space"){e.preventDefault();transport();return}
  if(e.key.toLowerCase()==="w"){toggleWrite();return}
  const mapping="12345678qwertyui",n=mapping.indexOf(e.key.toLowerCase());
  if(n>=0){handlePad(n+1,false);e.preventDefault()}
 });
 window.addEventListener("pagehide",()=>{stopSequencer();if(recorder)stopRecording()});
}
function boot(){
 setControlData();buildHotspots();listeners();
 get("version").textContent="v0.7";
 showLesson();render();loadRecordings();
 window.PO35LCD?.mount().then(render).catch(e=>notify("LCD unavailable: "+e.message));
 if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
 notify("Ready · synthetic practice voices in slots 1–15; record your own in STUDIO. Sound 16 is drum synthesis.");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.PO35App={model,audio,performPad:handlePad,transport,stop:stopSequencer,render,selectVoice,selectEffect,changeKnob,diagnostics:()=>({state:model.snapshot(),recordings:recordings.size,armed,held:[...held],tab,playing:s.playing})};
})();
