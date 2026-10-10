import React,{useState} from "react";
import {
 E8_PROTOCOL,E8_PROFILES,E8_FORCE_LIMITS,E8_POWER_LIMITS,E8_CYCLES,
 E8_LOAD_SPRING,simulateE8,buildE8Receipt,e8Csv
} from "./e8.js";
const num=(x,n=3)=>Number.isFinite(x)?x.toFixed(n):"N/A";
const cap=v=>v===null?"Unbounded":String(v);
const title=s=>s[0].toUpperCase()+s.slice(1);
function download(name,content,mime){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement("a");a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1100);
}
function ResponseTrace({frames}){
 if(!frames?.length)return <div className="e8-empty-chart">
  <strong>NO ACTUATOR TRACE</strong><span>Run a trial to plot commanded versus actual movement.</span>
 </div>;
 const maxT=frames.at(-1).time||1;
 const vals=frames.flatMap(p=>[p.command,p.position]);
 const minV=Math.min(-.08,...vals),maxV=Math.max(1.1,...vals);
 const left=51,top=22,width=628,height=190;
 const x=t=>left+t/maxT*width;
 const y=v=>top+height-(v-minV)/(maxV-minV)*height;
 const line=k=>frames.map(p=>x(p.time)+","+y(p[k])).join(" ");
 return <div className="e8-trace">
  <svg viewBox="0 0 720 265" role="img" aria-label="Command and actual actuator position across time">
   {Array.from({length:5},(_,i)=>{
    const v=minV+(maxV-minV)*i/4;
    return <g key={i}><line x1={left} x2={left+width} y1={y(v)} y2={y(v)}
      stroke="#3d5c6c" strokeDasharray="3 5" />
      <text x={left-9} y={y(v)+4} textAnchor="end" fill="#9dbccb" fontSize="11">
        {num(v,1)}</text></g>;
   })}
   {Array.from({length:5},(_,i)=>{
    const v=i*maxT/4;
    return <text key={i} x={x(v)} y={top+height+22} textAnchor="middle"
      fill="#a2c0cc" fontSize="11">{num(v,1)}</text>;
   })}
   <polyline fill="none" points={line("command")} stroke="#ffcb7b"
      strokeWidth="3" strokeDasharray="6 4"/>
   <polyline fill="none" points={line("position")} stroke="#73e9dd"
      strokeWidth="3"/>
   <text x={left+width/2} y="258" textAnchor="middle"
     fill="#89b1bd" fontSize="10">NORMALIZED MODEL TIME</text>
  </svg>
  <div className="e8-trace-legend">
   <span><i className="e8-dot e8-command"/> Commanded shape coordinate</span>
   <span><i className="e8-dot e8-actual"/> Actual actuator position</span>
  </div>
 </div>;
}
function Cases({receipt}){
 return <div className="table-scroll"><table className="e8-table">
  <thead><tr><th>GAIN PROFILE</th><th>FORCE CAP</th><th>POWER CAP</th>
    <th>TRACKING RMS</th><th>POWER HIT %</th>
    <th>POSITIVE WORK</th><th>LOOP AREA PROXY</th><th>RESIDUAL</th></tr></thead>
  <tbody>{receipt.runs.map(r=><tr key={r.profile+":"+r.forceLimit+":"+String(r.powerLimit)}>
   <td>{title(r.profile)}</td><td>{r.forceLimit}</td><td>{cap(r.powerLimit)}</td>
   <td>{num(r.metrics?.rmsTrackingError)}</td>
   <td>{num(100*r.metrics?.powerCapHitFraction,1)}%</td>
   <td>{num(r.metrics?.totalPositiveMechanicalWork)}</td>
   <td>{num(r.metrics?.commandResponseLoopArea)}</td>
   <td>{num(r.metrics?.relativeEnergyResidual)}</td>
  </tr>)}</tbody></table></div>;
}
export default function E8Panel(){
 const [profile,setProfile]=useState("medium");
 const [forceLimit,setForceLimit]=useState(10);
 const [powerLimit,setPowerLimit]=useState(2);
 const [cycles,setCycles]=useState(1);
 const [loadSpring,setLoadSpring]=useState(E8_LOAD_SPRING);
 const [trial,setTrial]=useState(null);
 const [receipt,setReceipt]=useState(null);
 const [runs,setRuns]=useState(0);
 const [studies,setStudies]=useState(0);
 const trialDirty=Boolean(trial)&&(
   trial.profile!==profile||trial.forceLimit!==forceLimit||
   trial.powerLimit!==powerLimit||trial.cycles!==cycles||
   trial.loadSpring!==loadSpring);
 const receiptDirty=Boolean(receipt)&&(
   receipt.design.cycles!==cycles||receipt.design.loadSpring!==loadSpring);
 const runTrial=()=>{
   setTrial(simulateE8({profile,forceLimit,powerLimit,cycles,loadSpring,captureFrames:true}));
   setRuns(n=>n+1);
 };
 const runStudy=()=>{
   setReceipt(buildE8Receipt({cycles,loadSpring}));setStudies(n=>n+1);
 };
 const exportStudy=type=>{
   if(!receipt)return;
   const id=receipt.recordedAt.replace(/[:.]/g,"-");
   if(type==="json")download("phi-morph-e8-"+id+".json",
     JSON.stringify(receipt,null,2)+"\n","application/json");
   else download("phi-morph-e8-"+id+".csv",e8Csv(receipt),"text/csv");
 };
 const m=trial?.metrics;
 return <section className="panel e8-panel" aria-labelledby="e8-title">
  <div className="e1-header"><div>
   <p className="eyebrow">12 / E8 · POWER-LIMITED ACTUATOR CHARACTERIZATION</p>
   <h2 id="e8-title">How fast can the actuator actually follow a command?</h2>
   <p className="e1-summary">Isolate one normalized actuator to compare
     command response, force limits, speed-dependent mechanical power,
     controller lag and energy bookkeeping before reconnecting the
     controller to a deformable wheel.</p>
  </div><span className="pill">{E8_PROTOCOL}</span></div>
  <div className="e1-constraints">
   <span><strong>1</strong> isolated DOF</span>
   <span><strong>3</strong> response profiles</span>
   <span><strong>3</strong> force caps</span>
   <span><strong>3</strong> power caps</span>
   <span><strong>27</strong> study cases</span>
  </div>
  <div className="e8-workbench">
   <div className="e8-graph-panel">
     <div className="e1-inner-heading"><strong>Command versus actual response</strong>
       <span>1D · NORMALIZED DISPLACEMENT</span></div>
     <ResponseTrace frames={trial?.frames}/>
     {trialDirty&&<p className="e1-dirty" role="status">
       Inputs changed since the last trial. Run it again to refresh the trace.</p>}
     <p className="fine-print">The gold dashed line is commanded shape
       coordinate (round = 0, rounded-square = 1). The cyan line shows a
       single numerical actuator's response, NOT the movement of an actual wheel.</p>
     {m&&<div className="e8-preview-metrics">
       <div><span>RMS command-tracking error</span><strong>{num(m.rmsTrackingError)}</strong></div>
       <div><span>Force cap active</span><strong>{num(100*m.forceCapHitFraction,1)}%</strong></div>
       <div><span>Power cap active</span><strong>{num(100*m.powerCapHitFraction,1)}%</strong></div>
       <div><span>Peak sampled mechanical power</span><strong>{num(m.peakSampledMechanicalPower)}</strong></div>
       <div><span>Positive work</span><strong>{num(m.totalPositiveMechanicalWork)}</strong></div>
       <div><span>Negative work</span><strong>{num(m.totalNegativeMechanicalWork)}</strong></div>
       <div><span>Command-response loop area</span><strong>{num(m.commandResponseLoopArea)}</strong></div>
       <div><span>Energy balance residual</span><strong>{num(m.energyResidual)}</strong></div>
       <small>TRIAL #{runs} · SIMULATED · ALL VALUES DIMENSIONLESS</small>
     </div>}
   </div>
   <div className="e8-controls">
     <div className="e1-inner-heading"><strong>Servo conditions</strong><span>FROZEN PRESETS</span></div>
     <label>Controller response gain
       <select value={profile} onChange={e=>setProfile(e.target.value)}>
         {E8_PROFILES.map(v=><option key={v} value={v}>{title(v)}</option>)}
       </select>
     </label>
     <label>Force limit
       <select value={forceLimit} onChange={e=>setForceLimit(Number(e.target.value))}>
         {E8_FORCE_LIMITS.map(v=><option key={v} value={v}>{v}</option>)}
       </select>
     </label>
     <label>Sampled mechanical power limit
       <select value={powerLimit===null?"unbounded":powerLimit}
         onChange={e=>setPowerLimit(e.target.value==="unbounded"?null:Number(e.target.value))}>
         {E8_POWER_LIMITS.map(v=><option key={String(v)}
           value={v===null?"unbounded":v}>{cap(v)}</option>)}
       </select>
     </label>
     <label>Round-to-square-to-round cycles
       <select value={cycles} onChange={e=>setCycles(Number(e.target.value))}>
         {E8_CYCLES.map(v=><option key={v} value={v}>{v}</option>)}
       </select>
     </label>
     <label>Normalized test load
       <select value={loadSpring} onChange={e=>setLoadSpring(Number(e.target.value))}>
         <option value={0}>No spring load</option>
         <option value={E8_LOAD_SPRING}>Spring load = {E8_LOAD_SPRING}</option>
       </select>
     </label>
     <button className="primary-button e3-full-button" onClick={runTrial}>
       RUN ACTUATOR RESPONSE ↗</button>
     <p className="fine-print">Fast and slow are assumed feedback gains,
       NOT measured motor bandwidth. A power cap constrains sampled
       mechanical |force × velocity|, not electrical battery draw.</p>
   </div>
  </div>
  <div className="e8-study">
   <div className="e1-header"><div>
    <p className="eyebrow">E8 / NUMERICAL ACTUATOR CHARACTERIZATION</p>
    <h2>Response, saturation and dynamic lag</h2>
    <p className="e1-summary">Twenty-seven scenarios per chosen cycle count and
      load. Compare tracking, work and the area of the controller command-response loop.</p>
   </div></div>
   <div className="button-row">
     <button className="primary-button" onClick={runStudy}>RUN 27-CASE STUDY ↗</button>
     <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("json")}>JSON ↓</button>
     <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("csv")}>CSV ↓</button>
   </div>
   {receiptDirty&&<p className="e1-dirty" role="status">
     Cycles/load changed since this receipt. Run a new study.</p>}
   {receipt?<div className="e8-study-results">
     <div className="e1-inner-heading"><strong>Power × force × response comparison</strong>
       <span>RUN #{studies} · SIMULATED</span></div>
     <Cases receipt={receipt}/>
     <div className="e8-audit">
       <div>
        <strong>Analytical step-response checks</strong>
        <p>Independent no-load, uncapped PD response equation.
          These comparisons test numerical correctness, not measured motor behavior.</p>
        {receipt.analyticalStepReference.map(c=><div className="e8-audit-row" key={c.time}>
          <span>t = {c.time}</span>
          <span>Analytic {num(c.analytical,5)}</span>
          <span>Numeric {num(c.numerical,5)}</span>
          <strong>Δ {num(c.absoluteDelta,5)}</strong>
        </div>)}
       </div>
       <div>
        <strong>Negative controls</strong>
        {receipt.negativeControls.map(c=><div className="e8-control-row" key={c.kind}>
          <span>{c.kind}</span>
          <small>Positive work {num(c.positiveWork)} ·
            final position {num(c.finalPosition)} · peak power {num(c.peakPower)}</small>
        </div>)}
        <p className="fine-print">Timestep 0.005 vs 0.0025:
          final position Δ {num(receipt.timeStepDiagnostic.positionDelta)};
          relative residual Δ {num(receipt.timeStepDiagnostic.residualDelta)}.</p>
       </div>
     </div>
     <p className="e1-receipt-info">{new Date(receipt.recordedAt).toLocaleString()}
       · 27 CASES · FOUR CONTROLS · ORIGIN SIMULATED · NO PHYSICAL VALIDATION</p>
   </div>:<div className="e1-empty"><strong>NO E8 CHARACTERIZATION RECEIPT YET</strong>
     <span>Run the study to compare feedback, force caps, and sampled mechanical power.</span>
   </div>}
  </div>
  <div className="e2-disclosure">
   <strong>Dynamic controller lag is not material hysteresis.</strong>
   <p>This experiment is an isolated one-degree-of-freedom actuator model.
     It has no measured motor, battery, water, tire, structural fatigue
     or actual electric-field response. The loop-area display is a
     mathematical command-response lag proxy; it is not a magnetic,
     rubber, fluid or other physical hysteresis measurement.</p>
  </div>
 </section>;
}
