import React,{useEffect,useState} from "react";
import {
  E7_PROTOCOL,E7_FORCE_LIMITS,E7_STROKES,E7_CYCLES,
  E7_LOADS,E7_FRICTIONS,E7_STRAIN_FLAG,simulateE7,buildE7Receipt,e7Csv
} from "./e7.js";
const format=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):"N/A";
const capLabel=cap=>cap===null?"Uncapped":cap+" normalized force";
function save(name,content,mime){
  const u=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement("a");a.href=u;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1200);
}

function Stage({frame}){
  if(!frame)return <div className="e7-empty"><strong>ACTUATOR LIMIT BENCH / STANDBY</strong>
    <span>Run a constrained morph cycle to visualize independent rim masses and moving targets.</span>
  </div>;
  const sx=39,sy=340,cx=385;
  const X=x=>cx+(x-frame.hub.x)*sx;
  const Y=y=>sy-y*sx;
  return <svg className="e7-svg" viewBox="0 0 770 385" role="img"
    aria-label={"Simulated force-limited flexible rim at t="+frame.time}>
    <defs><radialGradient id="e7Back"><stop stopColor="#153c46"/>
      <stop offset="1" stopColor="#061725"/></radialGradient></defs>
    <rect width="770" height="385" fill="url(#e7Back)"/>
    {Array.from({length:19},(_,i)=><line key={i} x1={i*42} x2={i*42}
      y1="0" y2="340" stroke="#648a9d" opacity=".12"/>)}
    <rect y="340" width="770" height="45" fill="#143d48"/>
    <line x1="0" x2="770" y1="340" y2="340" stroke="#68dfcd" strokeWidth="2"/>
    {frame.anchors.map((a,i)=><line key={"link"+i}
      x1={X(a.x)} y1={Y(a.y)} x2={X(frame.nodes[i].x)} y2={Y(frame.nodes[i].y)}
      stroke="#ffc47a" strokeWidth="1.2" opacity=".75" strokeDasharray="4 3"/>)}
    <polygon points={frame.nodes.map(n=>X(n.x)+","+Y(n.y)).join(" ")}
      stroke="#8cf4e4" strokeWidth="2.4" fill="#36bfc722"/>
    {frame.anchors.map(a=><circle key={"a"+a.id} cx={X(a.x)} cy={Y(a.y)}
      r="3" fill="#ffcb85"/>)}
    {frame.nodes.map(n=><circle key={n.id} cx={X(n.x)} cy={Y(n.y)}
      r="6" fill={n.contacting?"#ffac69":"#3abddd"}
      stroke={n.contacting?"#ffedd2":"#c2fcff"} strokeWidth="1"/>)}
    <circle cx={cx} cy={Y(frame.hub.y)} r="12" stroke="#dcfffa"
      strokeWidth="2.3" fill="#193844"/>
    <circle cx={cx} cy={Y(frame.hub.y)} r="3" fill="#8cebd9"/>
    <text x="16" y="24" fill="#b8e5e6" fontSize="11">
      TIME {format(frame.time,2)} · TRAVEL {format(frame.hub.x)}
    </text>
    <text x="16" y="374" fill="#a1bdc9" fontSize="10">
      CYAN = MASS POINTS · GOLD = ACTUATOR TARGETS · ORANGE = NUMERICAL GROUND CONTACT
    </text>
  </svg>;
}

function CaseTable({receipt,shown}){
  const subset=receipt.cases.filter(c=>c.cycles===shown);
  return <div className="table-scroll"><table className="e7-table">
    <thead><tr><th>FORCE CAP</th><th>STROKE</th><th>TRAVEL</th>
      <th>POSITIVE SERVO WORK</th><th>CAP HIT %</th>
      <th>TRACKING ERROR</th><th>PEAK STRAIN</th><th>ENERGY RESIDUAL</th></tr></thead>
    <tbody>{subset.map(c=><tr key={String(c.forceLimit)+":"+c.stroke}>
      <td>{c.forceLimit??"uncapped"}</td><td>{format(c.stroke,1)}</td>
      <td>{format(c.metrics?.horizontalTravel)}</td>
      <td>{format(c.metrics?.totalPositiveServoWork)}</td>
      <td>{format(c.metrics?.forceCapHitFraction*100,1)}%</td>
      <td>{format(c.metrics?.rmsTrackingErrorProxy)}</td>
      <td>{format(c.metrics?.maxRimStrainProxy)}
        {c.metrics?.strainFlagHeuristic?" †":""}</td>
      <td>{format(c.metrics?.relativeEnergyResidual)}</td>
    </tr>)}</tbody></table></div>;
}

