/* PO-35 Speak: independently-addressable vector LCD engine.
 * Inactive etched/ghost segments intentionally use 1.8% opacity.
 * The full vector source remains the visual reference; this engine makes it live.
 */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const OFF = 0.018, ON = 0.98;
  const SEGS = ["a","b","c","d","e","f","g"];
  const GLYPHS = {
    "0":"abcdef", "1":"bc", "2":"abdeg", "3":"abcdg", "4":"bcfg",
    "5":"acdfg", "6":"acdefg", "7":"abc", "8":"abcdefg", "9":"abcdfg",
    "A":"abcefg","B":"cdefg","C":"adef","D":"bcdeg","E":"adefg",
    "F":"aefg","G":"acdef","H":"bcefg","I":"bc","J":"bcde",
    "L":"def","M":"abcef","N":"ceg","O":"abcdef","P":"abefg","R":"eg",
    "S":"acdfg","T":"defg","U":"bcdef","V":"cde","Y":"bcdfg",
    "-":"g","_":"d"," ":""
  };
  const SHAPES = {
    a:"4,0 20,0 17,4 7,4",
    b:"21,2 24,5 24,19 21,22 19,19 19,6",
    c:"21,26 24,29 24,43 21,46 19,42 19,29",
    d:"4,48 20,48 17,44 7,44",
    e:"2,26 5,29 5,42 2,46 0,43 0,29",
    f:"2,2 5,6 5,19 2,22 0,19 0,5",
    g:"4,24 8,22 17,22 21,24 17,26 8,26"
  };
  let root = null, runtime = null, cells = [], segments = [], svgPaths = [], controllableArt = [];
  let lastState = null, lastArmed = null, lastExtra = null;
  let testMode = null, testIndex = 0, pending = null, lastFailure = null;
  const create = (name, attrs={}) => {
    const node = document.createElementNS(NS,name);
    Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key,String(value)));
    return node;
  };
  function illuminate(node, active) {
    if (node) node.style.opacity = active ? String(ON) : String(OFF);
  }
  function element(id) {
    return root?.querySelector('[id="' + id + '"]') || null;
  }
  function drawCells() {
    const art = element("lcd-artwork");
    if (!art) throw Error("The traced LCD artwork group was not found.");
    runtime = create("g", {"id":"lcd-live-readout","fill":"#111","aria-label":"State-driven seven-segment LCD"});
    for (let pos=0; pos<7; pos++) {
      const x = 164 + pos*31, y = 1.5;
      const cell = create("g",{"id":"lcd-digit-"+pos,"transform":'translate('+x+' '+y+') scale(1 1.02)'});
      const parts = {};
      for (const name of SEGS) {
        const shape = create("polygon",{
          "id":'lcd-digit-'+pos+'-'+name, "points":SHAPES[name],
          "data-digit":pos, "data-segment":name, "opacity":OFF
        });
        cell.append(shape);parts[name]=shape;segments.push(shape);
      }
      runtime.append(cell);cells.push(parts);
    }
    const annunciators = create("g",{"id":"lcd-extra-annunciators","fill":"#111"});
    const write = create("circle",{"id":"lcd-write-flag","cx":157,"cy":57,"r":2.8,"opacity":OFF});
    const record = create("circle",{"id":"lcd-record-flag","cx":150,"cy":58,"r":2.8,"opacity":OFF});
    annunciators.append(write,record);runtime.append(annunciators);
    art.append(runtime);
  }
  async function mount() {
    if (root) return root;
    if (pending) return pending;
    pending = (async () => {
      const img = document.querySelector(".instrument-stage .instrument-art");
      if (!img) throw Error("Instrument artwork not found.");
      const response = await fetch(img.getAttribute("src"), {cache:"no-cache"});
      if (!response.ok) throw Error("LCD artwork fetch failed: HTTP "+response.status);
      const xml = await response.text();
      const parsed = new DOMParser().parseFromString(xml,"image/svg+xml");
      const svg = parsed.documentElement;
      if (svg.localName !== "svg" || parsed.querySelector("parsererror")) throw Error("Invalid instrument SVG");
      svg.removeAttribute("width");svg.removeAttribute("height");
      svg.classList.add("instrument-art","instrument-vector");
      svg.setAttribute("role","img");
      svg.setAttribute("aria-label","PO-35 Speak front panel with functional segmented LCD");
      img.replaceWith(document.importNode(svg,true));
      root = document.querySelector(".instrument-stage svg.instrument-vector");
      if (!root) throw Error("Could not mount interactive SVG");
      svgPaths = Array.from(root.querySelectorAll("#lcd-artwork path[id]"));
      controllableArt = svgPaths.filter(path => path.parentElement?.id !== "digital-readout");
      drawCells();
      if (lastState) render(lastState,lastArmed,lastExtra);
      else render({pattern:1,sound:1,voice:1,bpm:120,volume:10,step:0,playing:false,write:false,bank:0,patterns:Array.from({length:16},()=>Array(16).fill(false))},null,{});
      return root;
    })().catch(error => {lastFailure = error.message;pending=null;throw error});
    return pending;
  }
  function outputText(state,armed,extra) {
    const bpm=Math.max(0,Math.min(999,Math.round(Number(state.bpm)||120)));
    const tempo=String(bpm).padStart(3,"0");
    const two=n=>String(Math.max(0,Math.min(99,Number(n)||0))).padStart(2,"0");
    const mode=armed || state.lcdView || "pattern";
    if(extra?.recording) return "REC "+two(extra.slot||state.sound);
    switch(mode){
      case "sound": return "S"+two(state.sound)+" "+tempo;
      case "pattern": return "P"+two(state.pattern)+" "+tempo;
      case "voice": case "fx": return (mode==="voice"||Number(state.fx)<9?"V"+two(state.voice):"F"+two(state.fx))+" "+tempo;
      case "bpm": case "volume": return "B"+two(state.volume)+" "+tempo;
      case "tempo": return "BPM "+tempo;
      case "record": return "REC "+two(state.sound);
      case "parameter": return "A"+two(state.knobA)+" B"+two(state.knobB);
      case "note": return "N"+two(state.lastPad||1)+" S"+two(state.sound);
      default: return "P"+two(state.pattern)+" "+tempo;
    }
  }
  function setDigits(value) {
    const text = String(value).toUpperCase().padEnd(7," ").slice(0,7);
    cells.forEach((parts,i) => {
      const on = GLYPHS[text[i]] ?? "";
      for (const name of SEGS) {
        const active = testMode==="all" || (testMode==="walk" && testIndex===i*7+SEGS.indexOf(name)) || (testMode===null && on.includes(name));
        parts[name].setAttribute("opacity", active ? ON : OFF);
      }
    });
  }
  function drawNativeArt(state,armed,extra) {
    // Original traced paths remain individual DOM elements; none is a bitmap.
    // Every inactive segment is 1.8% visible, including the unused original digits.
    for (const path of svgPaths) path.style.opacity = String(OFF);
    if (testMode==="off") return;
    if (testMode==="walk") {
      const index=testIndex-49-32;
      if (index>=0 && index<controllableArt.length) illuminate(controllableArt[index],true);
      return;
    }
    if (testMode==="all") {
      controllableArt.forEach(p=>illuminate(p,true));
      return;
    }
    const lit = id => illuminate(element("lcd-shape-"+String(id).padStart(3,"0")),true);
    const playing=!!state.playing,step=Number(state.step)||0,voice=Number(state.voice)||1;
    // Independent character/sprite regions traced from the original display.
    [4,18,21,53,56,1,14,20,24,25].forEach(lit);
    if (!playing || step%2===0) lit(48); // second figure
    if (playing && step%4<2) lit(7); // music notes
    if (playing && step%2===1) illuminate(element("lcd-shape-024"),false);
    if (playing && voice>=5 && step%2===1) illuminate(element("lcd-shape-053"),false);
    // Band meter: independently switched black traces, not one flat image.
    const meter=[19,17,16,12,5,15,13,6,10,8];
    const level=playing?3+((step*7+voice)%8):Math.round((Number(state.volume)||0)*10/16);
    meter.forEach((id,i)=>{if(i<level)lit(id)});
    // The original DISP/voice indicators each have their own traced element.
    [2,3].forEach(lit);
    if (Math.abs(Number(state.bpm)-120)<1) lit(11); // DISCO legend
    if (playing) lit(22); else lit(23); // play and stop icon
    if (extra?.recording) {lit(22);lit(23)}
    if (playing || armed==="fx" || Number(state.bank)===1) lit(26);
    if (state.write) lit(9);
  }
  function drawStepBars(state) {
    const pattern=state.patterns?.[(Number(state.pattern)||1)-1]||[];
    for(let i=0;i<16;i++){
      ["top","bottom"].forEach((position,row)=>{
        const active = testMode==="all" || (testMode==="walk" && testIndex===49+row*16+i) ||
          (testMode===null && (Boolean(pattern[i]) || (state.playing && state.step===i)));
        const rect=element("lcd-"+position+"-step-"+(i+1));
        if(!rect)return;
        rect.style.opacity=active?String(ON):String(OFF);
        rect.setAttribute("fill",active?"#111":"#fff");
      });
    }
  }
  function render(state,armed=null,extra={}) {
    lastState=state;lastArmed=armed;lastExtra=extra;
    if(!root)return;
    drawNativeArt(state,armed,extra);
    drawStepBars(state);
    setDigits(outputText(state,armed,extra));
    illuminate(element("lcd-write-flag"),testMode==="all" || (testMode==="walk" && testIndex===49+32+controllableArt.length) || (testMode===null&&!!state.write));
    illuminate(element("lcd-record-flag"),testMode==="all" || (testMode==="walk" && testIndex===49+32+controllableArt.length+1) || (testMode===null&&!!extra?.recording));
  }
  function setTest(mode) {
    if(![null,"all","off","walk"].includes(mode)) throw Error("Unknown LCD test mode");
    testMode=mode;testIndex=0;
    if(lastState)render(lastState,lastArmed,lastExtra);
    return testMode;
  }
  function nextTestSegment() {
    if(testMode!=="walk")testIndex=-1;
    testMode="walk";testIndex=(testIndex+1)%(49+32+controllableArt.length+2);
    if(lastState)render(lastState,lastArmed,lastExtra);
    return testIndex;
  }
  function diagnostics(){
    return {mounted:Boolean(root),segments:segments.length,originalPaths:svgPaths.length,individuallyAddressableParts:49+32+controllableArt.length+2,
      independentlyControlledLedRects:root?.querySelectorAll('[id^="lcd-top-step-"],[id^="lcd-bottom-step-"]').length||0,
      inactiveOpacity:OFF,mode:testMode,testIndex,display:outputText(lastState||{},lastArmed,lastExtra),error:lastFailure};
  }
  window.PO35LCD = {mount,render,setTest,nextTestSegment,diagnostics};
})();
