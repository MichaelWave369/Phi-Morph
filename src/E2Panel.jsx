import React, { useState } from "react";
import { GEOMETRIES } from "./model.js";
import { E2_ANGLES, E2_LOADS, buildE2Receipt, e2Csv } from "./e2.js";

const labels = Object.fromEntries(GEOMETRIES.map((g) => [g.id, g.label]));
const fmt = (v, digits = 3) => Number.isFinite(v) ? v.toFixed(digits) : "N/A";

function saveFile(filename, contents, mime) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selectedCases(geom, load) {
  return geom.rotationCases.map((rotation) => ({
    angle: rotation.degrees,
    row: rotation.loads.find((entry) => entry.load === load),
  }));
}

function Matrix({ receipt, load }) {
  const values = receipt.results.flatMap((group) => group.geometries.flatMap((geom) =>
    selectedCases(geom, load).map(({ row }) => row.metrics?.rmsDisplacement ?? 0)));
  const max = Math.max(0.001, ...values);
  return (
    <div className="e2-matrix-scroll">
      <div className="e2-matrix">
        <div className="e2-row e2-matrix-head">
          <span>SHAPE / MODE</span>
          {E2_ANGLES.map((degrees) => <span key={degrees}>{degrees}°</span>)}
        </div>
        {receipt.results.map((group) => (
          <React.Fragment key={group.mode}>
            <div className="e2-group-title">{group.mode === "rms-radius"
              ? "A / COMMON INITIAL RMS RADIUS"
              : "B / COMMON TOTAL LINK REST LENGTH"}</div>
            {group.geometries.map((geom) => (
              <div className="e2-row" key={geom.geometry}>
                <strong>{labels[geom.geometry]}</strong>
                {selectedCases(geom, load).map(({ angle, row }) => {
                  const value = row.metrics?.rmsDisplacement;
                  const alpha = value == null ? 0.08 : 0.12 + 0.57 * value / max;
                  return (
                    <div key={angle} className="e2-heat"
                      title={geom.geometry + ", " + group.mode + ", " + angle + "°: " + fmt(value, 6)}
                      style={{ background: "rgba(76,216,209," + alpha.toFixed(3) + ")" }}>
                      {fmt(value)}
                    </div>
                  );
                })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function AuditTable({ receipt, load }) {
  return (
    <div className="table-scroll">
      <table className="e2-audit-table">
        <thead><tr><th>CONTROL</th><th>SHAPE</th><th>RMS RADIUS</th>
          <th>TOTAL REST LENGTH</th><th>MIN RMS Δ</th><th>MAX RMS Δ</th><th>ORIENTATION SPREAD</th>
        </tr></thead>
        <tbody>{receipt.results.flatMap((group) => group.geometries.map((geom) => {
          const numbers = selectedCases(geom, load).map(({ row }) => row.metrics?.rmsDisplacement)
            .filter((value) => Number.isFinite(value));
          const lo = numbers.length ? Math.min(...numbers) : null;
          const hi = numbers.length ? Math.max(...numbers) : null;
          const stats = geom.rotationCases[0].loads[0].initialStats;
          return (
            <tr key={group.mode + geom.geometry}>
              <td>{group.mode === "rms-radius" ? "RMS radius" : "Link budget"}</td>
              <td>{labels[geom.geometry]}</td>
              <td>{fmt(stats.rmsRadius)}</td><td>{fmt(stats.totalRestLength)}</td>
              <td>{fmt(lo)}</td><td>{fmt(hi)}</td>
              <td>{numbers.length === E2_ANGLES.length ? fmt(hi - lo) : "INCOMPLETE"}</td>
            </tr>
          );
        }))}</tbody>
      </table>
    </div>
  );
}

export default function E2Panel({ params }) {
  const [boundary, setBoundary] = useState("bottom-pinned");
  const [load, setLoad] = useState(2);
  const [receipt, setReceipt] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const dirty = Boolean(receipt) &&
    (JSON.stringify(receipt.parameters) !== JSON.stringify(params) ||
      receipt.controls.supportBoundary !== boundary);
  const run = () => {
    setReceipt(buildE2Receipt(params, boundary));
    setRunCount((n) => n + 1);
  };
  const exportResult = (format) => {
    if (!receipt) return;
    const stamp = receipt.recordedAt.replace(/[:.]/g, "-");
    if (format === "json") saveFile("phi-morph-e2-" + stamp + ".json",
      JSON.stringify(receipt, null, 2) + "\n", "application/json");
    else saveFile("phi-morph-e2-" + stamp + ".csv", e2Csv(receipt), "text/csv");
  };
  return (
    <section className="panel e2-panel" aria-labelledby="e2-title">
      <div className="e1-header">
        <div>
          <p className="eyebrow">06 / E2 · GEOMETRY FAIRNESS AUDIT</p>
          <h2 id="e2-title">Rotation & link-budget controls</h2>
          <p className="e1-summary">Test whether responses change when the structure rotates relative
            to vertical loading, and when layouts use a common initial radius versus a common
            total link length. These are spring-model measurements, not material performance.</p>
        </div>
        <span className="pill">PM-E2-0.3.0</span>
      </div>
      <div className="e1-constraints">
        <span><strong>2</strong> normalization policies</span>
        <span><strong>3</strong> geometries</span>
        <span><strong>8</strong> orientations</span>
        <span><strong>3</strong> load levels</span>
        <span><strong>144</strong> model cases</span>
      </div>
      <div className="e1-controls">
        <label htmlFor="e2-boundary">Support condition</label>
        <select id="e2-boundary" value={boundary} onChange={(event) => setBoundary(event.target.value)}>
          <option value="bottom-pinned">Four lowest initial nodes pinned</option>
          <option value="tethered">No hard pins / soft tethers</option>
        </select>
        <button className="primary-button" onClick={run}>RUN E2 AUDIT ↗</button>
        <button className="secondary-button" disabled={!receipt} onClick={() => exportResult("json")}>JSON ↓</button>
        <button className="secondary-button" disabled={!receipt} onClick={() => exportResult("csv")}>CSV ↓</button>
      </div>
      <p className="fine-print e1-caveat">E2 inherits the drive, stiffness, damping and frequency sliders
        above. Downward load is swept at fixed 0, 2 and 4 values. The lowest four pinned points are
        selected again for every rotation. This is not a physical ground-contact model.</p>
      {dirty && <p className="e1-dirty" role="status">Inputs have changed since this receipt.
        Run E2 again to update the table and matrix.</p>}
      {receipt ? (
        <>
          <div className="e2-chart-heading">
            <div><h3>Orientation sensitivity</h3>
              <p>RMS modeled displacement at each of eight rotation angles.</p></div>
            <div className="e2-load-select" role="group" aria-label="Load for orientation matrix">
              {E2_LOADS.map((n) => (
                <button key={n} className={load === n ? "active" : ""}
                  aria-pressed={load === n} onClick={() => setLoad(n)}>LOAD {n}</button>
              ))}
            </div>
          </div>
          <Matrix receipt={receipt} load={load} />
          <p className="fine-print e2-matrix-note">
            More saturated cells mean greater displacement in this numeric model;
            they are not rankings of real strength, safety or usefulness.</p>
          <div className="e2-details">
            <div className="e1-inner-heading"><strong>Size matching and rotation spread</strong>
              <span>LOAD {load} · EIGHT ANGLES</span></div>
            <AuditTable receipt={receipt} load={load} />
          </div>
          <div className="e2-disclosure">
            <strong>Residual confounders are still present.</strong>
            <p>Matching total spring rest length changes overall geometric size.
              Matching initial RMS radius leaves different spring lengths.
              Neither mode matches the distribution of link lengths, area, material
              volume, pinned-node geometry or real-world mechanical properties.</p>
          </div>
          <p className="e1-receipt-info">
            {new Date(receipt.recordedAt).toLocaleString()} · RUN #{runCount} ·
            SIMULATED · {receipt.controls.caseCount} CASES · NO PHYSICAL VALIDATION
          </p>
        </>
      ) : (
        <div className="e1-empty"><strong>NO E2 AUDIT YET</strong>
          <span>Run 144 deterministic cases to examine geometry and orientation sensitivity.</span>
        </div>
      )}
    </section>
  );
}
