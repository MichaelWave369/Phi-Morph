/**
 * Φ-Morph exploratory model v0.1.
 *
 * A deterministic, dimensionless point-mass / spring-network toy model.
 * No fluid dynamics, electrohydrodynamics, structural FEM or tire contact model.
 * Values are normalized inputs and proxies, not SI units or material properties.
 */
export const MODEL_VERSION = "phi-morph-spring-0.1.0";
export const PROTOCOL_VERSION = "PM-E0-0.1.0";
export const CELL_COUNT = 24;

export const DEFAULTS = Object.freeze({
  pressure: 1.4,
  stiffness: 3.1,
  damping: 1.2,
  load: 1.2,
  frequency: 0.8,
});

export const GEOMETRIES = [
  { id: "ring", label: "Circular array", detail: "Evenly spaced reference ring" },
  { id: "spiral", label: "Golden-angle layout", detail: "Phyllotactic spiral-inspired cell placement" },
  { id: "nested", label: "Nested rings", detail: "Staggered dual-ring bubble arrangement" },
];

export function clampParameters(raw = {}) {
  const ranges = {
    pressure: [0, 3],
    stiffness: [0.5, 8],
    damping: [0.1, 4],
    load: [0, 4],
    frequency: [0, 3],
  };
  const clean = {};
  for (const [key, [lo, hi]] of Object.entries(ranges)) {
    const candidate = Number(raw[key] ?? DEFAULTS[key]);
    clean[key] = Number.isFinite(candidate)
      ? Math.min(hi, Math.max(lo, candidate))
      : DEFAULTS[key];
  }
  return clean;
}

export function makeLayout(geometry, count = CELL_COUNT) {
  if (!["ring", "spiral", "nested"].includes(geometry)) {
    throw new Error("Unknown geometry: " + geometry);
  }
  if (count !== CELL_COUNT) {
    throw new Error("Protocol E0 freezes the cell count at 24");
  }
  return Array.from({ length: count }, (_, i) => {
    let angle;
    let radius;
    if (geometry === "ring") {
      angle = 2 * Math.PI * i / count;
      radius = 2.65;
    } else if (geometry === "spiral") {
      // The golden angle is 2π(1 - 1/φ). This is a geometry hypothesis,
      // not evidence of improved mechanical performance.
      angle = i * Math.PI * (3 - Math.sqrt(5));
      radius = 0.9 + 2.65 * Math.sqrt((i + 0.5) / count);
    } else {
      const half = count / 2;
      angle = 2 * Math.PI * (i % half) / half + (i >= half ? Math.PI / half : 0);
      radius = i < half ? 1.82 : 3.14;
    }
    return {
      id: i,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      angle,
      radius,
    };
  });
}

export function makeEdges(nodes, neighbors = 3) {
  const seen = new Set();
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    const closest = nodes
      .map((node, j) => ({
        j,
        distance: Math.hypot(node.x - nodes[i].x, node.y - nodes[i].y),
      }))
      .filter((item) => item.j !== i)
      .sort((a, b) => a.distance - b.distance || a.j - b.j)
      .slice(0, neighbors);
    for (const item of closest) {
      const a = Math.min(i, item.j);
      const b = Math.max(i, item.j);
      const key = a + ":" + b;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a, b, rest: item.distance });
      }
    }
  }
  return edges.sort((a, b) => a.a - b.a || a.b - b.b);
}

const round = (n) => Math.round(n * 10000) / 10000;

