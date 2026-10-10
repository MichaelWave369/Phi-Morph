import test from "node:test";
import assert from "node:assert/strict";
import {
  E1_LOADS, E1_PROTOCOL, E1_MODEL, normalizedLayout, regularEdges, pinnedNodeIds,
  simulateE1, e1Convergence, buildE1Receipt, e1Csv
} from "../src/e1.js";
import { DEFAULTS, GEOMETRIES } from "../src/model.js";

test("E1 initial conditions have zero centroid and matched RMS radius", () => {
  for (const { id } of GEOMETRIES) {
    const points = normalizedLayout(id);
    assert.equal(points.length, 24);
    assert.ok(Math.abs(points.reduce((s, p) => s + p.x, 0)) < 1e-9);
    assert.ok(Math.abs(points.reduce((s, p) => s + p.y, 0)) < 1e-9);
    const rms = Math.sqrt(points.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0) / 24);
    assert.ok(Math.abs(rms - 2.65) < 1e-9, id);
  }
});

test("identical fixed four-regular topology across all E1 layouts", () => {
  let reference;
  for (const { id } of GEOMETRIES) {
    const edges = regularEdges(normalizedLayout(id));
    assert.equal(edges.length, 48);
    const degrees = Array(24).fill(0);
    for (const edge of edges) {
      degrees[edge.a]++;
      degrees[edge.b]++;
    }
    assert.ok(degrees.every((d) => d === 4));
    const pairs = edges.map((e) => e.a + ":" + e.b);
    if (!reference) reference = pairs;
    else assert.deepEqual(pairs, reference);
  }
});

test("E1 runs deterministically and responds to different loads", () => {
  const a = simulateE1("spiral", DEFAULTS);
  assert.deepEqual(a, simulateE1("spiral", DEFAULTS));
  const b = simulateE1("spiral", { ...DEFAULTS, load: 3.6 });
  assert.equal(a.numericallyFinite, true);
  assert.equal(b.numericallyFinite, true);
  assert.notEqual(a.metrics.meanYShift, b.metrics.meanYShift);
  assert.ok(Number.isFinite(a.metrics.maxLinkStrain));
});

test("four bottom nodes remain fixed in pinned mode", () => {
  const base = normalizedLayout("nested");
  const pins = pinnedNodeIds(base);
  assert.equal(pins.length, 4);
  const result = simulateE1("nested", DEFAULTS, { boundary: "bottom-pinned" });
  assert.deepEqual(result.pinnedNodeIds, pins);
  for (const i of pins) {
    assert.ok(Math.abs(result.nodes[i].x - base[i].x) < 1e-6);
    assert.ok(Math.abs(result.nodes[i].y - base[i].y) < 1e-6);
  }
});

test("unsupported boundaries, steps, durations and layouts reject", () => {
  assert.throws(() => simulateE1("ring", DEFAULTS, { boundary: "ground-contact" }));
  assert.throws(() => simulateE1("ring", DEFAULTS, { dt: 0 }));
  assert.throws(() => simulateE1("ring", DEFAULTS, { dt: 0.03 }));
  assert.throws(() => simulateE1("ring", DEFAULTS, { duration: 11 }));
  assert.throws(() => simulateE1("fake", DEFAULTS));
});

test("dt-halving diagnostic is finite and discloses its limited status", () => {
  const result = e1Convergence("ring", DEFAULTS, "tethered");
  assert.ok(Number.isFinite(result.relativeDelta));
  assert.ok(Number.isFinite(result.absoluteDelta));
  assert.match(result.note, /not a proof/);
});

test("E1 receipt freezes 21 load cases, control topology and SIMULATED origin", () => {
  const receipt = buildE1Receipt(DEFAULTS, "bottom-pinned", "2026-10-10T00:00:00Z");
  assert.equal(receipt.protocol, E1_PROTOCOL);
  assert.equal(receipt.modelVersion, E1_MODEL);
  assert.equal(receipt.origin, "SIMULATED");
  assert.equal(receipt.physicalValidation, "NONE");
  assert.equal(receipt.controls.edgeCount, 48);
  assert.equal(receipt.results.length, 3);
  for (const result of receipt.results) {
    assert.deepEqual(result.loadCases.map((l) => l.load), E1_LOADS);
    assert.ok(result.loadCases.every((row) => row.edgeCount === 48 && row.pinnedNodeIds.length === 4));
  }
  assert.deepEqual(buildE1Receipt(DEFAULTS, "bottom-pinned", "2026-10-10T00:00:00Z"), receipt);
  assert.equal(e1Csv(receipt).trim().split("\n").length, 22);
});
