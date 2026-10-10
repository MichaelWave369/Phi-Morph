import React, { useEffect, useMemo, useState } from "react";
import {
  E4_PROTOCOL, E4_SHAPES, E4_FRICTIONS, E4_TORQUES, E4_LOADS,
  E4_RADIUS, simulateE4, buildE4Receipt, e4Csv,
} from "./e4.js";

const nice = (n, digits = 3) => Number.isFinite(n) ? n.toFixed(digits) : "N/A";
const shapeLabel = (s) => s === "circle" ? "Round" : "Rounded square";

function save(name, content, mime) {
  const uri = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = uri; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 1000);
}

function WheelStage({ frame }) {
  if (!frame) return (
    <div className="e4-await">
      <strong>MORPHWHEEL / ROLLING CONTACT RIG</strong>
      <span>Select a preset, friction and torque, then run the simulated trial.</span>
    </div>
  );
  const centerX = 350, groundY = 328, unit = 41;
  const x = (v) => centerX + (v - frame.hub.x) * unit;
  const y = (v) => groundY - v * unit;
  const nodes = frame.nodes;
  const wheelOutline = nodes.map(p => x(p.x) + "," + y(p.y)).join(" ");
  const roadOffset = ((frame.hub.x % 1) + 1) % 1;
  return (
    <svg viewBox="0 0 700 372" role="img"
      aria-label={"Discrete-contact rotating wheel at normalized time " + frame.time}
      className="e4-svg">
      <defs>
        <radialGradient id="e4Background" cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#163d4a"/><stop offset="1" stopColor="#071724"/>
        </radialGradient>
        <linearGradient id="e4FloorFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#275060"/><stop offset="1" stopColor="#112534"/>
        </linearGradient>
      </defs>
      <rect width="700" height="372" fill="url(#e4Background)" />
      {Array.from({length:17}, (_,i) =>
        <line key={"bg"+i} x1={35+i*40} x2={35+i*40} y1="0" y2={groundY}
          stroke="#65859b" opacity=".12" strokeWidth="1" />)}
      <rect y={groundY} width="700" height="44" fill="url(#e4FloorFill)" />
      <line x1="0" y1={groundY} x2="700" y2={groundY} stroke="#7ceade" strokeWidth="2" />
      {Array.from({length:20}, (_,i) => {
        const xx = x((i-9) + roadOffset - 0.5);
        return <path key={i} d={"M"+xx+" "+(groundY+8)+"l-12 14"}
          stroke="#65939e" strokeWidth="1.2" opacity=".6"/>;
      })}
      <polygon points={wheelOutline} fill="#3ba8cc18"
        stroke="#71dce7" strokeWidth="2.5" strokeLinejoin="round" />
      {nodes.map((p,i) =>
        <line key={"s"+p.id} x1={centerX} y1={y(frame.hub.y)}
          x2={x(p.x)} y2={y(p.y)}
          stroke="#66e4ce" opacity={i % 3 === 0 ? ".58" : ".2"} strokeWidth="1.2" />)}
      {nodes.map(p =>
        <g key={p.id}>
          {p.contact && <line x1={x(p.x)} y1={groundY} x2={x(p.x)}
            y2={y(p.y)} stroke="#ffbc6b" strokeWidth="4" />}
          <circle cx={x(p.x)} cy={y(p.y)} r={E4_RADIUS * unit}
            fill={p.contact ? "#eeb46e" : "#3fbbdf"}
            fillOpacity=".9" stroke={p.contact ? "#ffe8ad" : "#a2ebef"}
            strokeWidth="1" />
        </g>)}
      <circle cx={centerX} cy={y(frame.hub.y)} r="12" fill="#112d3b"
        stroke="#c2faf0" strokeWidth="2.6" />
      <circle cx={centerX} cy={y(frame.hub.y)} r="4" fill="#9cf5e7" />
      <text x="15" y="24" fill="#a4cad2" fontSize="11" letterSpacing="1">
        TIME {nice(frame.time, 2)} · TRAVEL {nice(frame.hub.x)} · ANGLE {nice(frame.hub.angle*180/Math.PI, 1)}°
      </text>
      <text x="15" y="361" fill="#9ebfcb" fontSize="10" letterSpacing="1">
        VIRTUAL FLAT GROUND · NO TREAD / NO CONTINUOUS EDGE CONTACT
      </text>
    </svg>
  );
}

