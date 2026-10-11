/* PO-35 Speak audio approximation. All synthesis and FX use native Web Audio.
   The original instrument's proprietary voice algorithms and microtonic tone
   transfer are NOT claimed to be reproduced exactly. */
(function(root){
"use strict";
const VOICES=["neutral","autotune","retro","noise","robot","fifth","vocoder","synth"];
const EFFECTS={9:"stutter sweep",10:"trance gate",11:"half rate",12:"16 bar build up",13:"6/8 quantize",14:"retrigger pattern",15:"reverse",16:"no effect"};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
class PO35SoundEngine {
  constructor(getSample){this.getSample=getSample||(()=>null);this.audioContext=null;this.master=null;this.demo=new Map();this.reverseCache=new WeakMap();this.drumCache=new Map();this.whiteNoise=null;this.active=[];}
  context(){
    if(!this.audioContext){
      const C=root.AudioContext||root.webkitAudioContext;
      if(!C)throw Error("This browser does not support Web Audio.");
      this.audioContext=new C();const c=this.audioContext;
      this.master=c.createGain();this.master.gain.value=.48;
      const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.2;
      this.master.connect(limiter).connect(c.destination);
    }
    if(this.audioContext.state==="suspended")this.audioContext.resume();
    return this.audioContext;
  }
  updateLive({bank=0,a=50,b=50}={}){
    if(!this.audioContext)return;
    const now=this.audioContext.currentTime;
    this.active=this.active.filter(v=>v.end>now);
    for(const v of this.active){
      if(bank===0){
        v.tone.frequency.setTargetAtTime(clamp(260+b*10,260,1260),now,.025);
        v.tone2?.frequency.setTargetAtTime(clamp(850+b*25,850,3350),now,.025);
        const ratio=Math.pow(2,(a-v.a)/72);
        v.sources.forEach(src=>{if(src.playbackRate?.setTargetAtTime&&src._originalRate)src.playbackRate.setTargetAtTime(clamp(src._originalRate*ratio,.15,5),now,.025)});
      }else{
        const factor=(.5+b/100)/(.5+v.b/100);
        v.sources.forEach(src=>{if(src.playbackRate?.setTargetAtTime&&src._originalRate)src.playbackRate.setTargetAtTime(clamp(src._originalRate*factor,.15,5),now,.025)});
      }
    }
  }
  silence(){if(this.audioContext&&this.master){this.master.gain.cancelScheduledValues(this.audioContext.currentTime);this.master.gain.setTargetAtTime(.48,this.audioContext.currentTime,.015)}}
  noiseBuffer(){
    if(this.whiteNoise)return this.whiteNoise;
    const c=this.context(),b=c.createBuffer(1,c.sampleRate,c.sampleRate),out=b.getChannelData(0);let seed=2463534242;
    for(let i=0;i<out.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;out[i]=((seed>>>0)/2147483648-1)}
    return this.whiteNoise=b;
  }
  demoVoice(slot){
    slot=clamp(slot,1,15)|0;
    if(this.demo.has(slot))return this.demo.get(slot);
    const c=this.context(),sr=22050,duration=.48+(slot%5)*.075,n=Math.floor(duration*sr),b=c.createBuffer(1,n,sr),out=b.getChannelData(0);
    const vowels=[[730,1090,2440],[530,1840,2600],[420,860,2400],[290,2290,3010],[330,900,2240],[610,1390,2500],[380,1510,2850]];
    const va=vowels[(slot-1)%vowels.length],vb=vowels[(slot+2)%vowels.length];
    const f0=98+(slot%7)*12,shift=slot%3===0?1:0;
    let max=0,phase=0,seed=slot*65537+123;
    for(let i=0;i<n;i++){
      const t=i/sr,u=i/(n-1),m=Math.min(1,Math.max(0,(u-.23)/.53));
      const f1=va[0]*(1-m)+vb[0]*m,f2=va[1]*(1-m)+vb[1]*m,f3=va[2]*(1-m)+vb[2]*m;
      const freq=f0*(1+.045*Math.sin(2*Math.PI*4.8*t)+.13*u);
      phase+=2*Math.PI*freq/sr;
      let v=0;
      for(let h=1;h<=26;h++){
        const partial=h*freq;
        const f=Math.exp(-Math.pow((partial-f1)/180,2))*1.1+
          Math.exp(-Math.pow((partial-f2)/310,2))*.85+
          Math.exp(-Math.pow((partial-f3)/420,2))*.42+.022;
        v+=Math.sin(phase*h)*f/Math.pow(h,.6);
      }
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      const hiss=((seed>>>0)/2147483648-1)*(u<.14?.10:shift?.027:.012);
      const env=Math.min(1,u/.045)*Math.min(1,(1-u)/.2);
      const sample=(v*.32+hiss)*env;out[i]=sample;max=Math.max(max,Math.abs(sample));
    }
    const gain=.84/Math.max(.05,max);for(let i=0;i<n;i++)out[i]*=gain;
    this.demo.set(slot,b);return b;
  }
  drum(note){
    note=clamp(note,1,16)|0;if(this.drumCache.has(note))return this.drumCache.get(note);
    const c=this.context(),sr=22050,n=Math.floor(sr*.46),b=c.createBuffer(1,n,sr),out=b.getChannelData(0);
    const type=(note-1)%4;let seed=note*1919+11,phase=0;
    for(let i=0;i<n;i++){
      const t=i/sr;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      const noise=((seed>>>0)/2147483648-1);
      let v=0;
      if(type===0){phase+=2*Math.PI*(46+125*Math.exp(-t*24))/sr;v=Math.sin(phase)*Math.exp(-t*12)}
      if(type===1){phase+=2*Math.PI*(168-35*t)/sr;v=(noise*.65+Math.sin(phase)*.35)*Math.exp(-t*19)}
      if(type===2){v=(noise-(i>0?out[i-1]*.34:0))*Math.exp(-t*38)*.56}
      if(type===3){phase+=2*Math.PI*(240+70*Math.sin(2*Math.PI*22*t))/sr;v=(Math.sin(phase)*.65+noise*.25)*Math.exp(-t*16)}
      out[i]=v*.78;
    }
    this.drumCache.set(note,b);return b;
  }
  reverse(buffer){
    const hit=this.reverseCache.get(buffer);if(hit)return hit;
    const c=this.context(),b=c.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
    for(let ch=0;ch<buffer.numberOfChannels;ch++){let a=buffer.getChannelData(ch),z=b.getChannelData(ch);for(let i=0;i<a.length;i++)z[i]=a[a.length-1-i]}
    this.reverseCache.set(buffer,b);return b;
  }
  shaper(steps,drive=1.5){
    const c=this.context(),w=c.createWaveShaper(),size=2048,a=new Float32Array(size);
    for(let i=0;i<size;i++){
      const x=(2*i/(size-1)-1)*drive;
      a[i]=Math.round(Math.tanh(x)*steps)/steps;
    }
    w.curve=a;w.oversample="2x";return w;
  }
  play(options={}){
    const c=this.context(),now=c.currentTime,t=Math.max(now+.002,options.when??now+.002);
    const slot=clamp(options.slot??1,1,16)|0,note=clamp(options.note??8,1,16)|0;
    const voice=slot===16?1:(clamp(options.voice??1,1,8)|0),fx=clamp(options.effect??16,9,16)|0;
    const bank=options.bank?1:0,a=clamp(options.a??50,0,100),b=clamp(options.b??50,0,100);
    const volume=clamp(options.volume??5,0,16),transpose=clamp(options.transpose??0,-24,24);
    const scale=options.scaleOffsets||[0,2,4,5,7,9,11,12,14,16,17,19,21,23,24,26];
    const degree=scale[(note-1)%scale.length]??(note-1),semi=degree-12+transpose+(bank?0:(a-50)/6);
    let rate=Math.pow(2,semi/12);
    if(voice===2)rate=Math.pow(2,Math.round(12*Math.log2(rate))/12);
    if(bank)rate*=.5+b/100;
    if(fx===11)rate*=.5;
    rate=clamp(rate,.18,4);
    const captured=this.getSample(slot),demo=slot===16?this.drum(note):this.demoVoice(slot);
    let buffer=captured||demo;
    if(fx===15)buffer=this.reverse(buffer);
    const at=bank?Math.min(buffer.duration*.85,buffer.duration*a/115):0;
    const period=Math.min(1.2,Math.max(.06,(buffer.duration-at)/rate));
    const stage=c.createGain(),fxStage=c.createGain(),amp=c.createGain(),tone=c.createBiquadFilter(),tone2=c.createBiquadFilter();
    tone.type="peaking";tone.Q.value=2.1;
    tone.frequency.value=clamp(260+b*10,260,1260);
    tone.gain.value=(voice===3?3:voice===7?12:9);
    tone2.type="peaking";tone2.Q.value=2.4;
    tone2.frequency.value=clamp(850+b*25,850,3350);
    tone2.gain.value=voice===7?10:6;
    stage.connect(tone).connect(tone2).connect(fxStage).connect(amp).connect(this.master);
    const volumeAmp=(volume/16)*.65;
    amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(Math.max(.0001,volumeAmp),t+.009);
    amp.gain.setTargetAtTime(.0001,t+period*.78,.05);
    if(fx===10){ // audible trance-gate subdivisions, synchronized to the note
      fxStage.gain.setValueAtTime(1,t);const slices=8;
      for(let i=0;i<slices;i++){let x=t+i*period/slices;fxStage.gain.setValueAtTime(i%2?0.055:1,x)}
    } else if(fx===12){ // build-up sweeps the spectrum over sixteen measures
      const progress=clamp((options.bar??0)%16/15,0,1),filter=c.createBiquadFilter();
      filter.type="lowpass";filter.frequency.setValueAtTime(250+progress*13000,t);
      fxStage.disconnect();fxStage.connect(filter).connect(amp);
      amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(Math.max(.0001,volumeAmp*(.26+.74*progress)),t+.01);
    } else if(fx===9){ // stutter-sweep repeats a short sliver
      const filter=c.createBiquadFilter();filter.type="lowpass";
      filter.frequency.setValueAtTime(370,t);
      filter.frequency.exponentialRampToValueAtTime(6900,t+period*.95);
      fxStage.disconnect();fxStage.connect(filter).connect(amp);
    }
    if(voice===3||voice===4){const crush=this.shaper(voice===3?13:5,voice===3?1.35:2.7);stage.disconnect();stage.connect(crush).connect(tone)}
    if(voice===7){const band=c.createBiquadFilter();band.type="bandpass";band.Q.value=.55;band.frequency.value=clamp(400+b*26,400,3000);stage.disconnect();stage.connect(band).connect(tone)}
    const sources=[];
    const makeSource=(time,start,dur,playRate,gain=.9)=>{
      const src=c.createBufferSource(),g=c.createGain();src.buffer=buffer;src.playbackRate.value=clamp(playRate,.15,5);src._originalRate=src.playbackRate.value;g.gain.value=gain;
      src.connect(g).connect(stage);src.start(time,clamp(start,0,Math.max(0,buffer.duration-.005)));
      const usable=(buffer.duration-start)/src.playbackRate.value;
      src.stop(time+Math.max(.005,Math.min(dur,usable)));
      sources.push(src);return src;
    };
    if(fx===9){
      for(let j=0;j<6;j++){const dt=j*period/6;makeSource(t+dt,at+j*.008,period/7,rate,1)}
    }else{makeSource(t,at,period,rate,1)}
    if(voice===6 && slot!==16){makeSource(t,at,period,rate*1.5,.32)}
    if(voice===4){const noise=c.createBufferSource(),g=c.createGain(),filter=c.createBiquadFilter();
      noise.buffer=this.noiseBuffer();noise.loop=true;filter.type="highpass";filter.frequency.value=2100;
      g.gain.value=.16;noise.connect(filter).connect(g).connect(stage);noise.start(t);noise.stop(t+period);sources.push(noise)}
    if(voice===5){ // ring modulation creates characteristic metallic/robotic texture
      const oscillator=c.createOscillator(),ring=c.createGain(),depth=c.createGain();
      ring.gain.value=.3;oscillator.type="sine";oscillator.frequency.value=clamp(38+note*3,38,130);
      depth.gain.value=.33;oscillator.connect(depth).connect(ring.gain);
      stage.disconnect();stage.connect(ring).connect(tone);oscillator.start(t);oscillator.stop(t+period)}
    if(voice===7||voice===8){ // synthetic carrier blended with the modulated recording
      const oscillator=c.createOscillator(),g=c.createGain();
      oscillator.type=voice===8?"sawtooth":"square";oscillator.frequency.setValueAtTime(110*Math.pow(2,(degree-12+transpose)/12),t);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(voice===8?.33:.12,t+.015);
      g.gain.exponentialRampToValueAtTime(.0001,t+period);
      oscillator.connect(g).connect(stage);oscillator.start(t);oscillator.stop(t+period)}
    if(voice===2){const shimmer=c.createDelay(.04);shimmer.delayTime.value=.012;const g=c.createGain();g.gain.value=.15;stage.connect(shimmer).connect(g).connect(tone)}
    if(fx===13){ // 6/8 treatment: accent 1-4-7 while quantization lives in the sequencer
      const trip=((options.step||0)%6);amp.gain.setValueAtTime(volumeAmp*(trip===0||trip===3?1:.54),t+.012)}
    this.active.push({end:t+period,a,b,tone,tone2,sources});
    this.active=this.active.filter(x=>x.end>now);
    return {time:t,duration:period,bufferKind:captured?"recording":slot===16?"tonic-drums":"synthetic-practice-voice",voice:VOICES[voice-1],effect:EFFECTS[fx],sources};
  }
}
PO35SoundEngine.VOICES=VOICES;PO35SoundEngine.EFFECTS=EFFECTS;
root.PO35SoundEngine=PO35SoundEngine;
})(window);
