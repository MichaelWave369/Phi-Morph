import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, GEOMETRIES } from "../src/model.js";
import { simulateE1 } from "../src/e1.js";
import {
  E2_ANGLES, E2_LOADS, E2_MODES, E2_TARGET_REST_LENGTH,
  makeE2Layout, simulateE2, buildE2Receipt, e2Csv,
} from "../src/e2.js";

test("all eight orientations preserve 24 nodes and 48-link topology", () => {
  for (const { id } of GEOMETRIES) for (const mode of E2_MODES) {
    for (const degrees of E2_ANGLES) {
      const out = makeE2Layout(id, mode, degrees);
      assert.equal(out.nodes.length, 24);
      assert.equal(out.stats.edgeCount, 48);
      const mx = out.nodes.reduce((s, p) => s + p.x, 0) / 24;
      const my = out.nodes.reduce((s, p) => s + p.y, 0) / 24;
      assert.ok(Math.abs(mx) < 1e-10 && Math.abs(my) < 1e-10);
      if (mode === "rms-radius")
        assert.ok(Math.abs(out.stats.rmsRadius - 2.65) < 1e-5);
      else
        assert.ok(Math.abs(out.stats.totalRestLength - E2_TARGET_REST_LENGTH) < 2e-6);
    }
  }
});

test("scalar matching does not falsely promise same radius for all geometries", () => {
  const radii = GEOMETRIES.map(({ id }) =>
    makeE2Layout(id, "edge-budget", 0).stats.rmsRadius);
  assert.equal(new Set(radii).size > 1, true);
});

test("E2 RMS-radius 0-degree mode reproduces E1 model metrics", () => {
  for (const { id } of GEOMETRIES) {
    const old = simulateE1(id, DEFAULTS, { boundary: "bottom-pinned" });
    const current = simulateE2(id, DEFAULTS, {
      mode: "rms-radius", degrees: 0, boundary: "bottom-pinned",
    });
    assert.deepEqual(current.metrics, old.metrics, id);
  }
});

test("all normalization modes and orientation inputs are deterministic", () => {
  const args = { mode: "edge-budget", degrees: 135, boundary: "bottom-pinned" };
  const a = simulateE2("spiral", DEFAULTS, args);
  assert.deepEqual(a, simulateE2("spiral", DEFAULTS, args));
  assert.equal(a.numericallyFinite, true);
  assert.equal(a.pinnedNodeIds.length, 4);
});

test("forbidden transforms and boundary conditions fail closed", () => {
  assert.throws(() => makeE2Layout("spiral", "magic", 0));
  assert.throws(() => makeE2Layout("ring", "rms-radius", 360));
  assert.throws(() => makeE2Layout("ring", "rms-radius", -45));
  assert.throws(() => makeE2Layout("ring", "rms-radius", NaN));
  assert.throws(() => simulateE2("ring", DEFAULTS, { boundary: "free-wheeling" }));
  assert.throws(() => simulateE2("ring", DEFAULTS, { dt: 0.03 }));
});

test("receipt has 144 cases with declared provenance and exportable long-form CSV", () => {
  const at = "2026-10-10T00:00:00Z";
  const receipt = buildE2Receipt(DEFAULTS, "bottom-pinned", at);
  assert.equal(receipt.origin, "SIMULATED");
  assert.equal(receipt.physicalValidation, "NONE");
  assert.equal(receipt.controls.caseCount, 144);
  assert.equal(receipt.results.length, 2);
  assert.deepEqual(receipt.controls.anglesDegrees, E2_ANGLES);
  assert.deepEqual(receipt.controls.loadLevels, E2_LOADS);
  for (const mode of receipt.results) {
    assert.equal(mode.geometries.length, 3);
    for (const geom of mode.geometries) {
      assert.equal(geom.rotationCases.length, 8);
      for (const rotation of geom.rotationCases) {
        assert.equal(rotation.loads.length, 3);
        assert.ok(rotation.loads.every((r) => r.numericallyFinite && r.metrics));
      }
    }
  }
  assert.deepEqual(receipt, buildE2Receipt(DEFAULTS, "bottom-pinned", at));
  assert.equal(e2Csv(receipt).trim().split("\n").length, 145);
});
