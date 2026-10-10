import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL_COUNT, DEFAULTS, GEOMETRIES, makeLayout, makeEdges,
  clampParameters, simulate, buildReceipt
} from "../src/model.js";

test("all comparison geometries produce 24 finite cells and links", () => {
  for (const { id } of GEOMETRIES) {
    const layout = makeLayout(id);
    assert.equal(layout.length, CELL_COUNT);
    assert.ok(layout.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const edges = makeEdges(layout);
    assert.ok(edges.length >= CELL_COUNT);
    assert.ok(edges.every((e) => e.a < e.b && e.rest > 0));
  }
});

test("same inputs produce numerically identical outputs", () => {
  const a = simulate("spiral", DEFAULTS);
  const b = simulate("spiral", DEFAULTS);
  assert.deepEqual(a, b);
});

test("default runs produce finite diagnostic proxies", () => {
  for (const { id } of GEOMETRIES) {
    const result = simulate(id);
    for (const [key, value] of Object.entries(result.metrics)) {
      if (key !== "stable") assert.ok(Number.isFinite(value), id + ":" + key);
    }
  }
});

test("input clamping handles range violations and invalid numbers", () => {
  const p = clampParameters({ pressure: 800, load: -7, frequency: "oops" });
  assert.equal(p.pressure, 3);
  assert.equal(p.load, 0);
  assert.equal(p.frequency, DEFAULTS.frequency);
});

test("unknown geometry and changed cell counts are forbidden in E0", () => {
  assert.throws(() => makeLayout("unknown"));
  assert.throws(() => makeLayout("ring", 22));
});

test("comparison receipt freezes inputs and labels origin SIMULATED", () => {
  const receipt = buildReceipt(DEFAULTS, "2026-10-10T00:00:00.000Z");
  assert.equal(receipt.origin, "SIMULATED");
  assert.equal(receipt.units, "normalized_dimensionless");
  assert.equal(receipt.cellCount, CELL_COUNT);
  assert.equal(receipt.cases.length, 3);
  assert.deepEqual(receipt.cases.map((x) => x.geometry), GEOMETRIES.map((x) => x.id));
  assert.ok(receipt.cases.every((x) => x.metrics && Number.isFinite(x.metrics.rmsDisplacement)));
});
