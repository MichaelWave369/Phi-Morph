import test from "node:test";
import assert from "node:assert/strict";
import {
 E10_PROTOCOL,E10_SCHEMA,E10_COLUMNS,
 E10_MAX_BYTES,E10_MAX_SAMPLES,
 parseE10Csv,validateE10Samples,analyzeE10Samples,
 makeE10SyntheticExample,e10SamplesCsv,e10BlankTemplate,
} from "../src/e10.js";

const sample=[
 {time_s:0,command_m:0,displacement_m:0,force_N:10,voltage_V:12,current_A:1,temperature_C:25},
 {time_s:1,command_m:.01,displacement_m:.005,force_N:10,voltage_V:12,current_A:1,temperature_C:26},
 {time_s:2,command_m:.02,displacement_m:.02,force_N:10,voltage_V:12,current_A:1,temperature_C:27},
];

test("template specifies exactly seven strictly named SI fields",()=>{
 assert.deepEqual(E10_COLUMNS,[
  "time_s","command_m","displacement_m","force_N",
  "voltage_V","current_A","temperature_C",
 ]);
 assert.equal(e10BlankTemplate(),E10_COLUMNS.join(",")+"\n");
});

test("CSV round-trip supports arbitrary header order, CRLF and UTF-8 BOM",()=>{
 const normal=e10SamplesCsv(sample);
 assert.deepEqual(parseE10Csv(normal),sample);
 assert.deepEqual(parseE10Csv("\uFEFF"+normal.replace(/\n/g,"\r\n")),sample);
 const head=[...E10_COLUMNS].reverse();
 const reordered=head.join(",")+"\n"+
  sample.map(row=>head.map(k=>row[k]).join(",")).join("\n")+"\n";
 assert.deepEqual(parseE10Csv(reordered),sample);
});

test("quoted numbers and properly escaped RFC-like fields are handled",()=>{
 const csv=E10_COLUMNS.join(",")+"\n"+
  sample.map(row=>E10_COLUMNS.map((k,i)=>
    i===0?'"'+row[k]+'"':String(row[k])).join(",")).join("\n");
 assert.deepEqual(parseE10Csv(csv),sample);
 assert.throws(()=>parseE10Csv(csv.replace('"0"', '"0"abc')));
 assert.throws(()=>parseE10Csv(csv.replace('"0"', '"0')));
});

test("CSV parser rejects missing columns, invalid data and extra rows",()=>{
 const valid=e10SamplesCsv(sample);
 assert.throws(()=>parseE10Csv(valid.replace("time_s,","")));
 assert.throws(()=>parseE10Csv(valid.replace("force_N","unknown_unit")));
 assert.throws(()=>parseE10Csv(valid.replace(",12,1,",",12,NaN,")));
 assert.throws(()=>parseE10Csv(valid.replace(",12,1,",",12,,")));
 assert.throws(()=>parseE10Csv(valid.replace("0.005","0.005,1")));
 assert.throws(()=>parseE10Csv(valid.repeat(E10_MAX_SAMPLES)));
 assert.throws(()=>parseE10Csv("x".repeat(E10_MAX_BYTES+1)));
});

test("all timestamps must strictly increase, temperatures stay above absolute zero",()=>{
 assert.throws(()=>validateE10Samples([sample[0],sample[0],sample[2]]));
 assert.throws(()=>validateE10Samples([...sample.slice(0,2),
  {...sample[2],time_s:0.5}]));
 assert.throws(()=>validateE10Samples([...sample.slice(0,2),
  {...sample[2],temperature_C:-300}]));
 assert.throws(()=>validateE10Samples(sample.slice(0,2)));
});

