import test from "node:test";
import assert from "node:assert/strict";
import { simulateE4 } from "../src/e4.js";
import {
  E5_PROTOCOL,E5_MODEL,E5_COUNTS,E5_STEPS,E5_SHAPES,E5_DURATION,
  makeE5Outline,simulateE5,buildE5Receipt,e5Csv
} from "../src/e5.js";

test("all E5 outlines are centered and have equal RMS starting radius", () => {
  for(const shape of E5_SHAPES)for(const count of E5_COUNTS){
    const p=makeE5Outline(shape,count);
    assert.equal(p.length,count);
    const mx=p.reduce((s,x)=>s+x.x,0)/count;
    const my=p.reduce((s,x)=>s+x.y,0)/count;
    assert.ok(Math.abs(mx)<1e-9 && Math.abs(my)<1e-9);
    const rms=Math.sqrt(p.reduce((s,x)=>s+x.x*x.x+x.y*x.y,0)/count);
    assert.ok(Math.abs(rms-2.65)<1e-9);
  }
});

test("E5 24-point baseline reproduces E4 travel and orientation", () => {
  for(const shape of E5_SHAPES){
    const a=simulateE4({shape,mu:0.35,torque:0.8,load:2,
      dt:0.005,duration:E5_DURATION});
    const b=simulateE5({shape,count:24,mu:0.35,torque:0.8,load:2,
      dt:0.005,duration:E5_DURATION});
    assert.ok(Math.abs(a.metrics.horizontalTravel-b.metrics.horizontalTravel)<1e-5);
    assert.ok(Math.abs(a.metrics.finalAngleDegrees-b.metrics.finalAngleDegrees)<1e-5);
    assert.ok(Math.abs(a.metrics.normalImpulseProxy-b.metrics.normalImpulse)<1e-5);
  }
});

test("all 18 shape x rim resolution x timestep studies remain finite", () => {
  for(const shape of E5_SHAPES)for(const count of E5_COUNTS)for(const dt of E5_STEPS){
    const r=simulateE5({shape,count,dt});
    assert.equal(r.numericallyFinite,true,shape+":"+count+":"+dt);
    assert.ok(r.steps*dt===E5_DURATION);
    assert.ok(Object.values(r.metrics).every(Number.isFinite));
    assert.ok(r.metrics.relativeEnergyResidual>=0);
    assert.ok(r.metrics.maxNumericalPenetration>=0);
    assert.ok(r.metrics.contactFraction>=0 && r.metrics.contactFraction<=1);
    assert.ok(r.metrics.frictionWork<=1e-8);
    assert.ok(r.metrics.normalDampingWork<=1e-8);
  }
});

test("removing the ground removes impulse and horizontal motion",()=>{
  for(const shape of E5_SHAPES){
    const r=simulateE5({shape,contactEnabled:false,mu:0.8,torque:1.6});
    assert.equal(r.metrics.normalImpulse,0);
    assert.equal(r.metrics.frictionImpulse,0);
    assert.equal(r.metrics.horizontalTravel,0);
    assert.equal(r.metrics.finalContactPotential,0);
  }
});

test("zero friction transfers no tangential impulse or horizontal translation",()=>{
  for(const shape of E5_SHAPES)for(const count of E5_COUNTS){
    const r=simulateE5({shape,count,mu:0,torque:1.6});
    assert.equal(r.metrics.frictionImpulse,0);
    assert.equal(r.metrics.frictionWork,0);
    assert.equal(r.metrics.horizontalTravel,0);
  }
});

test("bookkeeping identity holds with rounded metrics to declared precision",()=>{
  const r=simulateE5({shape:"rounded-square",count:48,dt:0.0025,
    mu:0.8,torque:1.6,load:4});
  const m=r.metrics;
  const sumWork=m.motorWork + m.translationalDragWork +
    m.angularDragWork+m.frictionWork+m.normalDampingWork;
  assert.ok(Math.abs((m.deltaEnergy-sumWork)-m.energyBalanceResidual)<0.000004);
  assert.ok(Math.abs(m.finalEnergy-m.initialEnergy-m.deltaEnergy)<0.000004);
});

test("frames have a final endpoint and deterministic timeline",()=>{
  const input={shape:"rounded-square",count:48,dt:0.005,captureFrames:true};
  const a=simulateE5(input),b=simulateE5(input);
  assert.deepEqual(a,b);
  assert.equal(a.frames[0].time,0);
  assert.equal(a.frames.at(-1).time,E5_DURATION);
  assert.equal(a.frames[0].nodes.length,48);
});

test("unsupported model inputs are refused",()=>{
  assert.throws(()=>makeE5Outline("oval",24));
  assert.throws(()=>makeE5Outline("circle",12));
  assert.throws(()=>simulateE5({count:12}));
  assert.throws(()=>simulateE5({dt:0.003}));
  assert.throws(()=>simulateE5({mu:-0.1}));
  assert.throws(()=>simulateE5({load:3}));
  assert.throws(()=>simulateE5({contactEnabled:1}));
  assert.throws(()=>simulateE5({duration:7}));
  assert.throws(()=>buildE5Receipt({torque:5}));
});

test("receipt freezes 18 runs, four controls, numerical deltas and evidence origin",()=>{
  const at="2026-10-10T00:00:00Z";
  const a=buildE5Receipt({mu:0.35,torque:0.8,load:2,recordedAt:at});
  assert.equal(a.protocol,E5_PROTOCOL);
  assert.equal(a.modelVersion,E5_MODEL);
  assert.equal(a.origin,"SIMULATED");
  assert.equal(a.physicalValidation,"NONE");
  assert.equal(a.runs.length,18);
  assert.equal(a.numericalChecks.length,6);
  assert.equal(a.negativeControls.length,4);
  assert.ok(a.runs.every(r=>r.numericallyFinite&&r.metrics));
  assert.ok(a.negativeControls.filter(c=>c.kind==="no-ground").every(
    c=>c.normalImpulse===0&&c.frictionImpulse===0&&c.horizontalTravel===0));
  assert.ok(a.negativeControls.filter(c=>c.kind==="no-friction").every(
    c=>c.frictionImpulse===0&&c.horizontalTravel===0));
  assert.deepEqual(a,buildE5Receipt({mu:0.35,torque:0.8,load:2,recordedAt:at}));
  assert.equal(e5Csv(a).trim().split("\n").length,19);
});
