import test from "node:test";
import assert from "node:assert/strict";
import {
  E4_DT,E4_DURATION,E4_RMS_RADIUS,E4_SHAPES,E4_FRICTIONS,E4_TORQUES,
  e4Outline,e4ContactForce,simulateE4,buildE4Receipt,e4Csv
} from "../src/e4.js";

test("both outline shapes have 24 centered points and matched RMS radius", () => {
  const arrays = E4_SHAPES.map(shape => e4Outline(shape));
  for (const points of arrays) {
    assert.equal(points.length, 24);
    const mx = points.reduce((s,p) => s+p.x,0)/24;
    const my = points.reduce((s,p) => s+p.y,0)/24;
    assert.ok(Math.abs(mx) < 1e-9);
    assert.ok(Math.abs(my) < 1e-9);
    const rms = Math.sqrt(points.reduce((s,p)=>s+p.x*p.x+p.y*p.y,0)/24);
    assert.ok(Math.abs(rms - E4_RMS_RADIUS) < 1e-9);
  }
  assert.notDeepEqual(arrays[0],arrays[1]);
});

test("normal force is non-adhesive; friction is bounded and opposed to slip", () => {
  assert.deepEqual(e4ContactForce(-0.2, -20, -10, 0.8), {normal:0,tangential:0});
  assert.deepEqual(e4ContactForce(0.2, -20, -10, 0.8, false), {normal:0,tangential:0});
  const movingRight = e4ContactForce(0.1, 2, -0.5, 0.8);
  const movingLeft = e4ContactForce(0.1, -2, -0.5, 0.8);
  assert.ok(movingRight.normal > 0 && movingRight.tangential < 0);
  assert.ok(movingLeft.tangential > 0);
  assert.ok(Math.abs(movingRight.tangential) <= 0.8*movingRight.normal+1e-10);
  assert.equal(e4ContactForce(0.1, 2, -0.5, 0).tangential,0);
  assert.throws(() => e4ContactForce(0.1, 0, 0, -0.2));
});

test("zero friction transmits no horizontal impulse even with motor torque", () => {
  for (const shape of E4_SHAPES) {
    const run = simulateE4({shape, mu:0, torque:1.6});
    assert.equal(run.numericallyFinite,true);
    assert.equal(run.metrics.signedFrictionImpulseProxy,0);
    assert.equal(run.metrics.horizontalTravel,0);
    assert.ok(run.metrics.peakNormalReaction > 0);
  }
});

test("no floor creates no normal, tangential impulse or horizontal motion", () => {
  for (const shape of E4_SHAPES) {
    const run = simulateE4({shape, mu:0.8, torque:1.6,contactEnabled:false});
    assert.equal(run.metrics.normalImpulseProxy,0);
    assert.equal(run.metrics.signedFrictionImpulseProxy,0);
    assert.equal(run.metrics.horizontalTravel,0);
    assert.equal(run.metrics.contactTimeFraction,0);
  }
});

test("all 18 shape/friction/torque combinations stay finite", () => {
  for (const shape of E4_SHAPES) for (const mu of E4_FRICTIONS)
    for (const torque of E4_TORQUES) {
      const result = simulateE4({shape,mu,torque,load:2});
      assert.equal(result.numericallyFinite,true,shape+" "+mu+" "+torque);
      assert.equal(result.steps*result.dt,E4_DURATION);
      for (const value of Object.values(result.metrics)) assert.ok(Number.isFinite(value));
      assert.ok(result.metrics.frictionDissipationProxy >= -1e-9);
      assert.ok(result.metrics.peakNumericalPenetration >= 0);
      assert.ok(result.metrics.contactTimeFraction >= 0 && result.metrics.contactTimeFraction <= 1);
    }
});

test("friction transmits torque-dependent horizontal momentum", () => {
  const zero = simulateE4({shape:"circle",mu:0.8,torque:1.6,contactEnabled:false});
  const rolling = simulateE4({shape:"circle",mu:0.8,torque:1.6,contactEnabled:true});
  assert.ok(rolling.metrics.normalImpulseProxy > 0);
  assert.ok(Math.abs(rolling.metrics.signedFrictionImpulseProxy) > 0.0001);
  assert.ok(Math.abs(rolling.metrics.horizontalTravel-zero.metrics.horizontalTravel) > 0.0001);
});

test("playback is repeatable and has the expected endpoint", () => {
  const args = {shape:"rounded-square",mu:0.35,torque:0.8,captureFrames:true};
  const a = simulateE4(args);
  const b = simulateE4(args);
  assert.deepEqual(a,b);
  assert.equal(a.frames[0].time,0);
  assert.equal(a.frames.at(-1).time,E4_DURATION);
  assert.ok(a.frames.length >= 40);
  assert.equal(a.frames[0].nodes.length,24);
});

test("unsupported shape, friction, torque or timestep fail closed", () => {
  assert.throws(() => simulateE4({shape:"pentagon"}));
  assert.throws(() => simulateE4({mu:1.1}));
  assert.throws(() => simulateE4({torque:-1}));
  assert.throws(() => simulateE4({dt:0.0043}));
  assert.throws(() => simulateE4({contactEnabled:1}));
});

test("receipt records 18 cases and two no-ground controls with SIMULATED provenance", () => {
  const at="2026-10-10T00:00:00Z";
  const a=buildE4Receipt(2,at);
  assert.equal(a.protocol,"PM-E4-0.5.0");
  assert.equal(a.origin,"SIMULATED");
  assert.equal(a.physicalValidation,"NONE");
  assert.equal(a.cases.length,18);
  assert.equal(a.noGroundControls.length,2);
  assert.ok(a.cases.every(c=>c.numericallyFinite&&c.metrics));
  assert.ok(a.noGroundControls.every(c=>c.normalImpulseProxy===0&&c.signedFrictionImpulseProxy===0));
  assert.deepEqual(a,buildE4Receipt(2,at));
  assert.equal(e4Csv(a).trim().split("\n").length,19);
  assert.throws(()=>buildE4Receipt(7,at));
});