function TravelMatrix({ receipt }) {
  const max = Math.max(0.01, ...receipt.cases.map(c => Math.abs(c.metrics?.horizontalTravel ?? 0)));
  return (
    <div className="table-scroll">
      <table className="e4-matrix-table">
        <thead><tr><th>SHAPE</th><th>FRICTION μ</th>
          {E4_TORQUES.map(t => <th key={t}>TORQUE {t.toFixed(1)}</th>)}</tr></thead>
        <tbody>{E4_SHAPES.flatMap(shape => E4_FRICTIONS.map(mu => (
          <tr key={shape+":"+mu}>
            <td>{shapeLabel(shape)}</td><td>{nice(mu, 2)}</td>
            {E4_TORQUES.map(torque => {
              const found = receipt.cases.find(c => c.shape === shape && c.mu === mu && c.torque === torque);
              const travel = found?.metrics?.horizontalTravel;
              return <td key={torque}>
                <div className="e4-travel-cell"
                  style={{background:"rgba(84,216,205,"+(0.10+0.56*Math.abs(travel??0)/max).toFixed(3)+")"}}
                  title={"Normalized horizontal travel: "+nice(travel,6)}>{nice(travel)}</div>
              </td>;
            })}
          </tr>
        )))}</tbody>
      </table>
    </div>
  );
}

