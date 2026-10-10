import React, { useMemo, useState } from "react";
import Scene from "./Scene.jsx";
import E1Panel from "./E1Panel.jsx";
import E2Panel from "./E2Panel.jsx";
import E3Panel from "./E3Panel.jsx";
import {
  DEFAULTS, GEOMETRIES, MODEL_VERSION, PROTOCOL_VERSION,
  buildReceipt, simulate
} from "./model.js";

const controls = [
  { key: "pressure", label: "Cell drive", min: 0, max: 3, step: 0.1, help: "Radial forcing proxy" },
  { key: "stiffness", label: "Link stiffness", min: 0.5, max: 8, step: 0.1, help: "Normalized spring response" },
  { key: "damping", label: "Damping", min: 0.1, max: 4, step: 0.1, help: "Motion dissipation" },
  { key: "load", label: "Downward load", min: 0, max: 4, step: 0.1, help: "Normalized distributed force" },
  { key: "frequency", label: "Drive frequency", min: 0, max: 3, step: 0.1, help: "Cycles per simulation-time unit" },
];

const metricDefs = [
  { key: "rmsDisplacement", label: "RMS displacement", tip: "Normalized distance from initial node locations" },
  { key: "peakSpringStrain", label: "Peak link strain", tip: "Maximum observed relative spring extension or compression" },
  { key: "bottomWidthProxy", label: "Bottom span proxy", tip: "Width among nodes near the bottom; NOT tire contact area" },
  { key: "inputWorkProxy", label: "Drive work proxy", tip: "Integrated absolute forcing times radial velocity; NOT Joules" },
];

function Metric({ label, value, tip }) {
  return (
    <div className="metric" title={tip}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{typeof value === "number" ? value.toFixed(3) : value}</div>
    </div>
  );
}

