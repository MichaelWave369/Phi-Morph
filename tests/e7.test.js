import test from "node:test";
import assert from "node:assert/strict";
import {
 E7_PROTOCOL,E7_MODEL,E7_FORCE_LIMITS,E7_STROKES,E7_CYCLES,E7_PERIOD,
 e7ServoForce,e7LocalTargets,simulateE7,buildE7Receipt,e7Csv
} from "../src/e7.js";

test("target schedule repeats without jumps and command-zero freezes circle",()=>{
  for(const t of [0,1,3,4,6,8,9,11,12,14,16]){
    const a=e7LocalTargets(t,1);
    const b=e7LocalTargets(t%E7_PERIOD,1);
    assert.deepEqual(a,b);
    assert.equal(a.length,24);
  }
  assert.deepEqual(e7LocalTargets(3,1,false),e7LocalTargets(3,0,true));
  assert.notDeepEqual(e7LocalTargets(0,1),e7LocalTargets(3,1));
  for(const t of [0,8,16,24]) assert.deepEqual(
    e7LocalTargets(t,1),e7LocalTargets(0,1));
});

test("force is capped in full vector magnitude and collinear with separation",()=>{
  const high=e7ServoForce(3,4,0,10);
  assert.equal(high.appliedMagnitude,10);
  assert.equal(Math.hypot(high.fx,high.fy),10);
  assert.equal(high.saturated,true);
  assert.ok(Math.abs(3*high.fy-4*high.fx)<1e-12);
  const off=e7ServoForce(3,4,2,0);
  assert.equal(off.appliedMagnitude,0);
  assert.equal(off.fx,0);assert.equal(off.fy,0);
  assert.equal(off.saturated,true);
  const free=e7ServoForce(3,4,0,null);
  assert.equal(free.saturated,false);
  assert.ok(free.appliedMagnitude>high.appliedMagnitude);
  assert.throws(()=>e7ServoForce(1,1,0,-1));
});

test("zero-force servos deliver zero work and cap their applied force",()=>{
  const a=simulateE7({forceLimit:0,stroke:1});
  assert.equal(a.numericallyFinite,true);
  assert.equal(a.metrics.totalPositiveServoWork,0);
  assert.equal(a.metrics.netServoMechanicalWork,0);
  assert.equal(a.metrics.maxAppliedServoForce,0);
  assert.ok(a.metrics.forceCapHitCount>0);
});

test("all selected finite force caps are respected in simulated trajectory",()=>{
 for(const forceLimit of [0,4,10]){
   const a=simulateE7({forceLimit,stroke:1,cycles:1});
   assert.equal(a.numericallyFinite,true);
   assert.ok(a.metrics.maxAppliedServoForce<=forceLimit+0.000002);
   assert.ok(a.metrics.forceCapHitFraction>=0&&a.metrics.forceCapHitFraction<=1);
 }
});

test("stroke zero, disabled command, and full stroke have distinct semantics",()=>{
 const a=simulateE7({forceLimit:10,stroke:0});
 const b=simulateE7({forceLimit:10,stroke:1,commandEnabled:false});
 const c=simulateE7({forceLimit:10,stroke:1});
 assert.deepEqual(a.metrics,b.metrics);
 assert.equal(a.metrics.commandedAnchorBoundaryWork,0);
 assert.ok(c.metrics.commandedAnchorBoundaryWork!==0);
});

test("no ground and no friction do not inject contact impulses",()=>{
 const a=simulateE7({forceLimit:10,stroke:1,contactEnabled:false,mu:0.8});
 assert.equal(a.numericallyFinite,true);
 assert.equal(a.metrics.normalImpulse,0);
 assert.equal(a.metrics.frictionImpulse,0);
 assert.equal(a.metrics.contactTimeFraction,0);
 const b=simulateE7({forceLimit:10,stroke:1,mu:0});
 assert.equal(b.metrics.frictionImpulse,0);
});

test("repeated cycles retain their previous dynamic state and report every cycle",()=>{
 const a=simulateE7({forceLimit:4,stroke:1,cycles:3});
 const b=simulateE7({forceLimit:4,stroke:1,cycles:3});
 assert.equal(a.numericallyFinite,true);
 assert.deepEqual(a,b);
 assert.equal(a.cycleSummaries.length,3);
 assert.deepEqual(a.cycleSummaries.map(c=>c.cycle),[1,2,3]);
 assert.ok(a.cycleSummaries.every(c=>
   Number.isFinite(c.positiveServoWork)&&c.positiveServoWork>=0 &&
   Number.isFinite(c.maxRimStrainProxy)));
 assert.ok(Math.abs(a.cycleSummaries.reduce((s,c)=>s+c.horizontalTravelDelta,0)-
   a.metrics.horizontalTravel)<0.000005);
 assert.ok(a.cycleSummaries.reduce((s,c)=>s+c.saturatedNodeSteps,0)===
   a.metrics.forceCapHitCount);
});

