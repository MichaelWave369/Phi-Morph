import React, { useEffect, useState } from "react";
import { DEFAULTS, GEOMETRIES } from "./model.js";
import { normalizedLayout, regularEdges } from "./e1.js";
import {
  E3_LOADS, E3_SURFACES, E3_RADIUS, E3_PROTOCOL,
  simulateE3, buildE3Receipt, e3Csv,
} from "./e3.js";

const LINKS = regularEdges(normalizedLayout("ring"));
const fmt = (v, digits = 3) => typeof v === "number" && Number.isFinite(v) ?
  v.toFixed(digits) : "N/A";

function exportFile(name, contents, mime) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BenchView({ snapshot }) {
  const px = (x) => 350 + x * 36;
  const py = (y) => 294 - y * 36;
  if (!snapshot) {
    return (
      <div className="e3-empty-view">
        <strong>CONTACT BENCH / STANDBY</strong>
        <small>Choose a shape, force and surface, then run a contact trial.</small>
      </div>
    );
  }
  return (
    <svg viewBox="0 0 700 330" role="img" className="e3-svg"
      aria-label={"Simulated flexible node shell contacting a flat floor at time " + snapshot.time}>
      <defs>
        <linearGradient id="e3Floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#183d4d" />
          <stop offset="100%" stopColor="#102230" />
        </linearGradient>
      </defs>
      {Array.from({ length: 17 }, (_, i) => (
        <line key={i} x1={30 + 40 * i} x2={30 + 40 * i}
          y1="0" y2="294" stroke="#365466" strokeWidth=".6" opacity=".25" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="0" x2="700" y1={20 + 38 * i} y2={20 + 38 * i}
          stroke="#365466" strokeWidth=".6" opacity=".25" />
      ))}
      <rect x="0" y="294" width="700" height="36" fill="url(#e3Floor)" />
      <line x1="0" x2="700" y1="294" y2="294" stroke="#70e7d7" strokeWidth="2" />
      <text x="16" y="317" fill="#a5c3ce" fontSize="10" letterSpacing="1.5">
        GROUND Y=0 · COMPRESSION-ONLY PENALTY CONTACT
      </text>
      {LINKS.map((edge) => (
        <line key={edge.a + ":" + edge.b}
          x1={px(snapshot.nodes[edge.a].x)} y1={py(snapshot.nodes[edge.a].y)}
          x2={px(snapshot.nodes[edge.b].x)} y2={py(snapshot.nodes[edge.b].y)}
          stroke="#5d91b7" strokeWidth="1" opacity=".58" />
      ))}
      {snapshot.nodes.map((node) => (
        <line key={"spoke-"+node.id} x1={350} y1={py(snapshot.hubY)}
          x2={px(node.x)} y2={py(node.y)}
          stroke="#7ad7c7" strokeWidth=".9" strokeDasharray="4 4" opacity=".4" />
      ))}
      {snapshot.nodes.map((node) => (
        <g key={node.id}>
          {node.touching && (
            <line x1={px(node.x)} y1={294} x2={px(node.x)} y2={py(node.y)}
              stroke="#ffc27b" strokeWidth="3" opacity=".8" />
          )}
          <circle cx={px(node.x)} cy={py(node.y)} r={E3_RADIUS * 36}
            fill={node.touching ? "#ffbe76" : "#3cb9d8"}
            fillOpacity=".85" stroke={node.touching ? "#fff0c4" : "#a4effa"} strokeWidth="1.1" />
          <circle cx={px(node.x)} cy={py(node.y)} r="2" fill="#e9ffff" opacity=".8" />
        </g>
      ))}
      <circle cx="350" cy={py(snapshot.hubY)} r="13" fill="#172f40"
        stroke="#9ff6e9" strokeWidth="2.5" />
      <circle cx="350" cy={py(snapshot.hubY)} r="4" fill="#80eadb" />
      <text x="366" y={py(snapshot.hubY) - 13} fill="#a4eee3" fontSize="10">HUB</text>
      <text x="17" y="25" fill="#9abfc8" fontSize="11" letterSpacing="1.2">
        T = {fmt(snapshot.time, 2)} · {snapshot.nodes.filter((n) => n.touching).length} BOTTOM CONTACTS
      </text>
    </svg>
  );
}

