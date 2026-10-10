/**
 * Φ-Morph E2: rotation/orientation sensitivity and scalar link-budget control.
 *
 * Frozen E1 remains unchanged. E2 reuses E1's normalized 24-cell layouts and
 * four-regular circulant topology, but varies one explicit normalization policy
 * and rotates the geometry relative to downward force.
 *
 * Matched total link rest length != matched link-length DISTRIBUTION or mass.
 * Neither policy equalizes area, material volume, individual spring stiffness,
 * deformation modes, ground contact or any physical constitutive properties.
 */
import { CELL_COUNT, DEFAULTS, GEOMETRIES, clampParameters } from "./model.js";
import {
  normalizedLayout, regularEdges, pinnedNodeIds, E1_DURATION,
} from "./e1.js";

export const E2_PROTOCOL = "PM-E2-0.3.0";
export const E2_MODEL = "phi-morph-orientation-controls-0.3.0";
export const E2_MODES = Object.freeze(["rms-radius", "edge-budget"]);
export const E2_BOUNDARIES = Object.freeze(["tethered", "bottom-pinned"]);
export const E2_ANGLES = Object.freeze([0, 45, 90, 135, 180, 225, 270, 315]);
export const E2_LOADS = Object.freeze([0, 2, 4]);
export const E2_DT = 0.02;
const round = (x) => Math.round(x * 1e6) / 1e6;

function edgesTotalLength(nodes) {
  return regularEdges(nodes).reduce((s, edge) => s + edge.rest, 0);
}

export const E2_TARGET_REST_LENGTH = edgesTotalLength(normalizedLayout("ring"));

export function makeE2Layout(geometry, mode = "rms-radius", degrees = 0) {
  if (!E2_MODES.includes(mode)) throw new Error("Invalid E2 normalization mode");
  if (!Number.isFinite(degrees) || degrees < 0 || degrees >= 360) {
    throw new Error("Invalid rotation angle");
  }
  const source = normalizedLayout(geometry); // E1: centered, RMS radius = 2.65
  const sourceBudget = edgesTotalLength(source);
  if (!(sourceBudget > 0)) throw new Error("Degenerate edge length budget");
  const scale = mode === "edge-budget" ? E2_TARGET_REST_LENGTH / sourceBudget : 1;
  const radians = degrees * Math.PI / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  const nodes = source.map((p) => ({
    id: p.id,
    x: scale * (p.x * c - p.y * s),
    y: scale * (p.x * s + p.y * c),
  }));
  const restLengthTotal = edgesTotalLength(nodes);
  const rmsRadius = Math.sqrt(nodes.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0) / CELL_COUNT);
  const minX = Math.min(...nodes.map((p) => p.x));
  const maxX = Math.max(...nodes.map((p) => p.x));
  const minY = Math.min(...nodes.map((p) => p.y));
  const maxY = Math.max(...nodes.map((p) => p.y));

  return {
    nodes,
    mode, degrees,
    stats: {
      nodeCount: CELL_COUNT,
      edgeCount: 48,
      rmsRadius: round(rmsRadius),
      totalRestLength: round(restLengthTotal),
      linkBudgetTarget: round(E2_TARGET_REST_LENGTH),
      spanX: round(maxX - minX),
      spanY: round(maxY - minY),
      scaleApplied: round(scale),
    }
  };
}

export function simulateE2(
  geometry = "ring",
  rawParameters = DEFAULTS,
  { mode = "rms-radius", degrees = 0, boundary = "bottom-pinned", dt = E2_DT } = {}
) {
  if (!E2_BOUNDARIES.includes(boundary)) throw new Error("Invalid E2 boundary");
  if (!(Number.isFinite(dt) && dt > 0 && dt <= 0.05)) throw new Error("Invalid E2 timestep");
  const p = clampParameters(rawParameters);
  const layout = makeE2Layout(geometry, mode, degrees);
  const base = layout.nodes;
  const edges = regularEdges(base);
  const pinned = boundary === "bottom-pinned" ? pinnedNodeIds(base) : [];
  const pinSet = new Set(pinned);
  const nodes = base.map((point) => ({ ...point, vx: 0, vy: 0 }));
  const steps = Math.round(E1_DURATION / dt);
  if (Math.abs(steps * dt - E1_DURATION) > 1e-9) throw new Error("E2 duration not divisible by dt");

  let maxStrain = 0, maxDisplacement = 0, workProxy = 0, finite = true;
  for (let step = 0; step < steps; step++) {
    const time = step * dt;
    const fx = new Float64Array(CELL_COUNT);
    const fy = new Float64Array(CELL_COUNT);
    for (let i = 0; i < CELL_COUNT; i++) {
      const origin = base[i], current = nodes[i];
      const r = Math.max(1e-12, Math.hypot(origin.x, origin.y));
      const nx = origin.x / r, ny = origin.y / r;
      const phase = Math.atan2(origin.y, origin.x);
      const periodic = p.frequency === 0 ? 0 :
        0.16 * Math.sin(2 * Math.PI * p.frequency * time + phase);
      const drive = p.pressure * 0.42 + periodic;
      fx[i] += drive * nx - p.stiffness * 0.38 * (current.x - origin.x);
      fy[i] += drive * ny - p.stiffness * 0.38 * (current.y - origin.y) - p.load / CELL_COUNT;
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
        node.x = base[i].x; node.y = base[i].y;
        node.vx = 0; node.vy = 0;
        continue;
      }
      node.vx = (node.vx + fx[i] * dt) / (1 + p.damping * dt);
      node.vy = (node.vy + fy[i] * dt) / (1 + p.damping * dt);
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(node.x - base[i].x, node.y - base[i].y));
      if (![node.x, node.y, node.vx, node.vy].every(Number.isFinite)) {
        finite = false;
        break;
      }
    }
    if (!finite) break;
  }
  if (!finite) return {
    geometry, mode, degrees, boundary, numericallyFinite: false,
    metrics: null, initialStats: layout.stats, pinnedNodeIds: pinned,
  };
  const rmsDisplacement = Math.sqrt(nodes.reduce((sum, n, i) =>
    sum + (n.x - base[i].x) ** 2 + (n.y - base[i].y) ** 2, 0) / CELL_COUNT);
  const meanYShift = nodes.reduce((sum, n, i) => sum + n.y - base[i].y, 0) / CELL_COUNT;
  return {
    geometry, mode, degrees, boundary, numericallyFinite: true,
    initialStats: layout.stats, pinnedNodeIds: pinned,
    metrics: {
      rmsDisplacement: round(rmsDisplacement),
      maxDisplacement: round(maxDisplacement),
      maxLinkStrain: round(maxStrain),
      meanYShift: round(meanYShift),
      driveWorkProxy: round(workProxy),
    },
  };
}

