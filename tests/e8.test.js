import test from "node:test";
import assert from "node:assert/strict";
import {
 E8_PROTOCOL,E8_MODEL,E8_PROFILES,E8_FORCE_LIMITS,E8_POWER_LIMITS,
 e8Target,e8LimitedForce,e8LoopArea,e8AnalyticalStep,
 simulateE8,buildE8Receipt,e8Csv
} from "../src/e8.js";

test("E8 follows the same normalized round-square-round target as E7 schedule",()=>{
 for(const [t,a] of [[0,0],[1,0],[2,.5],[3,1],[4,1],[5,.5],[6,0],[8,0],[10,.5]]){
   assert.ok(Math.abs(e8Target(t)-a)<1e-12,String(t));
 }
 assert.equal(e8Target(2,"cycle",.5),.25);
 assert.equal(e8Target(4,"off"),0);
 assert.equal(e8Target(0,"step"),1);
});

test("force bound and instantaneous sampled power cap hold together",()=>{
 const capped=e8LimitedForce(30,2,10,2);
 assert.equal(capped.applied,1);
 assert.equal(capped.sampledMechanicalPower,2);
 assert.equal(capped.forceSaturated,true);
 assert.equal(capped.powerSaturated,true);
 const resting=e8LimitedForce(30,0,10,0);
 assert.equal(resting.applied,10);
 assert.equal(resting.sampledMechanicalPower,0);
 const negative=e8LimitedForce(-30,2,10,2);
 assert.equal(negative.applied,-1);
 assert.ok(Math.abs(negative.sampledMechanicalPower)<=2);
 const off=e8LimitedForce(10,4,0,2);
 assert.equal(off.applied,0);
 assert.throws(()=>e8LimitedForce(Infinity,1,10,2));
 assert.throws(()=>e8LimitedForce(10,1,-1,2));
});

test("command-position polygon is exact for simple loop",()=>{
 assert.equal(e8LoopArea([]),0);
 assert.equal(e8LoopArea([
   {command:0,position:0},{command:1,position:0},
   {command:1,position:1},{command:0,position:1}
 ]),1);
 assert.throws(()=>e8LoopArea([{command:0,position:NaN},{command:1,position:1}]));
});

test("analytical linear step reference meets initial and final conditions",()=>{
 for(const p of E8_PROFILES){
   assert.ok(Math.abs(e8AnalyticalStep(0,p))<1e-12);
   assert.ok(Math.abs(e8AnalyticalStep(30,p)-1)<1e-8);
 }
});

test("unbounded no-load PD step agrees with independent closed-form solution",()=>{
 for(const profile of E8_PROFILES){
   for(const time of [0.5,1,2]){
     const result=simulateE8({profile,command:"step",stroke:1,
       forceLimit:null,powerLimit:null,loadSpring:0,loadDamping:0,
       dt:.0025,duration:time,captureFrames:true});
     assert.equal(result.numericallyFinite,true);
     const numeric=result.metrics.finalPosition;
     const analytic=e8AnalyticalStep(time,profile);
     assert.ok(Math.abs(numeric-analytic)<0.025,
       profile+" at "+time+": "+numeric+" vs "+analytic);
   }
 }
});

test("zero input command keeps position at zero and has no mechanical work",()=>{
 const a=simulateE8({command:"off",cycles:3});
 assert.equal(a.numericallyFinite,true);
 assert.equal(a.metrics.finalPosition,0);
 assert.equal(a.metrics.totalPositiveMechanicalWork,0);
 assert.equal(a.metrics.totalNegativeMechanicalWork,0);
 assert.equal(a.metrics.integratedAbsoluteLag,0);
});

test("zero force and zero power controls perform no positive mechanical work",()=>{
 const noForce=simulateE8({forceLimit:0,powerLimit:2,cycles:1});
 assert.equal(noForce.metrics.totalPositiveMechanicalWork,0);
 assert.equal(noForce.metrics.peakAppliedForce,0);
 const noPower=simulateE8({forceLimit:10,powerLimit:0,cycles:1});
 assert.equal(noPower.metrics.totalPositiveMechanicalWork,0);
 assert.equal(noPower.metrics.peakSampledMechanicalPower,0);
});

