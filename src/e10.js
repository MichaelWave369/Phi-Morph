/**
 * Phi-Morph E10: calibration-ready measurement ingestion, not calibration.
 * Does not assert provenance from an uploaded file, and never upgrades user
 * supplied records to VERIFIED or OBSERVED using metadata alone.
 */
export const E10_PROTOCOL="PM-E10-1.1.0";
export const E10_SCHEMA="phi-morph.e10.bench.v1";
export const E10_COLUMNS=Object.freeze([
  "time_s","command_m","displacement_m","force_N",
  "voltage_V","current_A","temperature_C"
]);
export const E10_MAX_BYTES=1_000_000;
export const E10_MAX_SAMPLES=10_000;
export const E10_ARCHITECTURES=Object.freeze([
 {id:"electromechanical",name:"Electromechanical linear actuator",
  drive:"Motor + leadscrew or linear stage",
  measure:"Stroke, force, bus voltage/current, motor/stage temperature",
  unknown:"Backlash, efficiency, load/speed envelope, transmission friction"},
 {id:"pneumatic",name:"Pneumatic or fluid bladder",
  drive:"Compressor/pump, valve, regulated pressure, compliant chamber",
  measure:"Displacement, contact/load force, pressure, fluid flow, input electrical energy",
  unknown:"Leaks, compliance, pressure-vessel limits, return energy"},
 {id:"smart-material",name:"Electroactive / variable-stiffness element",
  drive:"Explicitly specified and independently sourced material + driver",
  measure:"Force–displacement curve, voltage/current, temperature, cycling rate",
  unknown:"Validated constitutive response, dielectric safety, fatigue, usable stroke"}
]);
const round=n=>{const out=Math.round(n*1e9)/1e9;return out===0?0:out};

/** Strict, small RFC-4180-style CSV parser, including quoted cells and BOM. */
export function parseE10Csv(raw){
  if(typeof raw!=="string"||raw.length>E10_MAX_BYTES||raw.length===0)
    throw new Error("CSV absent or over the 1 MB text limit");
  const source=raw.charCodeAt(0)===0xFEFF?raw.slice(1):raw;
  const rows=[],row=[];
  let field="",quoted=false,closed=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'){
        if(source[i+1]==='"'){field+='"';i++;}
        else{quoted=false;closed=true;}
      }else if(ch==="\r"||ch==="\n")throw new Error("Multiline CSV fields are not supported");
      else field+=ch;
      continue;
    }
    if(ch==='"'){
      if(field!==""||closed)throw new Error("Unexpected CSV quote");
      quoted=true;continue;
    }
    if(ch===","){
      row.push(field);field="";closed=false;continue;
    }
    if(ch==="\r"||ch==="\n"){
      row.push(field);field="";closed=false;
      if(row.some(v=>v.trim()!==""))rows.push(row.slice());
      row.length=0;
      if(ch==="\r"&&source[i+1]==="\n")i++;
      if(rows.length>E10_MAX_SAMPLES+1)throw new Error("Too many CSV samples");
      continue;
    }
    if(closed&&ch!==" "&&ch!=="\t")throw new Error("Characters after quoted CSV field");
    if(!closed)field+=ch;
  }
  if(quoted)throw new Error("Unclosed CSV quotation");
  if(field!==""||row.length){
    row.push(field);
    if(row.some(v=>v.trim()!==""))rows.push(row.slice());
  }
  if(rows.length<4)throw new Error("At least three samples plus header are required");
  const header=rows.shift().map(s=>s.trim());
  if(header.length!==E10_COLUMNS.length||
     new Set(header).size!==header.length||
     !E10_COLUMNS.every(c=>header.includes(c)))
    throw new Error("CSV headers must contain exactly the seven E10 SI columns");
  const parsed=rows.map((items,i)=>{
    if(items.length!==header.length)throw new Error("Wrong number of columns on data row "+(i+1));
    const item={};
    for(let j=0;j<header.length;j++){
      const literal=items[j].trim();
      if(literal==="")throw new Error("Blank "+header[j]+" on data row "+(i+1));
      const v=Number(literal);
      if(!Number.isFinite(v)||Math.abs(v)>1e12)
        throw new Error("Nonfinite/out-of-range "+header[j]+" on data row "+(i+1));
      item[header[j]]=v;
    }
    return item;
  });
  validateE10Samples(parsed);
  return parsed;
}