function DataTable({ receipt }) {
  return (
    <div className="table-scroll">
      <table className="e3-table"><thead>
        <tr><th>SHAPE</th><th>FLOOR</th><th>LOAD</th><th>HUB DROP</th>
          <th>MAX OVERLAP</th><th>LATE NORMAL FORCE</th><th>CONTACT NODES</th></tr>
      </thead><tbody>
        {receipt.cases.map((row) => (
          <tr key={row.geometry + row.surface + row.load}>
            <td>{GEOMETRIES.find((g) => g.id === row.geometry)?.label}</td>
            <td>{row.surface}</td><td>{fmt(row.load, 1)}</td>
            <td>{fmt(row.metrics?.hubDrop)}</td>
            <td>{fmt(row.metrics?.peakPenetration)}</td>
            <td>{fmt(row.metrics?.lateMeanNormalReaction)}</td>
            <td>{row.metrics?.finalContactNodes ?? "N/A"}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

export default function E3Panel({ params = DEFAULTS }) {
  const [geometry, setGeometry] = useState("ring");
  const [surface, setSurface] = useState("soft");
  const [load, setLoad] = useState(2);
  const [preview, setPreview] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [scanCount, setScanCount] = useState(0);

  const previewDirty = Boolean(preview) && (
    preview.geometry !== geometry || preview.surface !== surface ||
    preview.parameters.load !== load ||
    ["pressure","stiffness","damping","frequency"].some((key) =>
      preview.parameters[key] !== params[key])
  );
  const sweepDirty = Boolean(receipt) &&
    JSON.stringify(receipt.parameters) !== JSON.stringify(params);

  useEffect(() => {
    if (!playing || !preview || previewDirty) return undefined;
    const interval = setInterval(() => setPreviewIndex((current) => {
      if (current + 1 >= preview.frames.length) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    }), 110);
    return () => clearInterval(interval);
  }, [playing, preview, previewDirty]);

  const runPreview = () => {
    setPlaying(false);
    const result = simulateE3(geometry, { ...params, load }, {
      surface, saveFrames: true,
    });
    setPreview(result);
    setPreviewIndex(0);
    setRunCount((count) => count + 1);
    if (result.numericallyFinite) setPlaying(true);
  };
  const runScan = () => {
    setReceipt(buildE3Receipt(params));
    setScanCount((count) => count + 1);
  };
  const exportResult = (format) => {
    if (!receipt) return;
    const stamp = receipt.recordedAt.replace(/[:.]/g, "-");
    if (format === "json") exportFile(
      "phi-morph-e3-" + stamp + ".json",
      JSON.stringify(receipt, null, 2) + "\n", "application/json"
    );
    else exportFile(
      "phi-morph-e3-" + stamp + ".csv", e3Csv(receipt), "text/csv"
    );
  };

  const frame = preview?.frames?.[previewIndex] ?? null;
  return (
    <section className="panel e3-panel" aria-labelledby="e3-title">
      <div className="e1-header">
        <div>
          <p className="eyebrow">07 / E3 · MORPHWHEEL GROUND BENCH</p>
          <h2 id="e3-title">Where a flexible structure meets the ground.</h2>
          <p className="e1-summary">A freely moving vertical hub, 24 spring-linked points and a
            unilateral flat-floor reaction. Watch the shell compress under a normalized load,
            then run a controlled surface-stiffness comparison.</p>
        </div>
        <span className="pill">{E3_PROTOCOL}</span>
      </div>
      <div className="e1-constraints">
        <span><strong>24</strong> spring nodes</span>
        <span><strong>48</strong> indexed links</span>
        <span><strong>2</strong> penalty-floor stiffnesses</span>
        <span><strong>24</strong> contact trials</span>
        <span><strong>3</strong> no-contact controls</span>
      </div>
      <div className="e3-bench-layout">
        <div className="e3-stage">
          <div className="e1-inner-heading"><strong>Animated contact solver</strong>
            <span>2D · NOT A ROTATING WHEEL</span></div>
          <BenchView snapshot={frame} />
          {preview?.numericallyFinite && (
            <div className="e3-playback">
              <button onClick={() => {
                if (previewIndex === preview.frames.length - 1) setPreviewIndex(0);
                setPlaying((p) => !p);
              }} disabled={previewDirty}>
                {playing ? "PAUSE II" : "PLAY ▶"}
              </button>
              <input type="range" min="0" max={preview.frames.length - 1} step="1"
                aria-label="Contact simulation playback frame"
                value={previewIndex}
                onChange={(e) => { setPlaying(false); setPreviewIndex(Number(e.target.value)); }} />
              <span>{previewIndex + 1} / {preview.frames.length}</span>
            </div>
          )}
          <div className="e3-legend">
            <span><i className="e3-dot e3-water" /> Virtual shell nodes</span>
            <span><i className="e3-dot e3-contact" /> Nodes touching floor</span>
            <span><i className="e3-dot e3-ground" /> Contact constraint</span>
          </div>
          {previewDirty && <p className="e1-dirty" role="status">Trial settings changed.
            Run another preview before interpreting the visualization.</p>}
        </div>
        <div className="e3-setup">
          <div className="e1-inner-heading"><strong>Trial settings</strong><span>DIMENSIONLESS</span></div>
          <label>Shell geometry<select value={geometry} onChange={(e) => setGeometry(e.target.value)}>
            {GEOMETRIES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select></label>
          <label>Floor penalty stiffness<select value={surface} onChange={(e) => setSurface(e.target.value)}>
            <option value="soft">Soft floor (k={E3_SURFACES.soft.stiffness})</option>
            <option value="firm">Firm floor (k={E3_SURFACES.firm.stiffness})</option>
          </select></label>
          <label>Downward hub load<select value={load} onChange={(e) => setLoad(Number(e.target.value))}>
            {E3_LOADS.map((n) => <option key={n} value={n}>{n.toFixed(1)} normalized</option>)}
          </select></label>
          <button className="primary-button e3-full-button" onClick={runPreview}>RUN CONTACT PREVIEW ↗</button>
          <p className="fine-print">Pressure, stiffness, damping and frequency use the upper sliders.
            No physical pressure, power, traction, braking or water material is modeled.</p>
          {preview?.metrics && (
            <div className="e3-metrics">
              <div><span>Hub drop</span><strong>{fmt(preview.metrics.hubDrop)}</strong></div>
              <div><span>Peak numerical overlap</span><strong>{fmt(preview.metrics.peakPenetration)}</strong></div>
              <div><span>Late mean ground force</span><strong>{fmt(preview.metrics.lateMeanNormalReaction)}</strong></div>
              <div><span>Final contacting nodes</span><strong>{preview.metrics.finalContactNodes}</strong></div>
              <div><span>Late mean force / applied load</span><strong>{fmt(preview.metrics.lateNormalToLoadRatio)}</strong></div>
              <small>SIMULATED TRIAL #{runCount}. Load balance is NOT guaranteed;
                an oscillating system may never reach equilibrium during this run.</small>
            </div>
          )}
        </div>
      </div>
      <div className="e3-sweep">
        <div className="e1-header"><div>
          <p className="eyebrow">E3 / CONTACT VALIDATION CONTROLS</p>
          <h2>Floor response sweep</h2>
          <p className="e1-summary">Three layouts × two numerical floor stiffnesses × four loads.
            Three matching no-floor controls must show zero ground reaction.</p>
        </div></div>
        <div className="button-row">
          <button className="primary-button" onClick={runScan}>RUN 24-CASE STUDY ↗</button>
          <button className="secondary-button" disabled={!receipt} onClick={() => exportResult("json")}>EXPORT JSON ↓</button>
          <button className="secondary-button" disabled={!receipt} onClick={() => exportResult("csv")}>EXPORT CSV ↓</button>
        </div>
        {sweepDirty && <p className="e1-dirty" role="status">
          Source sliders have changed since the sweep. Run another study to update the receipt.
        </p>}
        {receipt ? (
          <>
            <div className="e3-control-strip">
              {receipt.noContactControls.map((control) => (
                <div key={control.geometry}><span>{control.geometry} / NO FLOOR</span>
                  <strong>{fmt(control.normalReaction)} reaction</strong></div>
              ))}
            </div>
            <div className="e3-data-block">
              <div className="e1-inner-heading"><strong>24 simulated load × floor cases</strong>
                <span>RUN #{scanCount} · SIMULATED</span></div>
              <DataTable receipt={receipt} />
            </div>
            <p className="e1-receipt-info">E3 receipt {new Date(receipt.recordedAt).toLocaleString()}
              · 24 contact runs and three no-contact negative controls · NO PHYSICAL VALIDATION</p>
          </>
        ) : <div className="e1-empty"><strong>NO E3 SWEEP YET</strong>
          <span>Run the study to produce normalized ground force and numerical overlap diagnostics.</span>
        </div>}
      </div>
      <div className="e2-disclosure">
        <strong>Ground contact is not tire traction.</strong>
        <p>Each virtual cell is a point with a fixed numerical radius. The floor supplies upward
          repulsion only while that cell overlaps the flat plane. There is no rolling, tire tread,
          friction law, membrane, liquid, calibrated material stiffness or physical load capacity.
          An overlap or contact-span number must never be advertised as real tire deformation
          or a braking advantage.</p>
      </div>
    </section>
  );
}