export function buildE2Receipt(
  rawParameters = DEFAULTS,
  boundary = "bottom-pinned",
  recordedAt = new Date().toISOString()
) {
  if (!E2_BOUNDARIES.includes(boundary)) throw new Error("Invalid E2 boundary");
  const parameters = clampParameters(rawParameters);
  const results = E2_MODES.map((mode) => ({
    mode,
    geometries: GEOMETRIES.map(({ id: geometry }) => ({
      geometry,
      rotationCases: E2_ANGLES.map((degrees) => ({
        degrees,
        loads: E2_LOADS.map((load) => {
          const result = simulateE2(geometry, { ...parameters, load }, {
            mode, degrees, boundary
          });
          return {
            load,
            numericallyFinite: result.numericallyFinite,
            metrics: result.metrics,
            initialStats: result.initialStats,
            pinnedNodeIds: result.pinnedNodeIds,
          };
        }),
      })),
    })),
  }));
  return {
    schema: "phi-morph.e2.receipt.v1",
    origin: "SIMULATED",
    physicalValidation: "NONE",
    protocol: E2_PROTOCOL,
    modelVersion: E2_MODEL,
    recordedAt,
    units: "normalized_dimensionless",
    parameters,
    controls: {
      nodeCount: CELL_COUNT,
      links: 48,
      degree: 4,
      graph: "circulant_C24_offsets_1_and_2",
      normalizationModes: [...E2_MODES],
      referenceRestLength: round(E2_TARGET_REST_LENGTH),
      anglesDegrees: [...E2_ANGLES],
      loadLevels: [...E2_LOADS],
      supportBoundary: boundary,
      duration: E1_DURATION,
      dt: E2_DT,
      caseCount: E2_MODES.length * GEOMETRIES.length * E2_ANGLES.length * E2_LOADS.length,
    },
    results,
    caveats: [
      "Each mode matches either RMS radius or scalar total rest length, not both.",
      "Total rest length is a one-number surrogate; individual edge lengths, span and material mass differ.",
      "Load direction is fixed, while the lattice rotates. Four bottom pins are reselected for each orientation.",
      "Periodic actuator phase is tied to spatial angle, so orientation changes also alter drive phases.",
      "These are deterministic spring-model observations, not physical superiority, material or tire safety claims.",
    ],
  };
}

export function e2Csv(receipt) {
  const lines = [[
    "protocol","mode","geometry","angleDegrees","load","boundary",
    "rmsDisplacement","peakLinkStrain","meanYShift","restLengthTotal",
    "initialRmsRadius","pinnedNodeIds","numericallyFinite",
  ]];
  for (const group of receipt.results) {
    for (const geom of group.geometries) {
      for (const rotation of geom.rotationCases) {
        for (const row of rotation.loads) {
          lines.push([
            receipt.protocol, group.mode, geom.geometry, rotation.degrees, row.load,
            receipt.controls.supportBoundary, row.metrics?.rmsDisplacement ?? "",
            row.metrics?.maxLinkStrain ?? "", row.metrics?.meanYShift ?? "",
            row.initialStats.totalRestLength, row.initialStats.rmsRadius,
            row.pinnedNodeIds.join("|"), row.numericallyFinite,
          ]);
        }
      }
    }
  }
  return lines.map((row) => row.map((item) =>
    '"' + String(item).replace(/"/g, '""') + '"').join(",")).join("\n") + "\n";
}
