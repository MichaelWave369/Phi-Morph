import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, GEOMETRIES } from "../src/model.js";
import {
  E3_DT, E3_DURATION, E3_LOADS, E3_RADIUS, E3_SURFACES,
  e3GroundForce, simulateE3, buildE3Receipt, e3Csv,
} from "../src/e3.js";

test("ground force is unilateral, compression-only and never adhesive", () => {
  assert.equal(e3GroundForce(E3_RADIUS + 0.001, -40, "firm"), 0);
  assert.equal(e3GroundForce(E3_RADIUS, -4, "soft"), 0);
  assert.equal(e3GroundForce(E3_RADIUS - 0.1, 20, "firm") >= 0, true);
  assert.ok(e3GroundForce(E3_RADIUS - 0.1, -2, "firm") >
    e3GroundForce(E3_RADIUS - 0.1, 0, "firm"));
  assert.equal(e3GroundForce(-1, -10, "firm", false), 0);
  assert.throws(() => e3GroundForce(0, 0, "other"));
});

test("all geometry/surface pairs integrate to finite coordinates and diagnostics", () => {
  for (const { id } of GEOMETRIES) for (const surface of Object.keys(E3_SURFACES)) {
    const result = simulateE3(id, { ...DEFAULTS, load: 2 }, { surface });
    assert.equal(result.numericallyFinite, true, id + ":" + surface);
    assert.equal(result.edgeCount, 48);
    assert.equal(result.steps * result.dt, E3_DURATION);
    for (const value of Object.values(result.metrics)) {
      if (value !== null) assert.ok(Number.isFinite(value));
    }
    assert.ok(result.metrics.finalNormalReaction >= 0);
    assert.ok(result.metrics.peakPenetration >= 0);
  }
});

test("no-contact negative control produces exactly zero ground reaction", () => {
  const params = { ...DEFAULTS, load: 4 };
  const baseline = simulateE3("ring", params, { contactEnabled: false });
  const contact = simulateE3("ring", params, { contactEnabled: true });
  assert.equal(baseline.metrics.peakNormalReaction, 0);
  assert.equal(baseline.metrics.finalNormalReaction, 0);
  assert.equal(baseline.metrics.lateMeanNormalReaction, 0);
  assert.ok(contact.metrics.peakNormalReaction > 0);
  assert.notEqual(contact.metrics.hubDrop, baseline.metrics.hubDrop);
});

test("initial preview has a positive floor clearance and deterministic frames", () => {
  const a = simulateE3("nested", DEFAULTS, { saveFrames: true });
  const b = simulateE3("nested", DEFAULTS, { saveFrames: true });
  assert.deepEqual(a, b);
  assert.ok(a.frames.length >= 30);
  assert.equal(a.frames[0].step, 0);
  assert.ok(a.frames[0].nodes.every((n) => n.y > E3_RADIUS));
  assert.equal(a.frames.at(-1).step, E3_DURATION / E3_DT);
  assert.equal(a.frames.at(-1).nodes.length, 24);
});

test("higher load changes simulated hub displacement", () => {
  const light = simulateE3("ring", { ...DEFAULTS, load: 0.5 });
  const heavy = simulateE3("ring", { ...DEFAULTS, load: 4 });
  assert.notEqual(light.metrics.hubDrop, heavy.metrics.hubDrop);
});

test("invalid settings fail closed", () => {
  assert.throws(() => simulateE3("unknown", DEFAULTS));
  assert.throws(() => simulateE3("ring", DEFAULTS, { surface: "water" }));
  assert.throws(() => simulateE3("ring", DEFAULTS, { dt: 0 }));
  assert.throws(() => simulateE3("ring", DEFAULTS, { dt: 0.007 }));
  assert.throws(() => simulateE3("ring", DEFAULTS, { duration: 14 }));
  assert.throws(() => simulateE3("ring", DEFAULTS, { contactEnabled: 1 }));
});

test("E3 receipt has 24 contact cases, three negative controls and CSV with 24 data rows", () => {
  const at = "2026-10-10T00:00:00Z";
  const a = buildE3Receipt(DEFAULTS, at);
  assert.equal(a.protocol, "PM-E3-0.4.0");
  assert.equal(a.origin, "SIMULATED");
  assert.equal(a.physicalValidation, "NONE");
  assert.deepEqual(a.controls.loads, E3_LOADS);
  assert.equal(a.controls.caseCount, 24);
  assert.equal(a.controls.negativeControlCount, 3);
  assert.equal(a.cases.length, 24);
  assert.ok(a.cases.every((r) => r.numericallyFinite && r.metrics));
  assert.ok(a.noContactControls.every((r) => r.normalReaction === 0));
  assert.deepEqual(a, buildE3Receipt(DEFAULTS, at));
  assert.equal(e3Csv(a).trim().split("\n").length, 25);
});
