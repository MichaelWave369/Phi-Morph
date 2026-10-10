import test from "node:test";
import assert from "node:assert/strict";
import {simulateE8} from "../src/e8.js";
import {
 E9_PROTOCOL,E9_MODEL,E9_PROFILES,E9_FORCE_LIMITS,E9_POWER_LIMITS,
 simulateE9,buildE9Receipt,e9Csv
} from "../src/e9.js";

test("uncoupled generalized actuator reproduces the E8 PD benchmark",()=>{
 for(const profile of E9_PROFILES)for(const forceLimit of [0,4,10])
  for(const powerLimit of [0,2,null]){
    const a=simulateE8({profile,forceLimit,powerLimit,
      cycles:1,loadSpring:2,loadDamping:.7});
    const b=simulateE9({profile,forceLimit,powerLimit,cycles:1,
      spokesEnabled:false});
    assert.equal(b.numericallyFinite,true);
    assert.equal(b.metrics.finalQ,a.metrics.finalPosition,
      profile+":"+forceLimit+":"+powerLimit);
    assert.equal(b.metrics.netDriveWork,a.metrics.netMechanicalWork);
    assert.equal(b.metrics.grossPositiveDriveWork,
      a.metrics.totalPositiveMechanicalWork);
  }
});

test("coupling changes achieved actuator movement under the same command",()=>{
 const base=simulateE9({spokesEnabled:false,profile:"medium",
   forceLimit:10,powerLimit:2});
 const coupled=simulateE9({spokesEnabled:true,profile:"medium",
   forceLimit:10,powerLimit:2});
 assert.equal(coupled.numericallyFinite,true);
 assert.ok(Math.abs(base.metrics.finalQ-coupled.metrics.finalQ)>0.000001);
 assert.ok(coupled.metrics.maxSpokeForce>0);
 assert.equal(base.metrics.maxSpokeForce,0);
});

test("zero drive force and zero sampled power do no controller mechanical work",()=>{
 const noForce=simulateE9({forceLimit:0,powerLimit:2});
 assert.equal(noForce.metrics.peakAppliedDrive,0);
 assert.equal(noForce.metrics.netDriveWork,0);
 const noPower=simulateE9({forceLimit:10,powerLimit:0});
 assert.equal(noPower.metrics.peakSampledDrivePower,0);
 assert.equal(noPower.metrics.grossPositiveDriveWork,0);
});

test("friction-disabled and floor-disabled cases produce no contact impulses",()=>{
 const noFriction=simulateE9({mu:0});
 assert.equal(noFriction.metrics.frictionImpulse,0);
 assert.equal(noFriction.metrics.floorFrictionWork,0);
 const noFloor=simulateE9({groundEnabled:false,mu:.8});
 assert.equal(noFloor.metrics.normalImpulse,0);
 assert.equal(noFloor.metrics.frictionImpulse,0);
 assert.equal(noFloor.metrics.floorDampingWork,0);
});

test("power and force bounds hold at sampled integration states",()=>{
 for(const profile of E9_PROFILES)for(const forceLimit of E9_FORCE_LIMITS)
  for(const powerLimit of E9_POWER_LIMITS){
   const r=simulateE9({profile,forceLimit,powerLimit});
   assert.equal(r.numericallyFinite,true,profile+":"+forceLimit+":"+powerLimit);
   assert.ok(Object.values(r.metrics).every(Number.isFinite));
   assert.ok(r.metrics.peakAppliedDrive<=forceLimit+1e-6);
   if(powerLimit!==null)assert.ok(r.metrics.peakSampledDrivePower<=powerLimit+1e-6);
   assert.ok(r.metrics.forceCapHitFraction>=0&&r.metrics.forceCapHitFraction<=1);
   assert.ok(r.metrics.powerCapHitFraction>=0&&r.metrics.powerCapHitFraction<=1);
   assert.ok(r.metrics.maxSpokeForce>=0);
  }
});

test("controller mechanical-work components and conservative energy budget reconcile",()=>{
 const m=simulateE9({forceLimit:10,powerLimit:2,torque:.8}).metrics;
 assert.ok(Math.abs(m.netDriveWork-m.grossPositiveDriveWork-
   m.negativeDriveWork)<0.000004);
 const works=m.netDriveWork+m.motorWork+m.qDragWork+m.hubDragWork+
   m.rotationDragWork+m.nodeDragWork+m.spokeDampingWork+
   m.rimDampingWork+m.floorFrictionWork+m.floorDampingWork;
 assert.ok(Math.abs((m.energyDelta-works)-m.energyResidual)<0.000010);
 for(const name of ["qDragWork","hubDragWork","nodeDragWork","spokeDampingWork",
   "rimDampingWork","floorFrictionWork","floorDampingWork"])
   assert.ok(m[name]<=1e-8,name);
 assert.ok(m.relativeEnergyResidual>=0);
});

test("continuous repeated cycle simulation preserves final snapshots",()=>{
 const args={cycles:2,profile:"slow",forceLimit:4,powerLimit:2,captureFrames:true};
 const a=simulateE9(args),b=simulateE9(args);
 assert.deepEqual(a,b);
 assert.equal(a.summaries.length,2);
 assert.equal(a.frames[0].time,0);
 assert.equal(a.frames.at(-1).time,16);
 assert.equal(a.frames[0].nodes.length,24);
 assert.equal(a.frames[0].anchors.length,24);
 assert.ok(a.summaries.every(s=>Number.isFinite(s.commandResponseLoopArea)));
});

test("E9 study receipt has 27 simulations and 5 explicit controls",()=>{
 const at="2026-10-10T00:00:00Z";
 const a=buildE9Receipt({recordedAt:at});
 assert.equal(a.origin,"SIMULATED");
 assert.equal(a.physicalValidation,"NONE");
 assert.equal(a.protocol,E9_PROTOCOL);
 assert.equal(a.modelVersion,E9_MODEL);
 assert.equal(a.runs.length,27);
 assert.equal(a.negativeControls.length,5);
 assert.ok(a.runs.every(r=>r.numericallyFinite&&r.metrics));
 assert.ok(a.negativeControls.every(r=>r.numericallyFinite));
 assert.equal(e9Csv(a).trim().split("\n").length,28);
 assert.deepEqual(a,buildE9Receipt({recordedAt:at}));
});

test("invalid inputs reject without silent correction",()=>{
 assert.throws(()=>simulateE9({profile:"turbo"}));
 assert.throws(()=>simulateE9({forceLimit:-1}));
 assert.throws(()=>simulateE9({forceLimit:3}));
 assert.throws(()=>simulateE9({powerLimit:3}));
 assert.throws(()=>simulateE9({cycles:5}));
 assert.throws(()=>simulateE9({mu:1.1}));
 assert.throws(()=>simulateE9({load:0}));
 assert.throws(()=>simulateE9({dt:.004}));
 assert.throws(()=>simulateE9({spokesEnabled:0}));
 assert.throws(()=>simulateE9({groundEnabled:0}));
 assert.throws(()=>buildE9Receipt({cycles:3}));
});
