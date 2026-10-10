import React,{useEffect,useState} from "react";
import {
 E6_PROTOCOL,E6_MODES,E6_FRICTIONS,E6_TORQUES,E6_LOADS,
 e6Command,simulateE6,buildE6Receipt,e6Csv
} from "./e6.js";

const titles={round:"Fixed round",square:"Fixed rounded square","morph-cycle":"Round → square → round"};
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):"N/A";
function download(name,content,mime){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}

function Wheel({frame,mode}){
 if(!frame)return <div className="e6-empty-view">
   <strong>ACTUATED MORPHWHEEL · STANDBY</strong>
   <small>Run a simulation to see the spring-linked rim move and deform.</small>
 </div>;
 const scale=39,groundY=339,hubX=370;
 const xp=v=>hubX+(v-frame.hub.x)*scale;
 const yp=v=>groundY-v*scale;
 const nodes=frame.nodes,anchors=frame.anchors;
 const alpha=e6Command(mode,frame.time).alpha;
 return <svg className="e6-svg" viewBox="0 0 740 385" role="img"
   aria-label={"Active rim simulation at time "+frame.time+" with transformation progress "+fmt(100*alpha,1)+" percent"}>
   <defs><radialGradient id="e6Bg"><stop stopColor="#1b3d4b"/><stop offset="1" stopColor="#081725"/></radialGradient></defs>
   <rect width="740" height="385" fill="url(#e6Bg)"/>
   {Array.from({length:19},(_,i)=><line key={i} x1={i*41} x2={i*41}
     y1="0" y2={groundY} stroke="#668a9b" opacity=".13"/>)}
   <rect y={groundY} width="740" height="46" fill="#163743"/>
   <line x1="0" y1={groundY} x2="740" y2={groundY} stroke="#80efe0" strokeWidth="2"/>
   {anchors.map((p,i)=><line key={"act"+i}
     x1={xp(p.x)} y1={yp(p.y)} x2={xp(nodes[i].x)} y2={yp(nodes[i].y)}
     stroke="#ffd280" opacity=".8" strokeWidth="1.1" strokeDasharray="4 3"/>)}
   <polygon points={nodes.map(p=>xp(p.x)+","+yp(p.y)).join(" ")}
     fill="#3bbac422" stroke="#69e8e2" strokeWidth="2.5" strokeLinejoin="round"/>
   {anchors.map(p=><circle key={"a"+p.id} cx={xp(p.x)} cy={yp(p.y)}
     r="3.2" fill="#eac27d"/>)}
   {nodes.map(p=><circle key={p.id} cx={xp(p.x)} cy={yp(p.y)}
     r="6.6" fill={p.contacting?"#ffbf80":"#36b9dc"}
     stroke={p.contacting?"#ffefc6":"#b5f9fb"} strokeWidth="1"/>)}
   <circle cx={hubX} cy={yp(frame.hub.y)} r="12" fill="#1d3446"
     stroke="#e6fff7" strokeWidth="2.5"/>
   <circle cx={hubX} cy={yp(frame.hub.y)} r="3.5" fill="#8deddd"/>
   <text x="18" y="26" fill="#c1e8e6" fontSize="11" letterSpacing="1.2">
     T={fmt(frame.time,2)} · SHAPE COMMAND={fmt(alpha*100,0)}% · TRAVEL={fmt(frame.hub.x)}
   </text>
   <text x="18" y="374" fill="#a3c5cb" fontSize="10">
     CYAN: MASS NODES · GOLD: ACTUATOR ANCHORS · DASHED: SPRING DEFLECTION
   </text>
 </svg>;
}

function StudyTable({receipt}){
 return <div className="table-scroll"><table className="e6-table">
   <thead><tr><th>MODE</th><th>μ</th><th>TORQUE</th><th>TRAVEL</th>
     <th>POSITIVE ACTUATOR WORK</th><th>NET ACTUATOR WORK</th>
     <th>ENERGY RESIDUAL</th></tr></thead>
   <tbody>{receipt.runs.map(r=><tr key={r.mode+":"+r.mu+":"+r.torque}>
     <td>{titles[r.mode]}</td><td>{fmt(r.mu,2)}</td><td>{fmt(r.torque,1)}</td>
     <td>{fmt(r.metrics?.horizontalTravel)}</td>
     <td>{fmt(r.metrics?.actuatorPositiveWork)}</td>
     <td>{fmt(r.metrics?.actuatorNetWork)}</td>
     <td>{fmt(r.metrics?.energyResidual)}</td>
   </tr>)}</tbody>
 </table></div>;
}