export function validateE10Samples(samples){
  if(!Array.isArray(samples)||samples.length<3||samples.length>E10_MAX_SAMPLES)
    throw new Error("E10 requires 3 to 10,000 samples");
  for(let i=0;i<samples.length;i++){
    const r=samples[i];
    if(r===null||typeof r!=="object")throw new Error("Invalid row "+(i+1));
    for(const column of E10_COLUMNS){
      if(typeof r[column]!=="number"||!Number.isFinite(r[column])||
        Math.abs(r[column])>1e12)
        throw new Error("Invalid "+column+" on row "+(i+1));
    }
    if(r.time_s<0||(i&&r.time_s<=samples[i-1].time_s))
      throw new Error("Time must be nonnegative and strictly increasing");
    if(r.temperature_C < -273.15)
      throw new Error("Temperature below absolute zero");
  }
  return true;
}

/**
 * Import claims are not independently authenticated. The origin is set only
 * by the calling workflow, not by CSV contents or a user-set metadata field.
 */
export function analyzeE10Samples(samples,{
  origin="USER_SUPPLIED_UNVERIFIED",
  filename="",
  deviceLabel="",
  calibrationReference="",
  fixtureNote="",
  recordedAt=new Date().toISOString(),
}={}){
  validateE10Samples(samples);
  if(!["SIMULATED","USER_SUPPLIED_UNVERIFIED"].includes(origin))
    throw new Error("Unverified data cannot be declared OBSERVED/VERIFIED");
  if(!Number.isFinite(Date.parse(recordedAt)))throw new Error("Invalid receipt timestamp");
  for(const label of [filename,deviceLabel,calibrationReference,fixtureNote])
    if(typeof label!=="string"||label.length>300)
      throw new Error("Invalid metadata length/type");
  let electricalPositive=0,electricalNegative=0;
  let mechanicalPositive=0,mechanicalNegative=0;
  let peakPower=0,peakForce=0,peakVelocity=0;
  let errSquared=0,errorAbsolute=0;
  let dtMin=Infinity,dtMax=0,tempMin=Infinity,tempMax=-Infinity;
  let xMin=Infinity,xMax=-Infinity;
  let maxVoltage=0,maxCurrent=0;
  for(const r of samples){
    const err=r.command_m-r.displacement_m;
    errSquared+=err*err;errorAbsolute+=Math.abs(err);
    peakForce=Math.max(peakForce,Math.abs(r.force_N));
    peakPower=Math.max(peakPower,Math.abs(r.voltage_V*r.current_A));
    maxVoltage=Math.max(maxVoltage,Math.abs(r.voltage_V));
    maxCurrent=Math.max(maxCurrent,Math.abs(r.current_A));
    tempMin=Math.min(tempMin,r.temperature_C);
    tempMax=Math.max(tempMax,r.temperature_C);
    xMin=Math.min(xMin,r.displacement_m);xMax=Math.max(xMax,r.displacement_m);
  }
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    const dt=b.time_s-a.time_s,dx=b.displacement_m-a.displacement_m;
    const electrical=.5*(a.voltage_V*a.current_A+b.voltage_V*b.current_A)*dt;
    const mechanical=.5*(a.force_N+b.force_N)*dx;
    electricalPositive+=Math.max(0,electrical);
    electricalNegative+=Math.min(0,electrical);
    mechanicalPositive+=Math.max(0,mechanical);
    mechanicalNegative+=Math.min(0,mechanical);
    dtMin=Math.min(dtMin,dt);dtMax=Math.max(dtMax,dt);
    peakVelocity=Math.max(peakVelocity,Math.abs(dx/dt));
  }
  const totalTime=samples.at(-1).time_s-samples[0].time_s;
  return {
    schema:E10_SCHEMA,protocol:E10_PROTOCOL,origin,
    verification:"NOT_INDEPENDENTLY_VERIFIED",
    physicalValidation:"NONE",
    recordedAt,
    source:{
      filename:filename.trim()||null,
      deviceLabel:deviceLabel.trim()||null,
      calibrationReference:calibrationReference.trim()||null,
      fixtureNote:fixtureNote.trim()||null,
      calibrationEvidenceStatus:"USER_ASSERTED_ONLY",
    },
    units:"SI_DECLARED_NOT_VERIFIED",
    sampleCount:samples.length,
    metrics:{
      duration_s:round(totalTime),
      meanSamplingRate_Hz:round((samples.length-1)/totalTime),
      minInterval_s:round(dtMin),maxInterval_s:round(dtMax),
      sampleIntervalRatio:round(dtMax/dtMin),
      rmsTrackingError_m:round(Math.sqrt(errSquared/samples.length)),
      meanAbsoluteTrackingError_m:round(errorAbsolute/samples.length),
      peakAbsForce_N:round(peakForce),
      peakAbsVelocity_m_per_s:round(peakVelocity),
      peakAbsVoltage_V:round(maxVoltage),
      peakAbsCurrent_A:round(maxCurrent),
      peakAbsElectricalPower_W:round(peakPower),
      positiveElectricalEnergy_J:round(electricalPositive),
      negativeElectricalEnergy_J:round(electricalNegative),
      netElectricalEnergy_J:round(electricalPositive+electricalNegative),
      positiveMechanicalWork_J:round(mechanicalPositive),
      negativeMechanicalWork_J:round(mechanicalNegative),
      netMechanicalWork_J:round(mechanicalPositive+mechanicalNegative),
      maxTemperature_C:round(tempMax),
      temperatureRange_C:round(tempMax-tempMin),
      measuredDisplacementSpan_m:round(xMax-xMin),
    },
    quality:{
      dataFormat:"SEVEN_COLUMN_SI_CSV",
      monotonicallyIncreasingTime:true,
      nonuniformSampling:dtMax/dtMin>1.5,
      electricalSignConventionVerified:false,
      forceDisplacementSignConventionVerified:false,
      sensorCalibrationsVerified:false,
      independentBenchmarkPassed:false,
      actuatorEfficiencyEligible:false,
      e9PhysicalScaleMappingEligible:false,
    },
    caveats:[
      "Values have declared SI column names but their units and sensor calibration are not authenticated.",
      "Upload origin is USER_SUPPLIED_UNVERIFIED, never auto-promoted to OBSERVED/VERIFIED.",
      "Energy uses trapezoidal sampled electrical power and force times displacement increments.",
      "Averaged sampling can miss current spikes, peak impact forces and thermal transients.",
      "Power/force sign conventions are unverified, so input efficiency and regeneration are not inferred.",
      "No E9 normalized-to-SI model mapping is performed or claimed.",
      "This is not tire load certification, actuator validation, thermal safety or material testing.",
    ]
  };
}

/** Deterministic example data generated by arithmetic; never observational. */
export function makeE10SyntheticExample(){
  const out=[];
  let x=0,previousX=0;
  for(let i=0;i<=200;i++){
    const t=i*.02;
    const cmd=.01*.5*(1-Math.cos(Math.PI*t/2));
    previousX=x;
    x+=.12*(cmd-x);
    const v=i===0?0:(x-previousX)/.02;
    const force=130*(cmd-x)-5*v;
    out.push({
      time_s:Number(t.toFixed(4)),
      command_m:cmd,
      displacement_m:x,
      force_N:force,
      voltage_V:12,
      current_A:.4+.035*Math.abs(force),
      temperature_C:25+.15*t,
    });
  }
  return out;
}

function csvCell(value){
  const s=String(value);
  return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function e10SamplesCsv(samples){
  validateE10Samples(samples);
  return E10_COLUMNS.join(",")+"\n"+
    samples.map(r=>E10_COLUMNS.map(k=>csvCell(r[k])).join(",")).join("\n")+"\n";
}
export function e10BlankTemplate(){
  return E10_COLUMNS.join(",")+"\n";
}
