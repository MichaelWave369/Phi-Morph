import React, { useState } from "react";
import {
  E1_BOUNDARIES, E1_LOADS, E1_CONVERGENCE_TOLERANCE,
  buildE1Receipt, e1Csv,
} from "./e1.js";
import { GEOMETRIES } from "./model.js";

const COLORS = { ring: "#6cebd9", spiral: "#f2b967", nested: "#8daeff" };
const LABELS = Object.fromEntries(GEOMETRIES.map(({ id, label }) => [id, label]));
const axisNumber = (n) => (Number.isFinite(n) ? n.toFixed(2) : "–");

function download(name, contents, mime) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SweepPlot({ receipt }) {
  const cases = receipt.results.flatMap((r) => r.loadCases);
  const maxValue = Math.max(0.1, ...cases.map((r) => r.metrics?.rmsDisplacement ?? 0)) * 1.15;
  const x0 = 53, y0 = 16, width = 576, height = 194;
  const px = (load) => x0 + load / 4 * width;
  const py = (value) => y0 + height - value / maxValue * height;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="e1-plot-container">
      <svg viewBox="0 0 662 248" role="img"
        aria-label="Line chart of normalized displacement versus downward load for ring, golden-angle and nested layouts">
        {ticks.map((fraction) => (
          <g key={fraction}>
            <line x1={x0} x2={x0 + width} y1={py(maxValue * fraction)} y2={py(maxValue * fraction)}
              stroke="#355064" strokeWidth="1" strokeDasharray="3 5" />
            <text x={x0 - 10} y={py(maxValue * fraction) + 4} textAnchor="end" fill="#9cb5c4" fontSize="11">
              {axisNumber(maxValue * fraction)}
            </text>
          </g>
        ))}
        {E1_LOADS.map((load) => (
          <g key={load}>
            <line x1={px(load)} x2={px(load)} y1={y0} y2={y0 + height}
              stroke="#274151" strokeWidth=".8" />
            <text x={px(load)} y="228" textAnchor="middle" fill="#9cb5c4" fontSize="11">{load}</text>
          </g>
        ))}
        {receipt.results.map((item) => {
          const good = item.loadCases.filter((row) => row.metrics != null);
          return (
            <g key={item.geometry}>
              <polyline fill="none" stroke={COLORS[item.geometry]} strokeWidth="3"
                strokeLinejoin="round" strokeLinecap="round"
                points={good.map((row) => px(row.load) + "," + py(row.metrics.rmsDisplacement)).join(" ")} />
              {good.map((row) => (
                <circle key={row.load} cx={px(row.load)} cy={py(row.metrics.rmsDisplacement)}
                  r="3.5" fill={COLORS[item.geometry]} />
              ))}
            </g>
          );
        })}
        <text x="342" y="245" textAnchor="middle" fontSize="10" fill="#7697a9">
          DOWNWARD LOAD / NORMALIZED
        </text>
      </svg>
      <div className="e1-legend">
        {GEOMETRIES.map((g) => (
          <span key={g.id}><i style={{ background: COLORS[g.id] }} /> {g.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function E1Panel({ params }) {
  const [boundary, setBoundary] = useState("tethered");
  const [receipt, setReceipt] = useState(null);
  const [runs, setRuns] = useState(0);
  const dirty = Boolean(receipt) &&
    (JSON.stringify(receipt.parameters) !== JSON.stringify(params) ||
      receipt.controls.supportBoundary !== boundary);

  const run = () => {
    const next = buildE1Receipt(params, boundary);
    setReceipt(next);
    setRuns((value) => value + 1);
  };
  const exportData = (format) => {
    if (!receipt) return;
    const stamp = receipt.recordedAt.replace(/[:.]/g, "-");
    if (format === "json") download(
      "phi-morph-e1-" + stamp + ".json",
      JSON.stringify(receipt, null, 2) + "\n",
      "application/json"
    );
    else download("phi-morph-e1-" + stamp + ".csv", e1Csv(receipt), "text/csv");
  };

  return (
    <section className="panel e1-panel" aria-labelledby="e1-title">
      <div className="e1-header">
        <div>
          <p className="eyebrow">05 / E1 · CONTROLLED NETWORK STUDY</p>
          <h2 id="e1-title">Load-sweep laboratory</h2>
          <p className="e1-summary">Equal node count, equal four-regular topology, and matched initial RMS radius.
            Seven downward-load levels per shape. Separate numerical step-size checks.</p>
        </div>
        <span className="pill">PM-E1-0.2.0</span>
      </div>

      <div className="e1-constraints" aria-label="Frozen comparison settings">
        <span><strong>24</strong> nodes</span>
        <span><strong>48</strong> links</span>
        <span><strong>4</strong> links / node</span>
        <span><strong>2.65</strong> initial RMS radius</span>
        <span><strong>7 × 3</strong> load cases</span>
      </div>

      <div className="e1-controls">
        <label htmlFor="e1-boundary">Boundary condition</label>
        <select id="e1-boundary" value={boundary} onChange={(e) => setBoundary(e.target.value)}>
          {E1_BOUNDARIES.map((item) => (
            <option key={item} value={item}>
              {item === "tethered" ? "Soft tethers / no fixed pins" : "Bottom four nodes pinned"}
            </option>
          ))}
        </select>
        <button className="primary-button" onClick={run}>RUN E1 SWEEP ↗</button>
        <button className="secondary-button" onClick={() => exportData("json")} disabled={!receipt}>JSON ↓</button>
        <button className="secondary-button" onClick={() => exportData("csv")} disabled={!receipt}>CSV ↓</button>
      </div>
      <p className="fine-print e1-caveat">
        E1 reuses the upper E0 control sliders. The selected downward load is used for the
        dt-halving diagnostic; the plotted sweep always uses seven frozen load values.
        The pinned setting fixes four initial bottom nodes in place, not a physical ground contact.
      </p>
      {dirty && <p className="e1-dirty" role="status">
        Controls have changed since this receipt. Run E1 again to update the plotted results.
      </p>}

      {receipt ? (
        <>
          <div className="e1-results">
            <div className="e1-chart">
              <div className="e1-inner-heading"><strong>Response to applied load</strong><span>RMS DISPLACEMENT PROXY</span></div>
              <SweepPlot receipt={receipt} />
              <p className="fine-print">These are relative spring-model coordinates, not deformation measured in meters.
                Different link lengths, distribution, shape and orientation remain uncontrolled.</p>
            </div>
            <div className="e1-diagnostics">
              <div className="e1-inner-heading"><strong>Numerical consistency</strong><span>dt 0.02 VS 0.01</span></div>
              <p className="e1-diagnostic-note">Same 6.4-unit duration, at the currently selected load.
                RMS displacement differences indicate step-size sensitivity, not physical validity.</p>
              {receipt.results.map((item) => {
                const check = item.convergenceAtSelectedLoad;
                return (
                  <div className="e1-check" key={item.geometry}>
                    <div><strong>{LABELS[item.geometry]}</strong><span>{axisNumber(100 * check.relativeDelta)}% relative Δ</span></div>
                    <small>{check.belowHeuristicTolerance
                      ? "Below exploratory 5% threshold"
                      : "Outside exploratory 5% threshold"}</small>
                  </div>
                );
              })}
              <p className="fine-print">The {E1_CONVERGENCE_TOLERANCE * 100}% line is a chosen diagnostic tolerance,
                not a qualification or safety threshold. Additional dt values are needed.</p>
            </div>
          </div>
          <div className="e1-table-wrap">
            <div className="e1-inner-heading"><strong>Full 21-case comparison</strong><span>ORIGIN: SIMULATED · RUN #{runs}</span></div>
            <div className="table-scroll">
              <table className="e1-table"><thead><tr>
                <th>LOAD</th><th>CIRCULAR RMS Δ</th><th>GOLDEN-ANGLE RMS Δ</th><th>NESTED RMS Δ</th>
              </tr></thead>
                <tbody>{E1_LOADS.map((load, i) => (
                  <tr key={load}><td>{load.toFixed(1)}</td>
                    {receipt.results.map((item) => <td key={item.geometry}>
                      {item.loadCases[i].metrics
                        ? item.loadCases[i].metrics.rmsDisplacement.toFixed(4) : "non-finite"}
                    </td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <p className="e1-receipt-info">Receipt captured {new Date(receipt.recordedAt).toLocaleString()} ·
            SIMULATED · NO PHYSICAL VALIDATION · {receipt.controls.topology}</p>
        </>
      ) : (
        <div className="e1-empty">
          <strong>NO E1 RESULTS RECORDED</strong>
          <span>Run the 21-case study to see load-response traces, table, and step-size diagnostics.</span>
        </div>
      )}
    </section>
  );
}
