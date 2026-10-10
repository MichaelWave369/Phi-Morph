import React,{useEffect,useState} from "react";
import {
 E9_PROTOCOL,E9_PROFILES,E9_FORCE_LIMITS,E9_POWER_LIMITS,E9_CYCLES,
 simulateE9,buildE9Receipt,e9Csv
} from "./e9.js";

const fmt=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):"N/A";
const cap=v=>v===null?"Unbounded":String(v);
function download(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement("a");a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1100);
}
function WheelStage({frame}){
 if(!frame)return <div className="e9-empty">
   <strong>COUPLED ACTUATOR / MORPHWHEEL RIG</strong>
   <small>Run a trial to watch actuator position and spring-linked rim respond together.</small>
 </div>;
 const x=v=>365+(v-frame.hub.x)*39;
 const y=v=>338-v*39;
 return <svg className="e9-svg" viewBox="0 0 730 385" role="img"
  aria-label={"Coupled wheel model at time "+frame.time+", actuator q "+frame.q}>
  <defs><radialGradient id="e9Background">
   <stop stopColor="#173e4c"/><stop offset="1" stopColor="#071824"/>
  </radialGradient></defs>
  <rect width="730" height="385" fill="url(#e9Background)"/>
  {Array.from({length:18},(_,i)=><line key={i} x1={i*42} x2={i*42}
   y1="0" y2="338" stroke="#678fa2" opacity=".14"/>)}
  <rect y="338" width="730" height="47" fill="#173947"/>
  <line x1="0" x2="730" y1="338" y2="338" stroke="#70ead8" strokeWidth="2"/>
  {frame.anchors.map((a,i)=><line key={"s"+i}
   x1={x(a.x)} y1={y(a.y)} x2={x(frame.nodes[i].x)} y2={y(frame.nodes[i].y)}
   stroke="#f6c77e" opacity=".6" strokeWidth="1.2" strokeDasharray="4 4"/>)}
  <polygon points={frame.nodes.map(n=>x(n.x)+","+y(n.y)).join(" ")}
   fill="#39bbc51d" stroke="#68e9e1" strokeWidth="2.5"/>
  {frame.anchors.map(a=><circle key={"a"+a.id} cx={x(a.x)}
   cy={y(a.y)} r="3" fill="#f8c983"/>)}
  {frame.nodes.map(n=><circle key={n.id} cx={x(n.x)} cy={y(n.y)}
   r="6.4" fill={n.contacting?"#eeb66d":"#3fbbd9"}
   stroke={n.contacting?"#fff0bf":"#b6f3ff"} strokeWidth="1"/>)}
  <circle cx="365" cy={y(frame.hub.y)} r="13" fill="#1a3544"
   stroke="#b9fff0" strokeWidth="2.4"/>
  <circle cx="365" cy={y(frame.hub.y)} r="4" fill="#7df3db"/>
  <text x="14" y="25" fontSize="11" fill="#b2e9e4">
   T {fmt(frame.time,2)} · COMMAND {fmt(frame.command,2)} · Q {fmt(frame.q,2)}
  </text>
  <text x="14" y="372" fontSize="10" fill="#9bc7d0">
   CYAN RIM NODES · GOLD MOVABLE ANCHORS · ORANGE GROUND CONTACT
  </text>
 </svg>;
}
function ResponseTrace({frames}){
 if(!frames?.length)return null;
 const maxTime=frames.at(-1).time;
 const vals=frames.flatMap(f=>[f.q,f.command]);
 const low=Math.min(-0.1,...vals),high=Math.max(1.1,...vals);
 const X=t=>41+t/maxTime*620;
 const Y=v=>10+164-(v-low)/(high-low)*164;
 const path=key=>frames.map(f=>X(f.time)+","+Y(f[key])).join(" ");
 return <div className="e9-trace"><svg viewBox="0 0 700 202" role="img"
   aria-label="Requested morph coordinate versus actual mechanically coupled actuator">
   {Array.from({length:5},(_,i)=><line key={i}
     x1="41" y1={10+i*41} x2="662" y2={10+i*41}
     stroke="#3a6273" strokeDasharray="4 5"/>)}
   <polyline fill="none" stroke="#f2ba6e" strokeWidth="2.5"
     strokeDasharray="5 4" points={path("command")}/>
   <polyline fill="none" stroke="#78ebe0" strokeWidth="2.5" points={path("q")}/>
   <text x="350" y="198" fill="#a3c5ca" fontSize="10" textAnchor="middle">
     MODEL TIME · GOLD REQUESTED / CYAN ACHIEVED
   </text>
 </svg></div>;
}
function Results({receipt}){
 return <div className="table-scroll"><table className="e9-table">
   <thead><tr><th>PROFILE</th><th>FORCE CAP</th><th>POWER CAP</th>
     <th>TRACKING RMS</th><th>ACHIEVED Q</th><th>RIM TRAVEL</th>
     <th>POSITIVE DRIVE WORK</th><th>POWER HIT %</th><th>ENERGY RESIDUAL</th>
   </tr></thead>
   <tbody>{receipt.runs.map(r=><tr key={r.profile+":"+r.forceLimit+":"+String(r.powerLimit)}>
    <td>{r.profile}</td><td>{r.forceLimit}</td><td>{cap(r.powerLimit)}</td>
    <td>{fmt(r.metrics?.rmsTrackingError)}</td><td>{fmt(r.metrics?.finalQ)}</td>
    <td>{fmt(r.metrics?.hubTravel)}</td>
    <td>{fmt(r.metrics?.grossPositiveDriveWork)}</td>
    <td>{fmt(100*r.metrics?.powerCapHitFraction,1)}%</td>
    <td>{fmt(r.metrics?.relativeEnergyResidual)}</td>
   </tr>)}</tbody>
 </table></div>;
}