export default function E7Panel(){
 const [forceLimit,setForceLimit]=useState(10);
 const [stroke,setStroke]=useState(1);
 const [cycles,setCycles]=useState(1);
 const [load,setLoad]=useState(2);
 const [mu,setMu]=useState(0.35);
 const [torque,setTorque]=useState(0.8);
 const [preview,setPreview]=useState(null);
 const [receipt,setReceipt]=useState(null);
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [tableCycles,setTableCycles]=useState(1);
 const [trialCount,setTrialCount]=useState(0);
 const [studyCount,setStudyCount]=useState(0);
 const dirty=Boolean(preview)&&(
   preview.forceLimit!==forceLimit||preview.stroke!==stroke||
   preview.cycles!==cycles||preview.load!==load||
   preview.mu!==mu||preview.torque!==torque);
 const sweepDirty=Boolean(receipt)&&(
   receipt.frozen.load!==load||receipt.frozen.mu!==mu||
   receipt.frozen.torque!==torque);
 useEffect(()=>{
   if(!preview||!playing||dirty)return undefined;
   const interval=setInterval(()=>setIndex(previous=>{
     if(previous+1>=preview.frames.length){
       setPlaying(false);return previous;
     }
     return previous+1;
   }),75);
   return ()=>clearInterval(interval);
 },[preview,playing,dirty]);
 const runTrial=()=>{
   setPlaying(false);
   const result=simulateE7({forceLimit,stroke,cycles,load,mu,torque,captureFrames:true});
   setPreview(result);setIndex(0);setTrialCount(n=>n+1);
   if(result.numericallyFinite)setPlaying(true);
 };
 const runStudy=()=>{
   setReceipt(buildE7Receipt({load,mu,torque}));
   setStudyCount(n=>n+1);
 };
 const exportResult=kind=>{
   if(!receipt)return;
   const s=receipt.recordedAt.replace(/[:.]/g,"-");
   if(kind==="json")save("phi-morph-e7-"+s+".json",
     JSON.stringify(receipt,null,2)+"\n","application/json");
   else save("phi-morph-e7-"+s+".csv",e7Csv(receipt),"text/csv");
 };
 const m=preview?.metrics;
 return <section className="panel e7-panel" aria-labelledby="e7-heading">
  <div className="e1-header"><div>
   <p className="eyebrow">11 / E7 · ACTUATOR SATURATION & REPEATED CYCLES</p>
   <h2 id="e7-heading">What happens when the actuators reach their limits?</h2>
   <p className="e1-summary">Bound the applied servo force, limit commanded
     shape-change stroke, and cycle the same flexible rim up to three times.
     Observe the tracking error, deformation, contact and mechanical work.</p>
  </div><span className="pill">{E7_PROTOCOL}</span></div>
  <div className="e1-constraints">
   <span><strong>24</strong> moving mass nodes</span>
   <span><strong>4</strong> force limits</span>
   <span><strong>3</strong> stroke fractions</span>
   <span><strong>1 / 3</strong> cycles</span>
   <span><strong>24</strong> study cases</span>
  </div>
  <div className="e7-workbench">
   <div className="e7-visual">
    <div className="e1-inner-heading"><strong>Capped-actuator morphing rig</strong>
      <span>CONTINUOUS DYNAMICS · NO CYCLE RESET</span></div>
    <Stage frame={preview?.frames?.[index]}/>
    {preview?.frames&&<div className="e3-playback">
      <button disabled={dirty} onClick={()=>{
        if(index===preview.frames.length-1)setIndex(0);
        setPlaying(p=>!p);
      }}>{playing?"PAUSE II":"PLAY ▶"}</button>
      <input aria-label="Morph cycle simulation frame" type="range" min="0"
        max={preview.frames.length-1} value={index} step="1"
        onChange={e=>{setPlaying(false);setIndex(Number(e.target.value));}}/>
      <span>{index+1} / {preview.frames.length}</span>
    </div>}
    {dirty&&<p className="e1-dirty" role="status">Trial settings changed.
       Re-run to see the current controls.</p>}
    <p className="fine-print">Every case begins from the same round wheel and
      the same rim rest lengths. Axial servo forces are capped, with
      equal-and-opposite hub reactions. Point contact is numerical only.</p>
   </div>
   <div className="e7-controls">
    <div className="e1-inner-heading"><strong>Cycle conditions</strong><span>NORMALIZED</span></div>
    <label>Maximum actuator force per node
      <select value={forceLimit===null?"uncapped":String(forceLimit)}
        onChange={e=>setForceLimit(e.target.value==="uncapped"?null:Number(e.target.value))}>
        {E7_FORCE_LIMITS.map(v=><option key={String(v)} value={v===null?"uncapped":v}>
          {capLabel(v)}</option>)}
      </select></label>
    <label>Commanded morph stroke
      <select value={stroke} onChange={e=>setStroke(Number(e.target.value))}>
        {E7_STROKES.map(v=><option key={v} value={v}>{v*100}%</option>)}
      </select></label>
    <label>Continuous cycles
      <select value={cycles} onChange={e=>setCycles(Number(e.target.value))}>
        {E7_CYCLES.map(v=><option key={v} value={v}>{v} cycle{v>1?"s":""}</option>)}
      </select></label>
    <label>Downward hub load
      <select value={load} onChange={e=>setLoad(Number(e.target.value))}>
        {E7_LOADS.map(v=><option key={v} value={v}>{v}</option>)}
      </select></label>
    <label>Ground friction μ
      <select value={mu} onChange={e=>setMu(Number(e.target.value))}>
        {E7_FRICTIONS.map(v=><option key={v} value={v}>{v}</option>)}
      </select></label>
    <label>Motor torque
      <select value={torque} onChange={e=>setTorque(Number(e.target.value))}>
        {[0,0.8].map(v=><option key={v} value={v}>{v}</option>)}
      </select></label>
    <button className="primary-button e3-full-button" onClick={runTrial}>
      RUN LIMITED-ACTUATOR TRIAL ↗</button>
    {m&&<div className="e7-metrics">
      <div><span>Travel</span><strong>{format(m.horizontalTravel)}</strong></div>
      <div><span>Gross positive servo work</span><strong>{format(m.totalPositiveServoWork)}</strong></div>
      <div><span>Negative servo work</span><strong>{format(m.totalNegativeServoWork)}</strong></div>
      <div><span>Maximum applied force</span><strong>{format(m.maxAppliedServoForce)}</strong></div>
      <div><span>Force limit hit fraction</span><strong>{format(m.forceCapHitFraction*100,1)}%</strong></div>
      <div><span>Tracking error RMS</span><strong>{format(m.rmsTrackingErrorProxy)}</strong></div>
      <div><span>Peak rim strain proxy</span><strong>{format(m.maxRimStrainProxy)}</strong></div>
      <div><span>Relative energy residual</span><strong>{format(m.relativeEnergyResidual)}</strong></div>
      <small>TRIAL #{trialCount} · SIMULATED · NOT A PHYSICAL FATIGUE MEASUREMENT</small>
    </div>}
   </div>
  </div>
  {preview?.cycleSummaries&&<div className="e7-cycle-card">
    <div className="e1-inner-heading"><strong>Cycle-by-cycle ledger</strong>
      <span>STATE NEVER RESET BETWEEN CYCLES</span></div>
    <div className="table-scroll"><table className="e7-cycle-table">
      <thead><tr><th>CYCLE</th><th>TRAVEL Δ</th><th>POSITIVE WORK</th>
        <th>NEGATIVE WORK</th><th>FORCE CAP HITS</th><th>PEAK STRAIN PROXY</th></tr></thead>
      <tbody>{preview.cycleSummaries.map(c=><tr key={c.cycle}>
        <td>{c.cycle}</td><td>{format(c.horizontalTravelDelta)}</td>
        <td>{format(c.positiveServoWork)}</td><td>{format(c.negativeServoWork)}</td>
        <td>{c.saturatedNodeSteps}</td><td>{format(c.maxRimStrainProxy)}</td>
      </tr>)}</tbody></table></div>
  </div>}
  <div className="e7-study">
   <div className="e1-header"><div>
     <p className="eyebrow">E7 / SATURATION & REPEATABILITY AUDIT</p>
     <h2>Force budget versus morph response</h2>
     <p className="e1-summary">Four force limits × three command strokes ×
       one or three cycles. Compare tracking error, force saturation and
       actuator work under identical friction, load and torque.</p>
   </div></div>
   <div className="button-row">
     <button className="primary-button" onClick={runStudy}>RUN 24-CASE STUDY ↗</button>
     <button className="secondary-button" disabled={!receipt} onClick={()=>exportResult("json")}>EXPORT JSON ↓</button>
     <button className="secondary-button" disabled={!receipt} onClick={()=>exportResult("csv")}>EXPORT CSV ↓</button>
   </div>
   {sweepDirty&&<p className="e1-dirty" role="status">Study inputs changed.
      Re-run to compare the updated load, friction and torque.</p>}
   {receipt?<div className="e7-results">
     <div className="e7-cycle-toggle"><strong>View sweep length</strong>
       {E7_CYCLES.map(n=><button key={n} className={tableCycles===n?"active":""}
         aria-pressed={tableCycles===n} onClick={()=>setTableCycles(n)}>
         {n} cycle{n===3?"s":""}</button>)}</div>
     <CaseTable receipt={receipt} shown={tableCycles}/>
     <p className="fine-print">† A peak model rim-strain proxy over {E7_STRAIN_FLAG}
       gets a *heuristic* flag. It is NOT a fracture, fatigue or safety prediction.
       Unlimited means no model force cap, not an achievable device.</p>
     <div className="e7-negatives">
       <div className="e1-inner-heading"><strong>Negative-control ledger</strong>
         <span>SIMULATED · RUN #{studyCount}</span></div>
       {receipt.negativeControls.map(c=><div key={c.kind}>
         <strong>{c.kind}</strong>
         <span>Normal {format(c.normalImpulse)} · Friction {format(c.frictionImpulse)}
           · Command work {format(c.commandWork)}</span>
       </div>)}
       <p className="fine-print">dt 0.005 → 0.0025:
         travel Δ {format(receipt.timeStepDiagnostic.travelDelta)},
         relative-residual Δ {format(receipt.timeStepDiagnostic.energyResidualDelta)}.
         These differences do not prove convergence.</p>
     </div>
     <p className="e1-receipt-info">
       {new Date(receipt.recordedAt).toLocaleString()} ·
       ORIGIN SIMULATED · 24 CASES / FOUR CONTROLS · NO PHYSICAL VALIDATION</p>
   </div>:<div className="e1-empty"><strong>NO E7 STUDY YET</strong>
     <span>Run the factorial experiment to compare force-limited shape-change cycles.</span>
   </div>}
  </div>
  <div className="e2-disclosure">
    <strong>Repeated simulated strain is not real-world fatigue life.</strong>
    <p>Actuators here are idealized, bounded axial-force servos. Their work
      is mechanical model work, not battery draw. No physical stroke,
      temperature, membrane, fatigue curve, motor controller, manufacturing
      material, wheel safety certification or realistic road traction is modeled.
      Zero-force and no-command tests remain explicit controls.</p>
  </div>
 </section>;
}
