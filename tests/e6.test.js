import test from "node:test";
import assert from "node:assert/strict";
import {
 E6_PROTOCOL,E6_MODEL,E6_MODES,E6_FRICTIONS,E6_TORQUES,E6_DT,E6_DURATION,
 e6Command,e6LocalAnchors,e6GroundContact,simulateE6,buildE6Receipt,e6Csv,
} from "../src/e6.js";

test("smooth morph schedule starts round, holds square and returns round",()=>{
 for(const [time,want] of [[0,0],[1,0],[2,0.5],[3,1],[4,1],[5,0.5],[6,0],[8,0]]){
   const {alpha,alphaRate}=e6Command("morph-cycle",time);
   assert.ok(Math.abs(alpha-want)<1e-9,time);
   if([0,1,3,4,6,8].includes(time))assert.ok(Math.abs(alphaRate)<1e-10,time);
 }
 assert.equal(e6Command("round",3).alpha,0);
 assert.equal(e6Command("square",3).alpha,1);
 assert.notDeepEqual(e6LocalAnchors("morph-cycle",0),e6LocalAnchors("morph-cycle",3));
});

test("unilateral contact force never pulls, and friction is dissipative",()=>{
 assert.deepEqual(e6GroundContact(0.5,2,-10,0.8),{
   normal:0,friction:0,closing:0,penetration:0
 });
 const f=e6GroundContact(0.10,2,-2,0.8);
 assert.ok(f.normal>0);
 assert.ok(f.friction<0&&Math.abs(f.friction)<=0.8*f.normal);
 const other=e6GroundContact(0.10,-2,1,0.8);
 assert.ok(other.friction>0);
 assert.equal(e6GroundContact(-2,4,-4,0.8,false).normal,0);
 assert.equal(e6GroundContact(0.1,3,-2,0).friction,0);
});

test("round and square fixed modes have zero actuator command work",()=>{
 for(const mode of ["round","square"]){
   const s=simulateE6({mode});
   assert.equal(s.numericallyFinite,true);
   assert.equal(s.metrics.actuatorNetWork,0);
   assert.equal(s.metrics.actuatorPositiveWork,0);
   assert.equal(s.metrics.actuatorNegativeWork,0);
 }
});

test("morph cycle does nonzero actuator work with signed and gross accounting",()=>{
 const s=simulateE6({mode:"morph-cycle"});
 assert.equal(s.numericallyFinite,true);
 assert.ok(s.metrics.actuatorPositiveWork>0);
 assert.ok(s.metrics.actuatorNegativeWork<0);
 assert.ok(s.metrics.peakActuatorPowerMagnitude>0);
 assert.ok(s.metrics.peakActuatorForce>0);
 assert.ok(Math.abs(s.metrics.actuatorNetWork-
   s.metrics.actuatorPositiveWork-s.metrics.actuatorNegativeWork)<3e-6);
 assert.ok(Number.isFinite(s.metrics.relativeEnergyResidual));
});

test("no-ground removes all contact force and horizontal motion",()=>{
 const s=simulateE6({mode:"morph-cycle",mu:0.8,contactEnabled:false});
 assert.equal(s.numericallyFinite,true);
 assert.equal(s.metrics.normalImpulse,0);
 assert.equal(s.metrics.frictionImpulse,0);
 assert.equal(s.metrics.horizontalTravel,0);
 assert.equal(s.metrics.contactFraction,0);
});

test("no friction removes horizontal contact impulse and travel",()=>{
 const s=simulateE6({mode:"morph-cycle",mu:0,torque:0.8});
 assert.equal(s.numericallyFinite,true);
 assert.equal(s.metrics.frictionImpulse,0);
 assert.equal(s.metrics.horizontalTravel,0);
 assert.ok(s.metrics.normalImpulse>=0);
});

test("disabling morph command has the frozen round baseline and no actuator work",()=>{
 const a=simulateE6({mode:"morph-cycle",actuationEnabled:false});
 const b=simulateE6({mode:"round",actuationEnabled:true});
 assert.deepEqual(a.metrics,b.metrics);
 assert.equal(a.metrics.actuatorPositiveWork,0);
});

test("energy-work residual agrees with independently summed ledger fields",()=>{
 const m=simulateE6({mode:"morph-cycle",mu:0.8,torque:0.8,load:2}).metrics;
 const sum=m.motorWork+m.actuatorNetWork+m.hubDampingWork+
   m.nodeDampingWork+m.rotationDampingWork+m.spokeDampingWork+
   m.rimDampingWork+m.frictionWork+m.groundDampingWork;
 assert.ok(Math.abs((m.deltaEnergy-sum)-m.energyResidual)<9e-6);
 assert.ok(m.nodeDampingWork<=0&&m.rimDampingWork<=0);
 assert.ok(m.frictionWork<=0&&m.groundDampingWork<=0);
});

test("all 18 scenario combinations are finite and receipts deterministic",()=>{
 for(const mode of E6_MODES)for(const mu of E6_FRICTIONS)
  for(const torque of E6_TORQUES){
   const s=simulateE6({mode,mu,torque});
   assert.equal(s.numericallyFinite,true,mode+":"+mu+":"+torque);
   assert.ok(Object.values(s.metrics).every(Number.isFinite));
  }
 const at="2026-10-10T00:00:00Z";
 const a=buildE6Receipt({load:2,recordedAt:at});
 const b=buildE6Receipt({load:2,recordedAt:at});
 assert.deepEqual(a,b);
 assert.equal(a.protocol,E6_PROTOCOL);
 assert.equal(a.modelVersion,E6_MODEL);
 assert.equal(a.origin,"SIMULATED");
 assert.equal(a.physicalValidation,"NONE");
 assert.equal(a.runs.length,18);
 assert.equal(a.negativeControls.length,3);
 assert.equal(a.timeStepChecks.length,3);
 assert.ok(a.runs.every(r=>r.numericallyFinite&&r.metrics));
 assert.equal(e6Csv(a).trim().split("\n").length,19);
});

test("morph animation returns deterministic endpoints and 24-node frames",()=>{
 const a=simulateE6({captureFrames:true});
 const b=simulateE6({captureFrames:true});
 assert.deepEqual(a,b);
 assert.equal(a.frames[0].time,0);
 assert.equal(a.frames.at(-1).time,E6_DURATION);
 assert.equal(a.frames[0].nodes.length,24);
 assert.equal(a.frames.at(-1).anchors.length,24);
});

test("unsupported controls fail closed",()=>{
 assert.throws(()=>e6Command("magic",2));
 assert.throws(()=>e6Command("round",-1));
 assert.throws(()=>simulateE6({mode:"unknown"}));
 assert.throws(()=>simulateE6({mu:0.5}));
 assert.throws(()=>simulateE6({torque:-1}));
 assert.throws(()=>simulateE6({dt:0.008}));
 assert.throws(()=>simulateE6({load:0}));
 assert.throws(()=>simulateE6({contactEnabled:42}));
 assert.throws(()=>simulateE6({duration:9}));
 assert.throws(()=>buildE6Receipt({load:9}));
});
