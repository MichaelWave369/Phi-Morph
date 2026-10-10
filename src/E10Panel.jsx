import React,{useMemo,useState} from "react";
import {
 E10_PROTOCOL,E10_COLUMNS,E10_ARCHITECTURES,E10_MAX_BYTES,
 parseE10Csv,analyzeE10Samples,makeE10SyntheticExample,
 e10SamplesCsv,e10BlankTemplate,
} from "./e10.js";
const n=(v,d=3)=>typeof v==="number"&&Number.isFinite(v)?v.toFixed(d):"N/A";
function save(name,content,mime){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement("a");a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
const fields=[
 {key:"rmsTrackingError_m",title:"Tracking error RMS",unit:"m"},
 {key:"peakAbsForce_N",title:"Peak measured force",unit:"N"},
 {key:"peakAbsElectricalPower_W",title:"Peak sampled electrical power",unit:"W"},
 {key:"positiveElectricalEnergy_J",title:"Positive electrical energy",unit:"J"},
 {key:"negativeElectricalEnergy_J",title:"Negative electrical energy",unit:"J"},
 {key:"positiveMechanicalWork_J",title:"Positive mechanical work",unit:"J"},
 {key:"negativeMechanicalWork_J",title:"Negative mechanical work",unit:"J"},
 {key:"maxTemperature_C",title:"Maximum recorded temperature",unit:"°C"},
];
function SignalPlot({samples}){
 const reduced=useMemo(()=>{
  if(!samples)return [];
  const step=Math.max(1,Math.ceil(samples.length/500));
  const r=samples.filter((_,i)=>i%step===0);
  if(r.at(-1)!==samples.at(-1))r.push(samples.at(-1));
  return r;
 },[samples]);
 if(!samples?.length)return <div className="e10-empty">
  <strong>NO SIGNAL RECORD LOADED</strong>
  <span>Open a local seven-column CSV or use the clearly labeled synthetic demonstration.</span>
 </div>;
 const low=Math.min(...reduced.flatMap(r=>[r.command_m,r.displacement_m]));
 const high=Math.max(...reduced.flatMap(r=>[r.command_m,r.displacement_m]));
 const padding=Math.max(0.0001,(high-low)*.08);
 const minY=low-padding,maxY=high+padding;
 const start=reduced[0].time_s,end=reduced.at(-1).time_s;
 const X=x=>48+(x-start)/(end-start)*603;
 const Y=y=>190-(y-minY)/(maxY-minY)*162;
 const poly=key=>reduced.map(r=>X(r.time_s)+","+Y(r[key])).join(" ");
 return <div className="e10-plot">
   <svg viewBox="0 0 700 246" role="img" aria-label="Uploaded test command and measured displacement in meters">
    {Array.from({length:5},(_,i)=>{
     const p=i/4,val=minY+(maxY-minY)*p;
     return <g key={i}>
      <line x1="48" x2="651" y1={Y(val)} y2={Y(val)}
       stroke="#3c586a" strokeDasharray="4 5"/>
      <text x="40" y={Y(val)+4} fill="#9ebbc6"
       fontSize="9" textAnchor="end">{n(val,4)}</text>
     </g>;
    })}
    <polyline points={poly("command_m")} fill="none"
      stroke="#e5c17e" strokeWidth="2.7" strokeDasharray="6 4"/>
    <polyline points={poly("displacement_m")} fill="none"
      stroke="#78e4db" strokeWidth="2.7"/>
    <text x="350" y="238" textAnchor="middle" fill="#a4c6d1" fontSize="10">
      TIME (s) · GOLD: COMMAND (m) · CYAN: DISPLACEMENT (m)
    </text>
   </svg>
   <p className="fine-print">Trace decimated for display only. Energy and tracking
     calculations use all parsed samples.</p>
 </div>;
}
export default function E10Panel(){
 const [samples,setSamples]=useState(null);
 const [origin,setOrigin]=useState(null);
 const [filename,setFilename]=useState("");
 const [device,setDevice]=useState("");
 const [calibration,setCalibration]=useState("");
 const [fixtureNote,setFixtureNote]=useState("");
 const [architecture,setArchitecture]=useState("electromechanical");
 const [receipt,setReceipt]=useState(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [lastSession,setLastSession]=useState(0);

 const openFile=async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  setBusy(true);setError("");
  try{
   if(file.size>E10_MAX_BYTES)throw new Error("File exceeds the 1 MB local import limit");
   const text=await file.text();
   const parsed=parseE10Csv(text);
   setSamples(parsed);setOrigin("USER_SUPPLIED_UNVERIFIED");
   setFilename(file.name);setReceipt(null);setLastSession(s=>s+1);
  }catch(e){
   setError(String(e?.message||e));setSamples(null);setOrigin(null);setReceipt(null);
  }finally{
   setBusy(false);event.target.value="";
  }
 };
 const loadExample=()=>{
   setSamples(makeE10SyntheticExample());
   setOrigin("SIMULATED");
   setFilename("SIMULATED-e10-example.csv");
   setReceipt(null);setError("");setLastSession(s=>s+1);
 };
 const analyze=()=>{
   if(!samples||!origin)return;
   try{
    setReceipt(analyzeE10Samples(samples,{origin,filename,
      deviceLabel:device,calibrationReference:calibration,fixtureNote}));
    setError("");
   }catch(e){setError(String(e?.message||e));setReceipt(null);}
 };
 const receiptDirty=Boolean(receipt)&&(
   (receipt.source.filename??"")!==filename.trim()||
   (receipt.source.deviceLabel??"")!==device.trim()||
   (receipt.source.calibrationReference??"")!==calibration.trim()||
   (receipt.source.fixtureNote??"")!==fixtureNote.trim());
 const makeReceipt=()=>{if(receipt)save("phi-morph-e10-"+lastSession+".json",
   JSON.stringify(receipt,null,2)+"\n","application/json");};
 const arch=E10_ARCHITECTURES.find(x=>x.id===architecture);
 return <section className="panel e10-panel" aria-labelledby="e10-title">
  <div className="e1-header"><div>
   <p className="eyebrow">14 / E10 · SI BENCH DATA & EVIDENCE GATE</p>
   <h2 id="e10-title">From simulated actuators to independently checkable measurements.</h2>
   <p className="e1-summary">Plan the physical actuator options, prepare an SI
     measurement file, and audit time, force, displacement, electrical signals
     and temperature without treating a file upload as proof of calibration.</p>
  </div><span className="pill">{E10_PROTOCOL}</span></div>
  <div className="e1-constraints">
   <span><strong>7</strong> SI data channels</span>
   <span><strong>3</strong> actuator architecture candidates</span>
   <span><strong>10k</strong> sample limit</span>
   <span><strong>0</strong> automatic verification upgrades</span>
  </div>
  <div className="e10-architecture">
   <div className="e1-inner-heading"><strong>Candidate actuator architecture</strong>
     <span>RESEARCH OPTIONS · NO HARDWARE SELECTED</span></div>
   <div className="e10-arch-select">
    {E10_ARCHITECTURES.map(x=><button key={x.id}
      className={architecture===x.id?"e10-selected":""}
      aria-pressed={architecture===x.id}
      onClick={()=>setArchitecture(x.id)}>{x.name}</button>)}
   </div>
   <div className="e10-arch-info">
    <div><span>Possible drive</span><strong>{arch.drive}</strong></div>
    <div><span>Additional measurements</span><strong>{arch.measure}</strong></div>
    <div><span>Unresolved engineering questions</span><strong>{arch.unknown}</strong></div>
   </div>
   <p className="fine-print">Selection here is a planning aid only. The uploaded
     seven-column schema captures a shared minimum signal set, not every
     required channel for all three mechanisms.</p>
  </div>
  <div className="e10-workbench">
   <div className="e10-data-panel">
    <div className="e1-inner-heading"><strong>Local CSV evidence inspection</strong>
      <span>NO CONNECTED SENSOR / NO SERVER UPLOAD</span></div>
    <div className="e10-buttons">
     <label className="e10-file-picker">
      <input type="file" accept=".csv,text/csv" onChange={openFile}
        aria-label="Choose locally stored SI measurement CSV"/>
      {busy?"READING…":"CHOOSE MEASUREMENT CSV"}
     </label>
     <button className="secondary-button" onClick={()=>save(
      "phi-morph-e10-blank-template.csv",e10BlankTemplate(),"text/csv")}>
      BLANK TEMPLATE ↓</button>
     <button className="secondary-button" onClick={loadExample}>
      USE SIMULATED EXAMPLE</button>
     {samples&&<button className="secondary-button" onClick={()=>save(
      origin==="SIMULATED"?"SIMULATED-e10-example.csv":"e10-inspected-rows.csv",
      e10SamplesCsv(samples),"text/csv")}>SAMPLE CSV ↓</button>}
    </div>
    <p className="e10-columns">{E10_COLUMNS.join(" · ")}</p>
    <SignalPlot samples={samples}/>
    {samples&&<div className="e10-source-line">
      <strong>{origin==="SIMULATED"?"SYNTHETIC DEMONSTRATION":"USER-SUPPLIED / UNVERIFIED"}</strong>
      <span>{samples.length} samples · {filename}</span>
    </div>}
    {error&&<p className="e10-error" role="alert">{error}</p>}
   </div>
   <div className="e10-meta-panel">
    <div className="e1-inner-heading"><strong>Source notes</strong><span>CLAIMS · UNVERIFIED</span></div>
    <label>Device identifier / rig label
      <input value={device} maxLength={300} onChange={e=>setDevice(e.target.value)}
        placeholder="Actuator and fixture identifier"/></label>
    <label>Calibration record reference
      <input value={calibration} maxLength={300}
       onChange={e=>setCalibration(e.target.value)}
       placeholder="Reference only, not independently checked"/></label>
    <label>Test setup notes
      <textarea value={fixtureNote} maxLength={300}
       onChange={e=>setFixtureNote(e.target.value)}
       placeholder="Load, mounting, sensor convention, test procedure" rows={3}/></label>
    <button className="primary-button e3-full-button"
      disabled={!samples||busy} onClick={analyze}>ANALYZE SI SIGNALS ↗</button>
    <button className="secondary-button e3-full-button"
      disabled={!receipt} onClick={makeReceipt}>EXPORT JSON RECEIPT ↓</button>
    <p className="fine-print">A calibration ID typed here is a claim,
     not evidence that the sensor was calibrated. Signed work and power
     do not imply verified electrical efficiency or regeneration.</p>
   </div>
  </div>
  {receipt&&<div className="e10-report">
   <div className="e1-inner-heading"><strong>Signal ledger</strong>
    <span>{receipt.origin} · {receipt.sampleCount} RECORDS</span></div>
   {receiptDirty&&<p className="e1-dirty">Source notes have changed since this
      receipt. Analyze again to refresh the exported metadata.</p>}
   <div className="e10-metrics">
    {fields.map(f=><div key={f.key}><span>{f.title}</span>
      <strong>{n(receipt.metrics[f.key])} {f.unit}</strong></div>)}
   </div>
   <div className="e10-quality">
    <strong>Validation boundaries</strong>
    <p>Time ordered: Yes · Sampling nonuniform:
      {receipt.quality.nonuniformSampling?" Yes":" No"} ·
      Sensors independently calibrated: No ·
      Efficiency calculation eligible: No</p>
    <p>Origin: {receipt.origin} · Verification: {receipt.verification}.
      No conversion of the dimensionless E9 simulator into SI quantities
      has been authorized by this report.</p>
   </div>
  </div>}
  <div className="e2-disclosure">
   <strong>Data ingestion is not physical verification.</strong>
   <p>This tool reads local files for inspection and does not connect to
     motors or test hardware. SI headers can be incorrectly labeled;
     polarity, uncertainty, fixture geometry, calibration history, and
     synchronization must be independently confirmed. No uploaded file
     is automatically promoted to OBSERVED or VERIFIED, and no tire
     safety or mechanical efficiency claim is produced.</p>
  </div>
 </section>;
}