export default function E9Panel(){
 const [profile,setProfile]=useState("medium");
 const [forceLimit,setForceLimit]=useState(10);
 const [powerLimit,setPowerLimit]=useState(2);
 const [cycles,setCycles]=useState(1);
 const [load,setLoad]=useState(2);
 const [mu,setMu]=useState(0.35);
 const [torque,setTorque]=useState(0.8);
 const [spokesEnabled,setSpokesEnabled]=useState(true);
 const [preview,setPreview]=useState(null);
 const [receipt,setReceipt]=useState(null);
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [runNo,setRunNo]=useState(0);
 const [studyNo,setStudyNo]=useState(0);
 const dirty=Boolean(preview)&&(
   preview.profile!==profile||preview.forceLimit!==forceLimit||
   preview.powerLimit!==powerLimit||preview.cycles!==cycles||
   preview.load!==load||preview.mu!==mu||preview.torque!==torque||
   preview.spokesEnabled!==spokesEnabled);
 const studyDirty=Boolean(receipt)&&(
   receipt.frozen.cycles!==cycles||receipt.frozen.load!==load||
   receipt.frozen.mu!==mu||receipt.frozen.torque!==torque);
 useEffect(()=>{
   if(!playing||!preview||dirty)return undefined;
   const t=setInterval(()=>setIndex(i=>{
     if(i+1>=preview.frames.length){setPlaying(false);return i;}
     return i+1;
   }),70);
   return ()=>clearInterval(t);
 },[preview,playing,dirty]);
 const run=()=>{
   setPlaying(false);
   const r=simulateE9({profile,forceLimit,powerLimit,cycles,load,
     mu,torque,spokesEnabled,captureFrames:true});
   setPreview(r);setIndex(0);setRunNo(n=>n+1);
   if(r.numericallyFinite)setPlaying(true);
 };
 const study=()=>{
   setReceipt(buildE9Receipt({cycles,load,mu,torque}));setStudyNo(n=>n+1);
 };
 const exportFile=kind=>{
   if(!receipt)return;
   const stamp=receipt.recordedAt.replace(/[:.]/g,"-");
   if(kind==="json")download("phi-morph-e9-"+stamp+".json",
     JSON.stringify(receipt,null,2)+"\n","application/json");
   else download("phi-morph-e9-"+stamp+".csv",e9Csv(receipt),"text/csv");
 };
 const m=preview?.metrics;
 return <section className="panel e9-panel" aria-labelledby="e9-title">
   <div className="e1-header"><div>
     <p className="eyebrow">13 / E9 · COUPLED ACTUATION & RIM BACK-REACTION</p>
     <h2 id="e9-title">Can a limited actuator still morph a loaded wheel?</h2>
     <p className="e1-summary">One power-limited actuator coordinate commands
       24 moving spoke anchors. The deforming rim pushes back against that
       coordinate, so actual shape response must be solved, not assumed.</p>
   </div><span className="pill">{E9_PROTOCOL}</span></div>
   <div className="e1-constraints">
     <span><strong>24</strong> movable rim nodes</span>
     <span><strong>1</strong> shared actuator coordinate</span>
     <span><strong>27</strong> coupled cases</span>
     <span><strong>5</strong> controls</span>
     <span><strong>2</strong> cycle lengths</span>
   </div>
   <div className="e9-workbench">
    <div className="e9-visual">
      <div className="e1-inner-heading"><strong>Force-coupled MorphWheel</strong>
        <span>SIMULATED · 2D POINT CONTACT</span></div>
      <WheelStage frame={preview?.frames?.[index]}/>
      {preview?.frames&&<div className="e3-playback">
       <button disabled={dirty} onClick={()=>{
         if(index===preview.frames.length-1)setIndex(0);
         setPlaying(p=>!p);
       }}>{playing?"PAUSE II":"PLAY ▶"}</button>
       <input aria-label="Coupled simulation playback frame" type="range"
         min="0" max={preview.frames.length-1} value={index} step="1"
         onChange={e=>{setPlaying(false);setIndex(Number(e.target.value));}}/>
       <span>{index+1} / {preview.frames.length}</span>
      </div>}
      <ResponseTrace frames={preview?.frames}/>
      {dirty&&<p className="e1-dirty" role="status">Inputs changed after this trial.
        Run again to update the recorded response.</p>}
      <p className="fine-print">Requested shape change is shown in gold.
        Actual achieved actuator position is cyan. The rim's spring
        reaction feeds back into the actuator, and its positive drive
        work is included in the model ledger.</p>
    </div>
    <div className="e9-controls">
      <div className="e1-inner-heading"><strong>Coupled drive settings</strong><span>NORMALIZED</span></div>
      <label>Controller response
        <select value={profile} onChange={e=>setProfile(e.target.value)}>
          {E9_PROFILES.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>Drive force limit
        <select value={forceLimit} onChange={e=>setForceLimit(Number(e.target.value))}>
          {E9_FORCE_LIMITS.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>Sampled mechanical power limit
        <select value={powerLimit===null?"none":powerLimit}
          onChange={e=>setPowerLimit(e.target.value==="none"?null:Number(e.target.value))}>
          {E9_POWER_LIMITS.map(v=><option key={String(v)} value={v===null?"none":v}>
            {cap(v)}</option>)}
        </select>
      </label>
      <label>Continuous morph cycles
        <select value={cycles} onChange={e=>setCycles(Number(e.target.value))}>
          {E9_CYCLES.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>Downward hub load
        <select value={load} onChange={e=>setLoad(Number(e.target.value))}>
          {[1,2,4].map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>Ground friction μ
        <select value={mu} onChange={e=>setMu(Number(e.target.value))}>
          {[0,0.35,0.8].map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>Motor torque
        <select value={torque} onChange={e=>setTorque(Number(e.target.value))}>
          {[0,0.8].map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="e9-check-label"><input type="checkbox"
         checked={spokesEnabled} onChange={e=>setSpokesEnabled(e.target.checked)}/>
         Connect actuator to rim spokes</label>
      <button className="primary-button e3-full-button" onClick={run}>RUN COUPLED TRIAL ↗</button>
      {m&&<div className="e9-metrics">
        <div><span>Actual final actuator q</span><strong>{fmt(m.finalQ)}</strong></div>
        <div><span>Tracking error RMS</span><strong>{fmt(m.rmsTrackingError)}</strong></div>
        <div><span>Rim hub travel</span><strong>{fmt(m.hubTravel)}</strong></div>
        <div><span>Positive controller work</span><strong>{fmt(m.grossPositiveDriveWork)}</strong></div>
        <div><span>Power cap hit fraction</span><strong>{fmt(100*m.powerCapHitFraction,1)}%</strong></div>
        <div><span>Peak spring force</span><strong>{fmt(m.maxSpokeForce)}</strong></div>
        <div><span>Relative energy residual</span><strong>{fmt(m.relativeEnergyResidual)}</strong></div>
        <small>TRIAL #{runNo} · SIMULATED · NO PHYSICAL VALIDATION</small>
      </div>}
    </div>
   </div>
   <div className="e9-study">
     <div className="e1-header"><div>
       <p className="eyebrow">E9 / COUPLED RESPONSE MATRIX</p>
       <h2>Actuator limitations under wheel back-reaction</h2>
       <p className="e1-summary">Three gain profiles × three force limits ×
         three sampled mechanical power limits. Every case begins at
         the same round initial state and uses identical rim properties.</p>
     </div></div>
     <div className="button-row">
       <button className="primary-button" onClick={study}>RUN 27-CASE COUPLED STUDY ↗</button>
       <button className="secondary-button" disabled={!receipt} onClick={()=>exportFile("json")}>JSON ↓</button>
       <button className="secondary-button" disabled={!receipt} onClick={()=>exportFile("csv")}>CSV ↓</button>
     </div>
     {studyDirty&&<p className="e1-dirty">Study controls changed. Run another study to update it.</p>}
     {receipt?<div className="e9-results">
       <div className="e1-inner-heading"><strong>Force × power × response</strong>
         <span>RUN #{studyNo} · MODEL ONLY</span></div>
       <Results receipt={receipt}/>
       <div className="e9-negative-controls">
         <strong>Negative controls and disconnected-actuator benchmark</strong>
         {receipt.negativeControls.map(c=><div key={c.kind}>
           <span>{c.kind}</span><small>
             Q {fmt(c.finalQ)} · Drive work {fmt(c.driveWork)} ·
             Ground impulse {fmt(c.groundImpulse)} ·
             Friction impulse {fmt(c.frictionImpulse)}</small>
         </div>)}
         <p className="fine-print">dt .005 versus .0025:
           q Δ {fmt(receipt.numericalDiagnostic.finalQDelta)},
           travel Δ {fmt(receipt.numericalDiagnostic.travelDelta)},
           residual Δ {fmt(receipt.numericalDiagnostic.residualDelta)}.</p>
       </div>
       <p className="e1-receipt-info">{new Date(receipt.recordedAt).toLocaleString()}
         · SIMULATED · 27 CASES + FIVE CONTROLS · NO PHYSICAL VALIDATION</p>
     </div>:<div className="e1-empty">
       <strong>NO E9 RECEIPT YET</strong>
       <span>Run the 27-case model comparison to audit the coupled controller.</span>
     </div>}
   </div>
   <div className="e2-disclosure"><strong>Controller coupling is not a prototype wheel.</strong>
     <p>The actuator q is one shared normalized coordinate, not 24 real motors.
       Its force/power cap concerns the sampled mechanical model, not electric
       power, current, temperature or a physical battery. Point-contact
       friction, structural springs and shape change lack measured materials
       or qualified physical validation. The model cannot establish tire
       durability, braking performance or manufacturability.</p>
   </div>
 </section>;
}