export default function E4Panel() {
  const [shape,setShape] = useState("circle");
  const [mu,setMu] = useState(0.35);
  const [torque,setTorque] = useState(0.8);
  const [load,setLoad] = useState(2);
  const [preview,setPreview] = useState(null);
  const [playing,setPlaying] = useState(false);
  const [frameIndex,setFrameIndex] = useState(0);
  const [receipt,setReceipt] = useState(null);
  const [runCount,setRunCount] = useState(0);
  const [studyCount,setStudyCount] = useState(0);
  const previewDirty = Boolean(preview) && (
    preview.shape !== shape || preview.mu !== mu ||
    preview.torque !== torque || preview.load !== load);
  const receiptDirty = Boolean(receipt) && receipt.design.load !== load;

  useEffect(() => {
    if (!playing || !preview || previewDirty) return undefined;
    const interval = setInterval(() => {
      setFrameIndex(i => {
        if (i + 1 >= preview.frames.length) {
          setPlaying(false); return i;
        }
        return i + 1;
      });
    }, 85);
    return () => clearInterval(interval);
  }, [playing, preview, previewDirty]);

  const runPreview = () => {
    setPlaying(false);
    const next = simulateE4({shape,mu,torque,load,captureFrames:true});
    setPreview(next);
    setFrameIndex(0);
    setRunCount(n=>n+1);
    if (next.numericallyFinite) setPlaying(true);
  };
  const study = () => {
    setReceipt(buildE4Receipt(load));
    setStudyCount(n=>n+1);
  };
  const exportStudy = (format) => {
    if (!receipt) return;
    const stamp = receipt.recordedAt.replace(/[:.]/g,"-");
    if (format === "json") save("phi-morph-e4-"+stamp+".json",
      JSON.stringify(receipt,null,2)+"\n","application/json");
    else save("phi-morph-e4-"+stamp+".csv",e4Csv(receipt),"text/csv");
  };
  const current = preview?.frames?.[frameIndex] ?? null;
  const metrics = preview?.metrics;
  return (
    <section className="panel e4-panel" aria-labelledby="e4-title">
      <div className="e1-header">
        <div>
          <p className="eyebrow">08 / E4 · MORPHWHEEL ROLLING CONTACT</p>
          <h2 id="e4-title">From ground reaction to rolling motion.</h2>
          <p className="e1-summary">Add hub translation, rotation, motor torque, and
            velocity-regularized tangential friction. Compare a round outline to a
            fixed rounded-square outline under the same normalized conditions.</p>
        </div>
        <span className="pill">{E4_PROTOCOL}</span>
      </div>
      <div className="e1-constraints">
        <span><strong>24</strong> rigid contact points</span>
        <span><strong>2</strong> shape presets</span>
        <span><strong>3</strong> friction controls</span>
        <span><strong>3</strong> torque controls</span>
        <span><strong>18</strong> model cases</span>
      </div>
      <div className="e4-layout">
        <div className="e4-view">
          <div className="e1-inner-heading"><strong>Discrete-contact test rig</strong>
            <span>RIGID PRESET · CLOCKWISE DRIVE</span></div>
          <WheelStage frame={current} />
          {preview?.numericallyFinite && (
            <div className="e3-playback">
              <button disabled={previewDirty} onClick={() => {
                if (frameIndex === preview.frames.length-1) setFrameIndex(0);
                setPlaying(p=>!p);
              }}>{playing ? "PAUSE II" : "PLAY ▶"}</button>
              <input type="range" min={0} max={preview.frames.length-1} step={1}
                value={frameIndex} aria-label="Rolling experiment playback frame"
                onChange={e=>{setPlaying(false);setFrameIndex(Number(e.target.value));}} />
              <span>{frameIndex+1} / {preview.frames.length}</span>
            </div>
          )}
          {previewDirty && <p className="e1-dirty" role="status">
            Preview settings changed. Run a new trial to see current conditions.
          </p>}
          <p className="fine-print">The outline is rigid and its connecting line segments
            are visual only. Only 24 circular contact nodes interact with the floor.
            Rounded square is a preset, not a shape-changing tire.</p>
        </div>
        <div className="e4-setup">
          <div className="e1-inner-heading"><strong>Drive & contact controls</strong><span>NORMALIZED</span></div>
          <label>Wheel outline
            <select value={shape} onChange={e=>setShape(e.target.value)}>
              {E4_SHAPES.map(s=><option key={s} value={s}>{shapeLabel(s)}</option>)}
            </select>
          </label>
          <label>Surface friction coefficient μ
            <select value={mu} onChange={e=>setMu(Number(e.target.value))}>
              {E4_FRICTIONS.map(n=><option key={n} value={n}>{nice(n,2)}{n===0?" · negative control":""}</option>)}
            </select>
          </label>
          <label>Motor torque command
            <select value={torque} onChange={e=>setTorque(Number(e.target.value))}>
              {E4_TORQUES.map(n=><option key={n} value={n}>{nice(n,1)}</option>)}
            </select>
          </label>
          <label>Vertical hub load
            <select value={load} onChange={e=>setLoad(Number(e.target.value))}>
              {E4_LOADS.map(n=><option key={n} value={n}>{nice(n,1)}</option>)}
            </select>
          </label>
          <button className="primary-button e3-full-button" onClick={runPreview}>RUN ROLLING TRIAL ↗</button>
          {metrics && (
            <div className="e3-metrics">
              <div><span>Horizontal travel</span><strong>{nice(metrics.horizontalTravel)}</strong></div>
              <div><span>Wheel rotation</span><strong>{nice(metrics.finalAngleDegrees,1)}°</strong></div>
              <div><span>Contact-time fraction</span><strong>{nice(100*metrics.contactTimeFraction,1)}%</strong></div>
              <div><span>Friction impulse</span><strong>{nice(metrics.signedFrictionImpulseProxy)}</strong></div>
              <div><span>Mean contact slip proxy</span><strong>{nice(metrics.meanAbsoluteContactSlipProxy)}</strong></div>
              <div><span>Max numerical overlap</span><strong>{nice(metrics.peakNumericalPenetration)}</strong></div>
              <small>TRIAL #{runCount} · SIMULATED · NO PHYSICAL VALIDATION</small>
            </div>
          )}
        </div>
      </div>
      <div className="e4-sweep">
        <div className="e1-header">
          <div><p className="eyebrow">E4 / FORCE TRANSFER AUDIT</p>
            <h2>Friction × torque comparison</h2>
            <p className="e1-summary">
              Eighteen deterministic cases at the chosen hub load, plus one no-ground
              control per outline. Zero friction and zero torque have explicit baselines.
            </p></div>
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={study}>RUN 18-CASE STUDY ↗</button>
          <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("json")}>EXPORT JSON ↓</button>
          <button className="secondary-button" disabled={!receipt} onClick={()=>exportStudy("csv")}>EXPORT CSV ↓</button>
        </div>
        {receiptDirty && <p className="e1-dirty">Load changed after this receipt. Run the study again.</p>}
        {receipt ? (
          <>
            <div className="e4-matrix-block">
              <div className="e1-inner-heading"><strong>Horizontal travel by friction and drive</strong>
                <span>LOAD {receipt.design.load} · SIMULATED</span></div>
              <TravelMatrix receipt={receipt} />
              <p className="fine-print">Color shows relative magnitude of computed travel, not
                usable traction or braking performance. A no-friction wheel may spin without translating.</p>
            </div>
            <div className="e3-control-strip">
              {receipt.noGroundControls.map(c => <div key={c.shape}>
                <span>{shapeLabel(c.shape)} / NO GROUND</span>
                <strong>{nice(c.normalImpulseProxy)} normal</strong>
              </div>)}
            </div>
            <p className="e1-receipt-info">RUN #{studyCount} ·
              {new Date(receipt.recordedAt).toLocaleString()} · 18 CASES + 2 NEGATIVE CONTROLS ·
              SIMULATED · NO PHYSICAL VALIDATION</p>
          </>
        ) : (
          <div className="e1-empty"><strong>NO ROLLING STUDY YET</strong>
            <span>Run the sweep to inspect torque transmission and both negative controls.</span></div>
        )}
      </div>
      <div className="e2-disclosure">
        <strong>Rigid discrete contacts are not a vehicle tire.</strong>
        <p>The shape remains fixed during each run. Tangential friction is smoothly
          velocity-regularized, with no true static friction, no road texture and no
          realistic tire tread. The experiment does not compute the cost of changing
          shape or demonstrate a useful square wheel. Further resolution and timestep
          controls are necessary before treating even the numeric comparisons as reliable.</p>
      </div>
    </section>
  );
}