test("all 27 finite-study cases respect their specified force and power limits",()=>{
 for(const profile of E8_PROFILES)for(const forceLimit of E8_FORCE_LIMITS)
  for(const powerLimit of E8_POWER_LIMITS){
   const a=simulateE8({profile,forceLimit,powerLimit});
   assert.equal(a.numericallyFinite,true,profile+":"+forceLimit+":"+powerLimit);
   assert.ok(Object.values(a.metrics).every(Number.isFinite));
   assert.ok(a.metrics.peakAppliedForce<=forceLimit+1e-6);
   if(powerLimit!==null)
     assert.ok(a.metrics.peakSampledMechanicalPower<=powerLimit+1e-6);
   assert.ok(a.metrics.forceCapHitFraction>=0&&a.metrics.forceCapHitFraction<=1);
   assert.ok(a.metrics.powerCapHitFraction>=0&&a.metrics.powerCapHitFraction<=1);
 }
});

test("mechanical work energy audit explicitly records numerical residual",()=>{
 const m=simulateE8({profile:"fast",forceLimit:10,powerLimit:2}).metrics;
 const sum=m.totalPositiveMechanicalWork+m.totalNegativeMechanicalWork+
   m.externalLoadDragWork;
 assert.ok(Math.abs((m.finalStoredModelEnergy-sum)-m.energyResidual)<0.000005);
 assert.ok(m.externalLoadDragWork<=0);
 assert.ok(m.totalPositiveMechanicalWork>=0);
 assert.ok(m.totalNegativeMechanicalWork<=0);
});

test("repeated cycles retain state and produce one entry per full cycle",()=>{
 const a=simulateE8({profile:"medium",forceLimit:10,powerLimit:2,cycles:3});
 const b=simulateE8({profile:"medium",forceLimit:10,powerLimit:2,cycles:3});
 assert.deepEqual(a,b);
 assert.equal(a.cycleSummaries.length,3);
 assert.ok(a.cycleSummaries.every(c=>Number.isFinite(c.commandResponseLoopArea)));
 assert.ok(Math.abs(a.cycleSummaries.reduce((s,c)=>s+c.positiveWork,0)-
   a.metrics.totalPositiveMechanicalWork)<4e-6);
});

test("animation and calibrated-only analytic receipts have clear provenance",()=>{
 const a=simulateE8({captureFrames:true});
 assert.equal(a.frames[0].time,0);
 assert.equal(a.frames.at(-1).time,8);
 assert.equal(a.frames[0].position,0);
 const at="2026-10-10T00:00:00Z";
 const r=buildE8Receipt({recordedAt:at});
 assert.equal(r.protocol,E8_PROTOCOL);
 assert.equal(r.modelVersion,E8_MODEL);
 assert.equal(r.origin,"SIMULATED");
 assert.equal(r.physicalValidation,"NONE");
 assert.equal(r.runs.length,27);
 assert.equal(r.negativeControls.length,4);
 assert.equal(r.analyticalStepReference.length,3);
 assert.ok(r.analyticalStepReference.every(c=>c.absoluteDelta<0.025));
 assert.deepEqual(r,buildE8Receipt({recordedAt:at}));
 assert.equal(e8Csv(r).trim().split("\n").length,28);
});

test("all unsupported controls are rejected",()=>{
 assert.throws(()=>e8Target(-1));
 assert.throws(()=>simulateE8({profile:"turbo"}));
 assert.throws(()=>simulateE8({forceLimit:3}));
 assert.throws(()=>simulateE8({powerLimit:-1}));
 assert.throws(()=>simulateE8({loadSpring:100}));
 assert.throws(()=>simulateE8({cycles:4}));
 assert.throws(()=>simulateE8({dt:.004}));
 assert.throws(()=>simulateE8({command:"magic"}));
 assert.throws(()=>buildE8Receipt({cycles:2}));
});
