/**
 * Φ-Morph E1: a controlled dimensionless spring-network experiment.
 *
 * Same 24 nodes, identical four-regular indexed topology (48 links),
 * initial centroid and RMS radius across layouts, matching parameters,
 * boundary mode and simulated duration. Material volume, connection lengths,
 * enclosed area, orientation and real-world constitutive properties
 * are NOT matched. No fluid, electric field, ground or traction mechanics.
 */
import { CELL_COUNT, DEFAULTS, GEOMETRIES, clampParameters, makeLayout } from "./model.js";

export const E1_PROTOCOL = "PM-E1-0.2.0";
export const E1_MODEL = "phi-morph-regular-graph-0.2.0";
export const E1_LOADS = Object.freeze([0, 0.5, 1, 1.5, 2, 3, 4]);
export const E1_DURATION = 6.4;
export const E1_DT = 0.02;
export const E1_CONVERGENCE_TOLERANCE = 0.05;
export const E1_BOUNDARIES = Object.freeze(["tethered", "bottom-pinned"]);
const round = (n) => Math.round(n * 1e6) / 1e6;

export function normalizedLayout(geometry) {
  const raw = makeLayout(geometry);
  const cx = raw.reduce((s, p) => s + p.x, 0) / CELL_COUNT;
  const cy = raw.reduce((s, p) => s + p.y, 0) / CELL_COUNT;
  const rms = Math.sqrt(raw.reduce((s, p) =>
    s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / CELL_COUNT);
  if (!Number.isFinite(rms) || rms <= 0) throw new Error("Degenerate layout");
  const scale = 2.65 / rms;
  return raw.map((p) => ({
    id: p.id,
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }));
}

export function regularEdges(base) {
  if (base.length !== CELL_COUNT) throw new Error("E1 requires 24 cells");
  const edges = [];
  // Undirected circulant C24(1,2): two forward neighbors at each node,
  // so every node has degree four and every geometry has exactly 48 links.
  for (let i = 0; i < CELL_COUNT; i++) {
    for (const offset of [1, 2]) {
      const j = (i + offset) % CELL_COUNT;
      edges.push({
        a: i,
        b: j,
        rest: Math.hypot(base[i].x - base[j].x, base[i].y - base[j].y),
      });
    }
  }
  return edges;
}

export function pinnedNodeIds(base) {
  return base.slice()
    .sort((a, b) => a.y - b.y || a.id - b.id)
    .slice(0, 4)
    .map((p) => p.id)
    .sort((a, b) => a - b);
}

export function simulateE1(geometry = "ring", rawParameters = DEFAULTS, options = {}) {
  const p = clampParameters(rawParameters);
  const boundary = options.boundary ?? "tethered";
  if (!E1_BOUNDARIES.includes(boundary)) throw new Error("Unsupported boundary condition");
  const dt = options.dt ?? E1_DT;
  const duration = options.duration ?? E1_DURATION;
  if (!(Number.isFinite(dt) && dt > 0 && dt <= 0.05)) throw new Error("Invalid time step");
  if (!(Number.isFinite(duration) && duration > 0 && duration <= 10)) throw new Error("Invalid duration");
  const steps = Math.round(duration / dt);
  if (Math.abs(steps * dt - duration) > 1e-9) throw new Error("Duration must divide into fixed steps");

  const base = normalizedLayout(geometry);
  const edges = regularEdges(base);
  const pins = boundary === "bottom-pinned" ? pinnedNodeIds(base) : [];
  const pinSet = new Set(pins);
  const nodes = base.map((node) => ({ ...node, vx: 0, vy: 0 }));
  let maxStrain = 0;
  let maxDisplacement = 0;
  let workProxy = 0;
  let isFinite = true;

  for (let step = 0; step < steps; step++) {
    const time = step * dt;
    const fx = new Float64Array(CELL_COUNT);
    const fy = new Float64Array(CELL_COUNT);

    for (let i = 0; i < CELL_COUNT; i++) {
      const origin = base[i];
      const current = nodes[i];
      const r = Math.max(1e-12, Math.hypot(origin.x, origin.y));
      const nx = origin.x / r;
      const ny = origin.y / r;
      const phase = Math.atan2(origin.y, origin.x);
      const periodic = p.frequency === 0 ? 0 :
        0.16 * Math.sin(2 * Math.PI * p.frequency * time + phase);
      const drive = p.pressure * 0.42 + periodic;
      fx[i] += drive * nx - p.stiffness * 0.38 * (current.x - origin.x);
      fy[i] += drive * ny - p.stiffness * 0.38 * (current.y - origin.y);
      fy[i] -= p.load / CELL_COUNT;
      workProxy += Math.abs(periodic * (current.vx * nx + current.vy * ny)) * dt;
    }

    for (const edge of edges) {
      const a = nodes[edge.a], b = nodes[edge.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.max(1e-12, Math.hypot(dx, dy));
      const extension = length - edge.rest;
      const signedForce = p.stiffness * 0.64 * extension / length;
      fx[edge.a] += signedForce * dx;
      fy[edge.a] += signedForce * dy;
      fx[edge.b] -= signedForce * dx;
      fy[edge.b] -= signedForce * dy;
      maxStrain = Math.max(maxStrain, Math.abs(extension / Math.max(1e-12, edge.rest)));
    }

    for (let i = 0; i < CELL_COUNT; i++) {
      const node = nodes[i];
      if (pinSet.has(i)) {
        node.x = base[i].x;
        node.y = base[i].y;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx = (node.vx + fx[i] * dt) / (1 + p.damping * dt);
      node.vy = (node.vy + fy[i] * dt) / (1 + p.damping * dt);
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      const displacement = Math.hypot(node.x - base[i].x, node.y - base[i].y);
      maxDisplacement = Math.max(maxDisplacement, displacement);
      if (![node.x, node.y, node.vx, node.vy].every(Number.isFinite)) {
        isFinite = false;
        break;
      }
    }
    if (!isFinite) break;
  }

  if (!isFinite) {
    return {
      geometry, boundary, parameters: p, steps, dt, edgeCount: edges.length,
      pinnedNodeIds: pins, numericallyFinite: false, metrics: null
    };
  }
  const rmsDisplacement = Math.sqrt(nodes.reduce((s, node, i) =>
    s + (node.x - base[i].x) ** 2 + (node.y - base[i].y) ** 2, 0) / CELL_COUNT);
  const finalMeanYShift = nodes.reduce((s, node, i) =>
    s + node.y - base[i].y, 0) / CELL_COUNT;

  return {
    geometry, boundary, parameters: p, steps, dt,
    edgeCount: edges.length,
    pinnedNodeIds: pins,
    numericallyFinite: true,
    metrics: {
      rmsDisplacement: round(rmsDisplacement),
      maxDisplacement: round(maxDisplacement),
      maxLinkStrain: round(maxStrain),
      meanYShift: round(finalMeanYShift),
      driveWorkProxy: round(workProxy),
    },
    // Point coordinates enable exact pin invariance testing and future playback.
    nodes: nodes.map(({ id, x, y }) => ({ id, x: round(x), y: round(y) })),
  };
}

export function e1Convergence(geometry, parameters, boundary = "tethered") {
  const coarse = simulateE1(geometry, parameters, { boundary, dt: 0.02 });
  const fine = simulateE1(geometry, parameters, { boundary, dt: 0.01 });
  const a = coarse.metrics?.rmsDisplacement;
  const b = fine.metrics?.rmsDisplacement;
  // Hybrid denominator avoids declaring huge relative errors near zero.
  const error = a == null || b == null ? null : Math.abs(a - b);
  const relativeError = error == null ? null : error / Math.max(0.01, Math.abs(b));
  return {
    geometry,
    coarseDt: 0.02,
    fineDt: 0.01,
    absoluteDelta: error == null ? null : round(error),
    relativeDelta: relativeError == null ? null : round(relativeError),
    belowHeuristicTolerance: relativeError == null ? false : relativeError < E1_CONVERGENCE_TOLERANCE,
    note: "A single dt-halving diagnostic, not a proof of convergence or physical accuracy.",
  };
}

export function buildE1Receipt(rawParameters = DEFAULTS, boundary = "tethered", recordedAt = new Date().toISOString()) {
  if (!E1_BOUNDARIES.includes(boundary)) throw new Error("Unsupported boundary condition");
  const parameters = clampParameters(rawParameters);
  const results = GEOMETRIES.map(({ id }) => ({
    geometry: id,
    loadCases: E1_LOADS.map((load) => {
      const result = simulateE1(id, { ...parameters, load }, { boundary });
      return {
        load,
        edgeCount: result.edgeCount,
        pinnedNodeIds: result.pinnedNodeIds,
        numericallyFinite: result.numericallyFinite,
        metrics: result.metrics,
      };
    }),
    convergenceAtSelectedLoad: e1Convergence(id, parameters, boundary),
  }));
  return {
    schema: "phi-morph.e1.receipt.v1",
    origin: "SIMULATED",
    physicalValidation: "NONE",
    recordedAt,
    modelVersion: E1_MODEL,
    protocol: E1_PROTOCOL,
    units: "normalized_dimensionless",
    controls: {
      nodeCount: CELL_COUNT,
      edgeCount: 48,
      nodeDegree: 4,
      topology: "circulant_C24_offsets_1_and_2",
      centeredInitialLayout: true,
      initialRmsRadius: 2.65,
      duration: E1_DURATION,
      coarseDt: E1_DT,
      fineDt: 0.01,
      supportBoundary: boundary,
      loadLevels: [...E1_LOADS],
    },
    parameters,
    results,
    caveats: [
      "Same index topology and RMS radius, but link lengths, spatial distribution, area and orientation differ.",
      "Only a deterministic spring model; no fluid mechanics, contact physics or calibrated material properties.",
      "Numerical dt check is a heuristic diagnostic, not validation of accuracy or convergence.",
      "Never interpret these proxies as tire safety, traction, pressure, joules or material superiority.",
    ],
  };
}

export function e1Csv(receipt) {
  const rows = [["protocol", "geometry", "boundary", "load", "rmsDisplacement",
    "maxLinkStrain", "meanYShift", "driveWorkProxy", "numericallyFinite"]];
  for (const item of receipt.results) {
    for (const row of item.loadCases) {
      rows.push([
        receipt.protocol, item.geometry, receipt.controls.supportBoundary,
        row.load, row.metrics?.rmsDisplacement ?? "",
        row.metrics?.maxLinkStrain ?? "", row.metrics?.meanYShift ?? "",
        row.metrics?.driveWorkProxy ?? "", row.numericallyFinite
      ]);
    }
  }
  return rows.map((row) => row.map((item) => '"' + String(item).replace(/"/g, '""') + '"').join(",")).join("\n") + "\n";
}