test("positive + negative actuator work gives net, paired moment residual is zero",()=>{
 const a=simulateE7({forceLimit:10,stroke:1,cycles:3,mu:0.8});
 const m=a.metrics;
 assert.ok(Math.abs(m.totalPositiveServoWork+m.totalNegativeServoWork-
   m.netServoMechanicalWork)<0.000004);
 assert.ok(m.maxPairTorqueResidual<1e-6);
 assert.ok(Math.abs(m.commandedAnchorBoundaryWork+m.servoTrackingWork-
   m.netServoMechanicalWork)<0.000005);
 assert.ok(m.rimDampingWork<=0 && m.nodeDragWork<=0);
 assert.ok(m.frictionWork<=0 && m.floorDampingWork<=0);
});

test("work/energy ledger reconciles to explicit integration residual",()=>{
 const m=simulateE7({forceLimit:10,stroke:1,cycles:1}).metrics;
 const works=m.netServoMechanicalWork+m.motorWork+m.rimDampingWork+
   m.hubDragWork+m.nodeDragWork+m.angularDragWork+
   m.frictionWork+m.floorDampingWork;
 assert.ok(Math.abs((m.energyDelta-works)-m.energyResidual)<0.000008);
 assert.ok(m.relativeEnergyResidual>=0);
});

test("animated trajectory includes rim masses, anchors, endpoint and time",()=>{
 const a=simulateE7({forceLimit:4,stroke:1,cycles:1,captureFrames:true});
 const b=simulateE7({forceLimit:4,stroke:1,cycles:1,captureFrames:true});
 assert.deepEqual(a,b);
 assert.equal(a.frames[0].time,0);
 assert.equal(a.frames.at(-1).time,E7_PERIOD);
 assert.equal(a.frames.at(-1).nodes.length,24);
 assert.equal(a.frames.at(-1).anchors.length,24);
});

test("invalid policies are rejected rather than silently clamped",()=>{
 assert.throws(()=>e7LocalTargets(-1));
 assert.throws(()=>e7LocalTargets(1,0.22));
 assert.throws(()=>e7ServoForce(1,1,Number.NaN,4));
 assert.throws(()=>simulateE7({forceLimit:Infinity}));
 assert.throws(()=>simulateE7({forceLimit:-1}));
 assert.throws(()=>simulateE7({cycles:20}));
 assert.throws(()=>simulateE7({stroke:0.27}));
 assert.throws(()=>simulateE7({dt:0.01}));
 assert.throws(()=>simulateE7({mu:0.12}));
 assert.throws(()=>simulateE7({load:8}));
 assert.throws(()=>simulateE7({contactEnabled:1}));
 assert.throws(()=>buildE7Receipt({load:8}));
});

test("receipt spans 24 cases, 4 controls and one dt diagnostic",()=>{
 const stamp="2026-10-10T00:00:00Z";
 const a=buildE7Receipt({recordedAt:stamp});
 assert.equal(a.protocol,E7_PROTOCOL);
 assert.equal(a.modelVersion,E7_MODEL);
 assert.equal(a.origin,"SIMULATED");
 assert.equal(a.physicalValidation,"NONE");
 assert.deepEqual(a.frozen.forceLimits,E7_FORCE_LIMITS);
 assert.deepEqual(a.frozen.strokeFractions,E7_STROKES);
 assert.deepEqual(a.frozen.cycleCounts,E7_CYCLES);
 assert.equal(a.cases.length,24);
 assert.equal(a.negativeControls.length,4);
 assert.ok(a.cases.every(c=>c.numericallyFinite&&c.metrics));
 assert.ok(a.cases.every(c=>c.cycleSummaries.length===c.cycles));
 assert.ok(a.negativeControls.every(c=>c.numericallyFinite));
 assert.equal(a.timeStepDiagnostic.coarseDt,0.005);
 assert.equal(a.timeStepDiagnostic.fineDt,0.0025);
 assert.deepEqual(a,buildE7Receipt({recordedAt:stamp}));
 assert.equal(e7Csv(a).trim().split("\n").length,25);
});