export default function App() {
  const [geometry, setGeometry] = useState("ring");
  const [params, setParams] = useState({ ...DEFAULTS });
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const result = useMemo(() => simulate(geometry, params), [geometry, params]);

  const updateControl = (key, value) => {
    setParams((previous) => ({ ...previous, [key]: Number(value) }));
  };

  const runComparison = () => {
    const receipt = buildReceipt(params);
    setReceipts((previous) => [receipt, ...previous].slice(0, 8));
    setSelectedReceipt(receipt);
  };

  const downloadReceipt = () => {
    if (!selectedReceipt) return;
    const blob = new Blob([JSON.stringify(selectedReceipt, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "phi-morph-" + selectedReceipt.recordedAt.replace(/[:.]/g, "-") + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">Φ</div><div><b>PHI-MORPH</b><small>ADAPTIVE SHELL LABORATORY</small></div></div>
        <div className="header-right"><span className="signal"><i /> EXPLORATORY MODEL</span><a href="https://github.com/MichaelWave369/Phi-Morph" target="_blank" rel="noreferrer">GITHUB ↗</a></div>
      </header>

      <main className="container">
        <section className="hero">
          <div><p className="eyebrow">EXPERIMENTS E0 + E1 + E2 + E3 / PROGRAMMABLE STRUCTURES</p>
            <h1>What if a machine could <em>reshape itself?</em></h1>
            <p className="lede">Explore 24 linked, pressure-driven virtual cells across circular, golden-angle and nested geometries. Make a hypothesis. Compare the controls. Keep the receipt.</p>
          </div>
          <div className="hero-stat"><span>24</span><small>SIMULATED CELLS<br/>THREE STRUCTURAL LAYOUTS</small></div>
        </section>

        <div className="warning"><strong>SIMULATION, NOT PHYSICAL PROOF.</strong> The solver is a dimensionless spring-network demonstration. It does not simulate actual water, electroresponsive fluids, tire traction, real structural stress or frequency-induced solidification.</div>

        <section className="workbench">
          <div className="panel viewport-panel">
            <div className="panel-heading"><div><p className="eyebrow">01 / GEOMETRY ENGINE</p><h2>Cell assembly</h2></div><span className="pill">3D VIEW · DRAG TO ROTATE</span></div>
            <div className="viewport">
              <div className="viewport-deco">PHI / NETWORK VIEW</div>
              <Scene result={result} pressure={params.pressure} />
              <div className="axis-hint">ORIGIN POINTS ● &nbsp; • &nbsp; ACTIVE CELLS ◉</div>
            </div>
            <div className="tabs" role="group" aria-label="Cell geometry">
              {GEOMETRIES.map((item) => (
                <button key={item.id} className={geometry === item.id ? "tab active" : "tab"}
                  aria-pressed={geometry === item.id} onClick={() => setGeometry(item.id)}>
                  <strong>{item.label}</strong><span>{item.detail}</span>
                </button>
              ))}
            </div>
            <div className="legend">
              <span><i className="dot turquoise"/> Fluid-cell proxy</span>
              <span><i className="dot blue"/> Spring links</span>
              <span><i className="dot gray"/> Reference nodes</span>
            </div>
          </div>

          <aside className="panel control-panel">
            <div className="panel-heading"><div><p className="eyebrow">02 / PARAMETERS</p><h2>Drive conditions</h2></div><button className="text-button" onClick={() => setParams({ ...DEFAULTS })}>RESET</button></div>
            <p className="panel-description">Change any control to recompute the current geometry. All values are normalized, not material or engineering units.</p>
            <div className="slider-stack">
              {controls.map((item) => (
                <label key={item.key} className="slider-control">
                  <div className="slider-top"><span>{item.label}</span><output>{params[item.key].toFixed(1)}</output></div>
                  <input aria-label={item.label} type="range" min={item.min} max={item.max} step={item.step}
                    value={params[item.key]} onChange={(e) => updateControl(item.key, e.target.value)} />
                  <small>{item.help}</small>
                </label>
              ))}
            </div>
            <div className="runtime">
              <div><span>MODEL</span><strong>{MODEL_VERSION}</strong></div>
              <div><span>PROTOCOL</span><strong>{PROTOCOL_VERSION}</strong></div>
              <div><span>SOLVER</span><strong>320 STEPS / Δt 0.02</strong></div>
            </div>
          </aside>
        </section>

        <section className="results panel">
          <div className="panel-heading"><div><p className="eyebrow">03 / LIVE DIAGNOSTICS</p><h2>{GEOMETRIES.find((g) => g.id === geometry).label}</h2></div>
            <span className={result.metrics.stable ? "pill pass" : "pill fail"}>{result.metrics.stable ? "WITHIN TOY-MODEL BOUNDS" : "OUTSIDE TOY-MODEL BOUNDS"}</span>
          </div>
          <div className="metrics">
            {metricDefs.map((metric) => <Metric key={metric.key} label={metric.label} value={result.metrics[metric.key]} tip={metric.tip} />)}
          </div>
          <p className="fine-print">Diagnostic thresholds are arbitrary numerical safeguards, not safety certifications. Layouts have different spring networks: comparisons are exploratory and cannot be interpreted as real material rankings.</p>
        </section>

        <section className="panel protocol-panel">
          <div className="protocol-intro">
            <p className="eyebrow">04 / EVIDENCE LEDGER</p>
            <h2>Compare all three layouts</h2>
            <p>Freeze the current controls, run each geometry under identical input parameters, and generate a provenance-labeled, downloadable JSON receipt. Results are kept in this tab only.</p>
            <div className="button-row">
              <button className="primary-button" onClick={runComparison}>RUN E0 COMPARISON ↗</button>
              <button className="secondary-button" onClick={downloadReceipt} disabled={!selectedReceipt}>EXPORT RECEIPT ↓</button>
            </div>
          </div>
          <div className="comparison">
            {selectedReceipt ? (
              <>
                <div className="comparison-header"><span>LAST COMPARISON</span><span>{new Date(selectedReceipt.recordedAt).toLocaleString()}</span></div>
                <div className="table-scroll"><table><thead><tr><th>GEOMETRY</th><th>RMS Δ</th><th>PEAK STRAIN</th><th>BOTTOM SPAN</th><th>DRIVE WORK</th></tr></thead>
                  <tbody>{selectedReceipt.cases.map((item) => (
                    <tr key={item.geometry}><td>{GEOMETRIES.find((g) => g.id === item.geometry).label}</td>
                      <td>{item.metrics.rmsDisplacement.toFixed(3)}</td>
                      <td>{item.metrics.peakSpringStrain.toFixed(3)}</td>
                      <td>{item.metrics.bottomWidthProxy.toFixed(3)}</td>
                      <td>{item.metrics.inputWorkProxy.toFixed(3)}</td></tr>
                  ))}</tbody></table></div>
                <p className="receipt-info">Origin: SIMULATED · {receipts.length} local run{receipts.length === 1 ? "" : "s"} · No claim of physical validation</p>
              </>
            ) : (
              <div className="empty-state"><span>◇</span><strong>NO RECEIPTS YET</strong><small>Run your first controlled comparison to populate the ledger.</small></div>
            )}
          </div>
        </section>

        <E1Panel params={params} />

        <E2Panel params={params} />

        <E3Panel params={params} />

        <section className="research-note"><div><p className="eyebrow">RESEARCH DIRECTION</p><h2>From morphing wheels to adaptive machine shells.</h2></div>
          <p>This project investigates geometry as a design variable for future adaptive systems. A fluid-filled physical shell would also require verified membranes, pressure vessels, pumps, electrical isolation, load paths, fatigue analysis and failure testing. E0 through E3 provide none of those physical validations.</p>
        </section>
      </main>

      <footer><span>Φ-MORPH / OPEN RESEARCH PROTOTYPE</span><span>LEDGER ABOVE EGO · MODEL BEFORE CLAIM</span><a href="https://github.com/MichaelWave369/Phi-Morph/blob/main/docs/MODEL_LIMITATIONS.md">RESEARCH NOTES ↗</a></footer>
    </div>
  );
}
