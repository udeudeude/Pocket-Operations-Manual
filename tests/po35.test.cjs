"use strict";
/* Run: node tests/po35.test.cjs */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const from=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const w={};vm.runInNewContext(from("po35-model.js"),{window:w});
let count=0;
function test(name,fn){try{fn();count++;console.log("✓",name)}catch(e){console.error("✗",name);throw e}}
test("16 patterns of 16 steps",()=>{const m=new w.PO35Model();assert.equal(m.s.patterns.length,16);assert.equal(m.s.patterns[0].length,16)});
test("per-sound voice character",()=>{const m=new w.PO35Model();m.setSound(2);m.voice(5);m.setSound(3);assert.equal(m.s.voice,1);m.setSound(2);assert.equal(m.s.voice,5)});
test("step sound and note assignment",()=>{const m=new w.PO35Model();m.setSound(5);m.toggleStep(2);const x=m.stepSnapshot(1);assert.equal(x.sound,5);assert.equal(x.note,2)});
test("FX and voice automation",()=>{const m=new w.PO35Model();m.s.write=true;m.toggleStep(1);m.voice(6,0);m.fx(12,0);const x=m.stepSnapshot(0);assert.equal(x.voice,6);assert.equal(x.effect,12)});
test("independent knob banks",()=>{const m=new w.PO35Model();m.param("a",74);m.bankToggle();m.param("a",16);m.bankToggle();assert.equal(m.s.knobA,74);m.bankToggle();assert.equal(m.s.knobA,16)});
test("parameter locks",()=>{const m=new w.PO35Model();m.param("b",29);m.parameterLock(4);const x=m.stepSnapshot(4);assert.equal(x.b,29)});
test("pattern copy and clear",()=>{const m=new w.PO35Model();m.toggleStep(3);m.s.effects[0][2]=10;m.copyPattern(2);assert.equal(m.s.patterns[1][2],true);assert.equal(m.s.effects[1][2],10);m.clearPattern(2);assert.equal(m.s.patterns[1][2],false);assert.equal(m.s.effects[1][2],0)});
test("chaining supports repeated patterns",()=>{const m=new w.PO35Model();m.setChain([1,1,4]);assert.equal(m.s.chain.length,3);m.nextPatternInChain();assert.equal(m.s.pattern,1);m.nextPatternInChain();assert.equal(m.s.pattern,4);m.nextPatternInChain();assert.equal(m.s.pattern,1)});
test("step multipliers",()=>{const m=new w.PO35Model();assert.equal(m.multiplier(4),2);assert.equal(m.multiplier(4),4);assert.equal(m.multiplier(4),8);assert.equal(m.multiplier(4),1)});
test("swing and triplet timing",()=>{const m=new w.PO35Model();m.swing(35);assert.notEqual(m.beatDuration(0),m.beatDuration(1));assert.notEqual(m.beatDuration(0,13),m.beatDuration(1,13))});
test("legacy state migration",()=>{const m=new w.PO35Model({sound:2,voice:3,patterns:Array.from({length:16},()=>Array(16).fill(false))});assert.equal(m.s.soundVoices[1],3);assert.equal(m.s.notes[0][0],8)});
test("pattern snapshot roundtrip",()=>{const m=new w.PO35Model();m.setSound(7);m.voice(6);m.toggleStep(5);const n=new w.PO35Model(m.snapshot());assert.equal(n.s.soundVoices[6],6);assert.equal(n.s.patterns[0][4],true)});
const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const node=()=>({gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),delayTime:param(),playbackRate:param(),connect(){return this},disconnect(){},start(){},stop(){}});
class Buf{constructor(ch,len,sr){this.numberOfChannels=ch;this.length=len;this.sampleRate=sr;this.duration=len/sr;this.data=Array.from({length:ch},()=>new Float32Array(len))}getChannelData(i){return this.data[i]}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.state="running";this.destination=node()}resume(){}createBuffer(ch,len,sr){return new Buf(ch,len,sr)}createGain(){return node()}createBufferSource(){return {...node(),playbackRate:param()}}createDynamicsCompressor(){return node()}createBiquadFilter(){return node()}createOscillator(){return node()}createWaveShaper(){return node()}createDelay(){return node()}}
w.AudioContext=Ctx;vm.runInNewContext(from("po35-audio.js"),{window:w,Float32Array,Math,Array,WeakMap,Map});
const engine=new w.PO35SoundEngine();
test("different vocal practice slots contain different waveforms",()=>{const a=engine.demoVoice(1),b=engine.demoVoice(2);assert.notEqual(a.getChannelData(0)[31],b.getChannelData(0)[31])});
test("all eight voice approximations synthesize",()=>{for(let i=1;i<=8;i++){const r=engine.play({slot:2,note:5,voice:i,effect:16});assert(r.duration>.05);assert.equal(r.voice,w.PO35SoundEngine.VOICES[i-1])}});
test("all eight FX positions synthesize",()=>{for(let i=9;i<=16;i++){const r=engine.play({slot:16,note:3,voice:5,effect:i});assert(r.duration>.05);assert.equal(r.effect,w.PO35SoundEngine.EFFECTS[i])}});
test("Tonic-style drums bypass voice characters",()=>{const r=engine.play({slot:16,note:1,voice:8,effect:15});assert.equal(r.voice,"neutral");assert.equal(r.bufferKind,"tonic-drums")});
test("reverse sample retains duration",()=>{const a=engine.demoVoice(3),b=engine.reverse(a);assert.equal(a.length,b.length)});
test("live knob automation does not throw",()=>{engine.play({slot:1,note:5});engine.updateLive({bank:0,a:67,b:31});engine.updateLive({bank:1,a:18,b:80})});
console.log("PASS",count,"checks");
