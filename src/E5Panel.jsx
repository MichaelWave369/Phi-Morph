import React,{useState} from "react";
import {
  E5_PROTOCOL,E5_COUNTS,E5_STEPS,E5_SHAPES,
  buildE5Receipt,e5Csv,
} from "./e5.js";

const pretty = n => typeof n==="number" && Number.isFinite(n) ? n.toFixed(5) : "N/A";
const names={circle:"Round", "rounded-square":"Rounded square"};
const metrics=[
  {key:"horizontalTravel",label:"Horizontal travel"},
  {key:"relativeEnergyResidual",label:"Relative energy residual"},
  {key:"maxNumericalPenetration",label:"Max numerical overlap"},
  {key:"frictionImpulse",label:"Signed friction impulse"}
];
function download(name,content,mime){
  const u=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function GridMatrix({receipt,metric,focus,setFocus}){
  const data=receipt.runs.map(r=>r.metrics?.[metric]??0);
  const max=Math.max(1e-9,...data.map(Math.abs));
  return (
    <div className="table-scroll">
      <table className="e5-matrix">
        <thead><tr><th>OUTLINE</th><th>POINTS</th>
          {E5_STEPS.map(dt=><th key={dt}>dt = {dt}</th>)}
        </tr></thead>
        <tbody>{E5_SHAPES.flatMap(shape=>E5_COUNTS.map(count=>(
          <tr key={shape+count}>
            <td>{names[shape]}</td><td>{count}</td>
            {E5_STEPS.map(dt=>{
              const run=receipt.runs.find(r=>r.shape===shape&&r.count===count&&r.dt===dt);
              const val=run?.metrics?.[metric];
              const isFocus=focus.shape===shape&&focus.count===count&&focus.dt===dt;
              const alpha=val==null?0.1:0.1+0.55*Math.abs(val)/max;
              return <td key={dt}>
                <button className={"e5-cell"+(isFocus?" selected":"")}
                  aria-pressed={isFocus}
                  title={"Inspect "+names[shape]+", "+count+" nodes, dt "+dt}
                  onClick={()=>setFocus({shape,count,dt})}
                  style={{background:"rgba(76,210,202,"+alpha.toFixed(3)+")"}}>
                  {pretty(val)}
                </button>
              </td>;
            })}
          </tr>
        )))}</tbody>
      </table>
    </div>
  );
}
function Ledger({run}){
  if(!run?.metrics)return <p className="fine-print">No finite ledger data available.</p>;
  const m=run.metrics;
  const items=[
    ["Initial system energy",m.initialEnergy],
    ["Final system energy",m.finalEnergy],
    ["Modeled energy change",m.deltaEnergy],
    ["Motor work",m.motorWork],
    ["Linear drag work",m.translationalDragWork],
    ["Angular drag work",m.angularDragWork],
    ["Tangential friction work",m.frictionWork],
    ["Contact closing damping work",m.normalDampingWork],
  ];
  return (
    <div className="e5-ledger">
      {items.map(([label,n])=>
        <div key={label}><span>{label}</span><strong>{pretty(n)}</strong></div>)}
      <div className="e5-residual"><span>Numerical balance residual</span>
        <strong>{pretty(m.energyBalanceResidual)}</strong></div>
      <div className="e5-residual"><span>Relative residual</span>
        <strong>{pretty(m.relativeEnergyResidual)}</strong></div>
    </div>
  );
}
export default function E5Panel(){
  const [mu,setMu]=useState(0.35);
  const [torque,setTorque]=useState(0.8);
  const [load,setLoad]=useState(2);
  const [receipt,setReceipt]=useState(null);
  const [metric,setMetric]=useState("horizontalTravel");
  const [focus,setFocus]=useState({shape:"circle",count:24,dt:0.005});
  const [runNumber,setRunNumber]=useState(0);
  const dirty=Boolean(receipt)&&
    (receipt.controls.mu!==mu||receipt.controls.torque!==torque||
      receipt.controls.load!==load);
  const run=()=>{
    setReceipt(buildE5Receipt({mu,torque,load}));
    setRunNumber(n=>n+1);
  };
  const exportResult=(fmt)=>{
    if(!receipt)return;
    const suffix=receipt.recordedAt.replace(/[:.]/g,"-");
    if(fmt==="json") download("phi-morph-e5-"+suffix+".json",
      JSON.stringify(receipt,null,2)+"\n","application/json");
    else download("phi-morph-e5-"+suffix+".csv",e5Csv(receipt),"text/csv");
  };
  const selected=receipt?.runs.find(r=>
    r.shape===focus.shape&&r.count===focus.count&&r.dt===focus.dt);
  return (
    <section className="panel e5-panel" aria-labelledby="e5-title">
      <div className="e1-header">
        <div>
          <p className="eyebrow">09 / E5 · NUMERICAL INTEGRITY LAB</p>
          <h2 id="e5-title">Can we trust the simulation numbers?</h2>
          <p className="e1-summary">Compare three timesteps and three rim samplings for
            each fixed wheel shape. Audit modeled energy change against
            recorded motor, friction and damping work. Keep the residual visible.</p>
        </div>
        <span className="pill">{E5_PROTOCOL}</span>
      </div>
      <div className="e1-constraints">
        <span><strong>18</strong> numerical trials</span>
        <span><strong>3</strong> point counts</span>
        <span><strong>3</strong> timesteps</span>
        <span><strong>4</strong> negative controls</span>
        <span><strong>0</strong> real-world validation claims</span>
      </div>
      <div className="e5-controls">
        <label>Friction μ
          <select value={mu} onChange={e=>setMu(Number(e.target.value))}>
            {[0,0.35,0.8].map(n=><option key={n} value={n}>{n}</option>)}
          </select></label>
        <label>Motor torque
          <select value={torque} onChange={e=>setTorque(Number(e.target.value))}>
            {[0,0.8,1.6].map(n=><option key={n} value={n}>{n}</option>)}
          </select></label>
        <label>Downward load
          <select value={load} onChange={e=>setLoad(Number(e.target.value))}>
            {[0.5,1,2,4].map(n=><option key={n} value={n}>{n}</option>)}
          </select></label>
        <button className="primary-button" onClick={run}>RUN E5 INTEGRITY STUDY ↗</button>
        <button className="secondary-button" disabled={!receipt} onClick={()=>exportResult("json")}>JSON ↓</button>
        <button className="secondary-button" disabled={!receipt} onClick={()=>exportResult("csv")}>CSV ↓</button>
      </div>
      <p className="fine-print e5-note">Node resolutions 24, 48 and 96 rescale aggregate
        contact penalties heuristically. All outlines are rigid; increasing nodes
        changes the discrete contact geometry, not tire manufacturing quality.</p>
      {dirty&&<p className="e1-dirty" role="status">
        Settings changed after this receipt. Re-run E5 to update the numerical study.</p>}
      {receipt?<>
        <div className="e5-results-heading">
          <div>
            <h3>Resolution × timestep matrix</h3>
            <p>Click any cell to inspect its corresponding energy ledger. Numbers are dimensionless.</p>
          </div>
          <label>Displayed observable
            <select value={metric} onChange={e=>setMetric(e.target.value)}>
              {metrics.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <div className="e5-grid">
          <GridMatrix receipt={receipt} metric={metric} focus={focus} setFocus={setFocus}/>
        </div>
        <div className="e5-bottom">
          <div className="e5-ledger-panel">
            <div className="e1-inner-heading"><strong>Work / energy ledger</strong>
              <span>{names[focus.shape]} · {focus.count} pts · dt {focus.dt}</span></div>
            <Ledger run={selected}/>
            <p className="fine-print">Energy includes kinetic, external-load potential, and numerical
              floor-spring potential. Residual measures imperfect balance under finite-step integration
              and start-of-step work quadrature. A small residual alone never establishes physical accuracy.</p>
          </div>
          <div className="e5-delta-panel">
            <div className="e1-inner-heading"><strong>dt-halving differences</strong>
              <span>ABSOLUTE HORIZONTAL TRAVEL Δ</span></div>
            <div className="table-scroll"><table className="e5-delta-table">
              <thead><tr><th>SHAPE</th><th>PTS</th><th>.01 vs .005</th><th>.005 vs .0025</th></tr></thead>
              <tbody>{receipt.numericalChecks.map(c=><tr key={c.shape+c.count}>
                <td>{names[c.shape]}</td><td>{c.count}</td>
                <td>{pretty(c.coarseToMediumAbsoluteDelta)}</td>
                <td>{pretty(c.mediumToFineAbsoluteDelta)}</td>
              </tr>)}</tbody>
            </table></div>
            <p className="fine-print">These are observed discretization differences,
              not a proven order of convergence. Identical or small travel deltas
              do not establish convergence of energy, stress or contact dynamics.</p>
            <div className="e5-control-results">
              <strong>Negative controls</strong>
              {receipt.negativeControls.map(c=><div key={c.shape+c.kind}>
                <span>{names[c.shape]} · {c.kind}</span>
                <span>Normal {pretty(c.normalImpulse)} · Friction {pretty(c.frictionImpulse)}
                  · Travel {pretty(c.horizontalTravel)}</span>
              </div>)}
            </div>
          </div>
        </div>
        <p className="e1-receipt-info">E5 RUN #{runNumber} ·
          {new Date(receipt.recordedAt).toLocaleString()} · SIMULATED · NO PHYSICAL VALIDATION</p>
      </>:<div className="e1-empty">
        <strong>NO E5 LEDGER RECEIPT YET</strong>
        <span>Run the 18-case numerical study and four negative controls.</span>
      </div>}
      <div className="e2-disclosure">
        <strong>Energy bookkeeping is not powered morphing.</strong>
        <p>These are fixed, rigid wheel outlines and a discrete penalty-contact solver.
          No material stiffness tuning, water charging, real tire traction, physical
          shape transition, actuator force or transformation cost is present.
          This integrity audit comes before attempting a force-consistent morphing model.</p>
      </div>
    </section>
  );
}