test("trapezoidal signed electrical and mechanical work have correct SI numbers",()=>{
 const receipt=analyzeE10Samples(sample,{recordedAt:"2026-10-10T00:00:00Z"});
 const m=receipt.metrics;
 assert.equal(receipt.protocol,E10_PROTOCOL);
 assert.equal(receipt.schema,E10_SCHEMA);
 assert.equal(receipt.origin,"USER_SUPPLIED_UNVERIFIED");
 assert.equal(receipt.verification,"NOT_INDEPENDENTLY_VERIFIED");
 assert.equal(m.duration_s,2);
 assert.equal(m.meanSamplingRate_Hz,1);
 assert.equal(m.positiveElectricalEnergy_J,24);
 assert.equal(m.negativeElectricalEnergy_J,0);
 assert.equal(m.netElectricalEnergy_J,24);
 assert.equal(m.positiveMechanicalWork_J,0.2);
 assert.equal(m.negativeMechanicalWork_J,0);
 assert.equal(m.peakAbsElectricalPower_W,12);
 assert.equal(m.maxTemperature_C,27);
 assert.equal(m.peakAbsForce_N,10);
 assert.equal(receipt.quality.actuatorEfficiencyEligible,false);
 assert.equal(receipt.quality.e9PhysicalScaleMappingEligible,false);
});

test("negative electrical/mechanical work is tracked separately, not called regeneration",()=>{
 const a=[
  {time_s:0,command_m:0,displacement_m:1,force_N:10,voltage_V:12,current_A:-1,temperature_C:25},
  {time_s:1,command_m:0,displacement_m:.5,force_N:10,voltage_V:12,current_A:-1,temperature_C:25},
  {time_s:2,command_m:0,displacement_m:0,force_N:10,voltage_V:12,current_A:-1,temperature_C:25},
 ];
 const m=analyzeE10Samples(a).metrics;
 assert.equal(m.negativeMechanicalWork_J,-10);
 assert.equal(m.negativeElectricalEnergy_J,-24);
 assert.equal(m.positiveElectricalEnergy_J,0);
 assert.equal(m.positiveMechanicalWork_J,0);
});

test("metadata cannot promote user uploads to VERIFIED or OBSERVED",()=>{
 const at="2026-10-10T00:00:00Z";
 for(const status of ["OBSERVED","VERIFIED","CALIBRATED","UNKNOWN"]){
  assert.throws(()=>analyzeE10Samples(sample,{origin:status,recordedAt:at}));
 }
 const r=analyzeE10Samples(sample,{origin:"USER_SUPPLIED_UNVERIFIED",
  calibrationReference:"CAL-123",deviceLabel:"Test rig",
  recordedAt:at});
 assert.equal(r.source.calibrationEvidenceStatus,"USER_ASSERTED_ONLY");
 assert.equal(r.quality.sensorCalibrationsVerified,false);
 assert.equal(r.physicalValidation,"NONE");
 assert.deepEqual(r,analyzeE10Samples(sample,{
  origin:"USER_SUPPLIED_UNVERIFIED",
  calibrationReference:"CAL-123",deviceLabel:"Test rig",
  recordedAt:at}));
});

test("synthetic example is deterministic, reimportable, and remains SIMULATED",()=>{
 const a=makeE10SyntheticExample(),b=makeE10SyntheticExample();
 assert.deepEqual(a,b);
 assert.equal(a.length,201);
 assert.deepEqual(parseE10Csv(e10SamplesCsv(a)),a);
 const r=analyzeE10Samples(a,{origin:"SIMULATED",
  filename:"SIMULATED-fixture.csv",
  recordedAt:"2026-10-10T00:00:00Z"});
 assert.equal(r.origin,"SIMULATED");
 assert.equal(r.verification,"NOT_INDEPENDENTLY_VERIFIED");
 assert.equal(r.quality.independentBenchmarkPassed,false);
 assert.ok(r.metrics.positiveElectricalEnergy_J>0);
 assert.ok(r.metrics.positiveMechanicalWork_J>=0);
});

test("sample timing quality flag detects nonuniform intervals",()=>{
 const bad=[sample[0],{...sample[1],time_s:.1},sample[2]];
 const r=analyzeE10Samples(bad);
 assert.equal(r.quality.nonuniformSampling,true);
 assert.ok(r.metrics.sampleIntervalRatio>1.5);
 const regular=analyzeE10Samples(sample);
 assert.equal(regular.quality.nonuniformSampling,false);
});

test("metadata and malformed timestamps are bounded and rejected",()=>{
 assert.throws(()=>analyzeE10Samples(sample,{recordedAt:"not-a-date"}));
 assert.throws(()=>analyzeE10Samples(sample,{filename:"x".repeat(301)}));
 assert.throws(()=>analyzeE10Samples(sample,{deviceLabel:123}));
 assert.throws(()=>parseE10Csv(""));
});