export default function E6Panel(){
 const [mode,setMode]=useState("morph-cycle");
 const [mu,setMu]=useState(0.35);
 const [torque,setTorque]=useState(0.8);
 const [load,setLoad]=useState(2);
 const [trial,setTrial]=useState(null);
 const [receipt,setReceipt]=useState(null);
 const [frame,setFrame]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [trialCount,setTrialCount]=useState(0);
 const [studyCount,setStudyCount]=useState(0);
 const trialDirty=Boolean(trial)&&
   (trial.mode!==mode||trial.mu!==mu||trial.torque!==torque||trial.load!==load);
 const receiptDirty=Boolean(receipt)&&receipt.frozen.load!==load;
 useEffect(()=>{
   if(!playing||!trial||trialDirty)return undefined;
   const timer=setInterval(()=>setFrame(i=>{
     if(i+1>=trial.frames.length){setPlaying(false);return i;}
     return i+1;
   }),65);
   return ()=>clearInterval(timer);
 },[playing,trial,trialDirty]);

 const runTrial=()=>{
   setPlaying(false);
   const r=simulateE6({mode,mu,torque,load,captureFrames:true});
   setTrial(r);setFrame(0);setTrialCount(n=>n+1);
   if(r.numericallyFinite)setPlaying(true);
 };
 const runStudy=()=>{setReceipt(buildE6Receipt({load}));setStudyCount(n=>n+1);};
 const exportStudy=(kind)=>{
   if(!receipt)return;
   const date=receipt.recordedAt.replace(/[:.]/g,"-");
   if(kind==="json")download("phi-morph-e6-"+date+".json",
     JSON.stringify(receipt,null,2)+"\n","application/json");
   else download("phi-morph-e6-"+date+".csv",e6Csv(receipt),"text/csv");
 };
 const m=trial?.metrics;
 return <section className="panel e6-panel" aria-labelledby="e6-title">
   <div className="e1-header"><div>
     <p className="eyebrow">10 / E6 · ACTIVE GEOMETRY EXPERIMENT</p>
     <h2 id="e6-title">The wheel that actually changes shape.</h2>
     <p className="e1-summary">Twenty-four freely moving masses, connected by rim springs
       and controllable body-mounted spoke anchors. Motor torque, ground friction,
       and the energy needed to command a change from round to rounded-square are
       accounted for in one simplified dynamic system.</p>
   </div><span className="pill">{E6_PROTOCOL}</span></div>
   <div className="e1-constraints">
     <span><strong>24</strong> moving rim masses</span>
     <span><strong>24</strong> commanded anchors</span>
     <span><strong>3</strong> shape policies</span>
     <span><strong>18</strong> study cases</span>
     <span><strong>3</strong> negative controls</span>
   </div>
   <div className="e6-workbench">
     <div className="e6-visual">
       <div className="e1-inner-heading"><strong>Animated flexible-rim test rig</strong>
         <span>2D · NORMALIZED MODEL</span></div>
       <Wheel frame={trial?.frames?.[frame]} mode={trial?.drivenMode??mode}/>
       {trial?.frames&&<div className="e3-playback">
         <button disabled={trialDirty} onClick={()=>{
           if(frame>=trial.frames.length-1)setFrame(0);
           setPlaying(p=>!p);
         }}>{playing?"PAUSE II":"PLAY ▶"}</button>
         <input type="range" aria-label="Actuator experiment playback time"
           min="0" max={trial.frames.length-1} value={frame} step="1"
           onChange={e=>{setPlaying(false);setFrame(Number(e.target.value));}}/>
         <span>{frame+1} / {trial.frames.length}</span>
       </div>}
       {trialDirty&&<p className="e1-dirty" role="status">
         Preview conditions changed. Run a new trial for updated motion.</p>}
       <p className="fine-print">The colored anchor targets move in the
         wheel's rotating frame. Actual mass points respond through springs
         and damping, with reaction forces applied back to the hub.
         No pressure vessel or physical material has been modeled.</p>
     </div>
     <div className="e6-controls">
       <div className="e1-inner-heading"><strong>Actuation controls</strong><span>NORMALIZED</span></div>
       <label>Geometry command
         <select value={mode} onChange={e=>setMode(e.target.value)}>
           {E6_MODES.map(id=><option key={id} value={id}>{titles[id]}</option>)}
         </select>
       </label>
       <label>Ground friction μ
         <select value={mu} onChange={e=>setMu(Number(e.target.value))}>
           {E6_FRICTIONS.map(n=><option key={n} value={n}>{n}</option>)}
         </select>
       </label>
       <label>Motor torque command
         <select value={torque} onChange={e=>setTorque(Number(e.target.value))}>
           {E6_TORQUES.map(n=><option key={n} value={n}>{n}</option>)}
         </select>
       </label>
       <label>Downward hub load
         <select value={load} onChange={e=>setLoad(Number(e.target.value))}>
           {E6_LOADS.map(n=><option key={n} value={n}>{n}</option>)}
         </select>
       </label>
       <button className="primary-button e3-full-button" onClick={runTrial}>
         RUN ACTIVE RIM TRIAL ↗</button>
       {m&&<div className="e6-metrics">
         <div><span>Horizontal travel</span><strong>{fmt(m.horizontalTravel)}</strong></div>
         <div><span>Positive actuator work</span><strong>{fmt(m.actuatorPositiveWork)}</strong></div>
         <div><span>Negative actuator work</span><strong>{fmt(m.actuatorNegativeWork)}</strong></div>
         <div><span>Net actuator work</span><strong>{fmt(m.actuatorNetWork)}</strong></div>
         <div><span>Peak actuator force</span><strong>{fmt(m.peakActuatorForce)}</strong></div>
         <div><span>Energy residual</span><strong>{fmt(m.energyResidual)}</strong></div>
         <div><span>Motor work</span><strong>{fmt(m.motorWork)}</strong></div>
         <small>TRIAL #{trialCount} · SIMULATED · NO PHYSICAL VALIDATION</small>
       </div>}
     </div>
   </div>
   <div className="e6-timeline">
     <strong>FROZEN MORPHING SCHEDULE</strong>
     <div className="e6-phase-track">
       <span>0–1 / ROUND</span><span>1–3 / MORPH</span>
       <span>3–4 / HOLD</span><span>4–6 / RETURN</span><span>6–8 / ROUND</span>
     </div>
     <p className="fine-print">The schedule is a time-programmed spring-anchor motion,
       not material changing shape in response to an electric frequency.</p>
   </div>
   <div className="e6-study">
     <div className="e1-header"><div>
       <p className="eyebrow">E6 / CONTROLLED ACTUATOR WORK STUDY</p>
       <h2>Did changing shape cost energy?</h2>
       <p className="e1-summary">Three modes × three friction settings ×
         two motor torques at the selected load. Includes no-ground,
         no-friction, and no-actuation negative controls, plus timestep-halving checks.</p>
     </div></div>
     <div className="button-row">
       <button className="primary-button" onClick={runStudy}>RUN 18-CASE ACTUATION STUDY ↗</button>
       <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("json")}>JSON ↓</button>
       <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("csv")}>CSV ↓</button>
     </div>
     {receiptDirty&&<p className="e1-dirty" role="status">
       Study load changed since the last receipt. Run E6 again to update it.</p>}
     {receipt?<div className="e6-study-results">
       <div className="e6-table-card">
         <div className="e1-inner-heading"><strong>Actuator work comparison</strong>
           <span>SIMULATED · RUN #{studyCount}</span></div>
         <StudyTable receipt={receipt}/>
       </div>
       <div className="e6-audit-card">
         <strong>Negative controls</strong>
         {receipt.negativeControls.map(c=><div key={c.kind}>
           <span>{c.kind}</span>
           <small>normal {fmt(c.normalImpulse)} · friction {fmt(c.frictionImpulse)} ·
             actuator {fmt(c.actuatorNetWork)} · travel {fmt(c.horizontalTravel)}</small>
         </div>)}
         <strong>Numerical sensitivity</strong>
         {receipt.timeStepChecks.map(c=><div key={c.mode}>
           <span>{titles[c.mode]}</span>
           <small>Δ travel: {fmt(c.travelDifference)} · Δ relative energy residual:
             {fmt(c.residualDifference)}</small>
         </div>)}
         <p className="fine-print">This is a numerical timestep check, not
           validation of material strength or predictive accuracy.</p>
       </div>
       <p className="e1-receipt-info">Origin SIMULATED ·
         {new Date(receipt.recordedAt).toLocaleString()} · 18 modeled runs ·
         3 negative controls · 3 sensitivity checks</p>
     </div>:<div className="e1-empty">
       <strong>NO E6 STUDY RECORDED</strong>
       <span>Run the comparison to measure both gross positive and signed net actuator work.</span>
     </div>}
   </div>
   <div className="e2-disclosure">
     <strong>A working simulation, not a working wheel.</strong>
     <p>These points are connected by ideal springs and numerical
       ground-contact forces. Positive work is not electrical energy consumption;
       negative work assumes no particular energy-recovery efficiency.
       Different initial shapes also have different initial rim rest lengths
       and geometry. This study cannot establish a real tire's traction,
       durability, efficiency or safety.</p>
   </div>
 </section>;
}