export function simulate(geometry = "ring", rawParameters = {}) {
  const parameters = clampParameters(rawParameters);
  const base = makeLayout(geometry);
  const edges = makeEdges(base);
  const nodes = base.map((point) => ({ ...point, vx: 0, vy: 0 }));
  const dt = 0.02;
  const steps = 320;
  let driveWork = 0;
  let motionSq = 0;
  let peakDisplacement = 0;
  let peakStrain = 0;
  let isFiniteState = true;

  for (let step = 0; step < steps; step++) {
    const time = step * dt;
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    for (let i = 0; i < nodes.length; i++) {
      const point = nodes[i];
      const origin = base[i];
      const nx = origin.x / origin.radius;
      const ny = origin.y / origin.radius;
      const phase = origin.angle;
      const drive = parameters.frequency === 0
        ? 0
        : 0.26 * Math.sin(2 * Math.PI * parameters.frequency * time + phase);
      const outward = parameters.pressure * 0.65 + drive;
      fx[i] += outward * nx - parameters.stiffness * 0.42 * (point.x - origin.x);
      fy[i] += outward * ny - parameters.stiffness * 0.42 * (point.y - origin.y);
      fy[i] -= parameters.load / nodes.length;
      driveWork += Math.abs(drive * (point.vx * nx + point.vy * ny)) * dt;
    }

    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1e-8, Math.hypot(dx, dy));
      const strain = (distance - edge.rest) / Math.max(edge.rest, 1e-8);
      const force = parameters.stiffness * 0.68 * strain;
      const sx = force * dx / distance;
      const sy = force * dy / distance;
      fx[edge.a] += sx;
      fy[edge.a] += sy;
      fx[edge.b] -= sx;
      fy[edge.b] -= sy;
      peakStrain = Math.max(peakStrain, Math.abs(strain));
    }

    for (let i = 0; i < nodes.length; i++) {
      const point = nodes[i];
      point.vx = (point.vx + fx[i] * dt) / (1 + parameters.damping * dt);
      point.vy = (point.vy + fy[i] * dt) / (1 + parameters.damping * dt);
      point.x += point.vx * dt;
      point.y += point.vy * dt;
      const displacement = Math.hypot(point.x - base[i].x, point.y - base[i].y);
      peakDisplacement = Math.max(peakDisplacement, displacement);
      motionSq += point.vx ** 2 + point.vy ** 2;
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        isFiniteState = false;
        break;
      }
    }
    if (!isFiniteState) break;
  }

  const displacementRms = Math.sqrt(
    nodes.reduce((sum, point, i) => {
      return sum + (point.x - base[i].x) ** 2 + (point.y - base[i].y) ** 2;
    }, 0) / nodes.length
  );

  // This is ONLY a geometric width heuristic for bottom-facing nodes.
  // It does not model an actual ground plane, traction, force or tire contact.
  const minY = Math.min(...nodes.map((point) => point.y));
  const nearBottom = nodes.filter((point) => point.y <= minY + 0.55);
  const width = nearBottom.length > 1
    ? Math.max(...nearBottom.map((p) => p.x)) - Math.min(...nearBottom.map((p) => p.x))
    : 0;

  const stable = isFiniteState && peakDisplacement < 4 && peakStrain < 2;
  return {
    geometry,
    parameters,
    cellCount: nodes.length,
    edgeCount: edges.length,
    base,
    edges,
    nodes: nodes.map(({ id, x, y, radius }) => ({
      id,
      x: round(x),
      y: round(y),
      radius: round(radius),
    })),
    metrics: {
      rmsDisplacement: round(displacementRms),
      peakDisplacement: round(peakDisplacement),
      peakSpringStrain: round(peakStrain),
      bottomWidthProxy: round(width),
      rmsMotionProxy: round(Math.sqrt(motionSq / (steps * nodes.length))),
      inputWorkProxy: round(driveWork),
      stable,
    },
  };
}

export function buildReceipt(rawParameters, now = new Date().toISOString()) {
  const parameters = clampParameters(rawParameters);
  return {
    schema: "phi-morph.e0.receipt.v1",
    recordedAt: now,
    origin: "SIMULATED",
    modelVersion: MODEL_VERSION,
    protocol: PROTOCOL_VERSION,
    units: "normalized_dimensionless",
    steps: 320,
    stepSize: 0.02,
    cellCount: CELL_COUNT,
    fixedNearestNeighbors: 3,
    comparisonParameters: parameters,
    cases: GEOMETRIES.map((item) => {
      const result = simulate(item.id, parameters);
      return {
        geometry: result.geometry,
        edgeCount: result.edgeCount,
        metrics: result.metrics,
      };
    }),
    limitations: "Toy point-mass/spring network. Not fluid simulation, validated stress, traction, stiffness or a physical prototype.",
  };
}
