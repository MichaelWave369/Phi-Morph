/**
 * Φ-Morph E8: isolated power/force-bounded actuator characterization bench.
 * A one-degree-of-freedom normalized actuator drives a spring/damper load.
 * This intentionally DOES NOT feed back into E7's 24-node rim.
 *
 * No measured motor, material hysteresis, water frequency transformation,
 * calibrated contact law, hardware power draw or physical tire is modeled.
 */
import { e6Command } from "./e6.js";
export const E8_PROTOCOL = "PM-E8-0.9.0";
export const E8_MODEL = "one-dof-servo-power-rate-0.9.0";
export const E8_PROFILES = Object.freeze(["slow","medium","fast"]);
export const E8_FORCE_LIMITS = Object.freeze([0,4,10]);
export const E8_POWER_LIMITS = Object.freeze([0,2,null]);
export const E8_CYCLES = Object.freeze([1,3]);
export const E8_DT = 0.005;
export const E8_PERIOD = 8;
export const E8_LOAD_SPRING = 2;
export const E8_LOAD_DAMPING = 0.7;
export const E8_MASS = 1;
export const E8_GAINS = Object.freeze({
  slow: Object.freeze({kp:4,kd:2}),
  medium: Object.freeze({kp:12,kd:3.5}),
  fast: Object.freeze({kp:24,kd:5}),
});
const round = x => { const a=Math.round(x*1e6)/1e6; return a===0?0:a; };
const signedLimit = (x,cap) => cap===null?x:Math.max(-cap,Math.min(cap,x));

/** A complete round -> square -> round command as scalar 0 .. 1. */
export function e8Target(t,mode="cycle",stroke=1){
  if(!Number.isFinite(t)||t<0||!["cycle","step","off"].includes(mode)||
     ![0,0.5,1].includes(stroke)) throw new Error("Invalid E8 command");
  if(mode==="off")return 0;
  if(mode==="step")return stroke;
  return stroke*e6Command("morph-cycle",t%E8_PERIOD).alpha;
}

/**
 * Force cap applied first, then instantaneous mechanical power cap.
 * At v=0, motor may sustain a force without doing mechanical work.
 * Power means |F*v| at the CURRENT sampled velocity, not electrical draw.
 */
export function e8LimitedForce(raw,velocity,forceLimit,powerLimit){
  if(![raw,velocity].every(Number.isFinite)||
    !(forceLimit===null||(Number.isFinite(forceLimit)&&forceLimit>=0))||
    !(powerLimit===null||(Number.isFinite(powerLimit)&&powerLimit>=0)))
    throw new Error("Invalid force or power cap");
  const afterForce=signedLimit(raw,forceLimit);
  const powerCeiling=powerLimit===null||velocity===0?Infinity:powerLimit/Math.abs(velocity);
  const applied=signedLimit(afterForce,powerCeiling);
  return {
    applied,
    forceSaturated:Math.abs(raw)>Math.abs(afterForce)+1e-12,
    powerSaturated:Math.abs(afterForce)>Math.abs(applied)+1e-12,
    sampledMechanicalPower:applied*velocity,
  };
}

/** Closed (command, position) polygon area, a controller-loop proxy only. */
export function e8LoopArea(points){
  if(!Array.isArray(points)||points.length<2)return 0;
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(![a.command,a.position,b.command,b.position].every(Number.isFinite))
      throw new Error("Invalid command-response sample");
    sum+=a.command*b.position-b.command*a.position;
  }
  return Math.abs(sum)*0.5;
}

/** Exact reference for an unbounded unit step, load=0, mass=1, linear PD. */
export function e8AnalyticalStep(t,profile="medium"){
  if(!Number.isFinite(t)||t<0||!E8_PROFILES.includes(profile))
    throw new Error("Invalid analytic reference");
  const {kp,kd}=E8_GAINS[profile];
  const damping=kd/2;
  const discr=kp-damping*damping;
  if(discr>1e-12){
    const w=Math.sqrt(discr);
    return 1-Math.exp(-damping*t)*
      (Math.cos(w*t)+(damping/w)*Math.sin(w*t));
  }
  if(Math.abs(discr)<=1e-12)
    return 1-Math.exp(-damping*t)*(1+damping*t);
  const root=Math.sqrt(-discr);
  const r1=-damping+root,r2=-damping-root;
  return 1-(r2*Math.exp(r1*t)-r1*Math.exp(r2*t))/(r2-r1);
}

function snap(time,x,v,force,command){
  return {time:round(time),command:round(command),
    position:round(x),velocity:round(v),force:round(force)};
}

export function simulateE8({
  profile="medium",forceLimit=10,powerLimit=2,cycles=1,
  command="cycle",stroke=1,
  loadSpring=E8_LOAD_SPRING,loadDamping=E8_LOAD_DAMPING,
  dt=E8_DT,duration=null,captureFrames=false,
}={}){
  if(!E8_PROFILES.includes(profile)||
    !(forceLimit===null||E8_FORCE_LIMITS.includes(forceLimit))||
    !(powerLimit===null||E8_POWER_LIMITS.includes(powerLimit))||
    !E8_CYCLES.includes(cycles)||!["cycle","step","off"].includes(command)||
    ![0,0.5,1].includes(stroke)||![0,E8_LOAD_SPRING].includes(loadSpring)||
    ![0,E8_LOAD_DAMPING].includes(loadDamping)||
    ![0.005,0.0025].includes(dt))
    throw new Error("Invalid E8 frozen settings");
  const runDuration=duration===null?cycles*E8_PERIOD:duration;
  if(!Number.isFinite(runDuration)||runDuration<=0||runDuration>24)
    throw new Error("Invalid E8 duration");
  const steps=Math.round(runDuration/dt);
  if(Math.abs(steps*dt-runDuration)>1e-9)throw new Error("Duration not divisible by timestep");
  let x=0,v=0,positiveWork=0,negativeWork=0,dragWork=0;
  let forceHits=0,powerHits=0,peakForce=0,peakPower=0,peakSpeed=0;
  let errorIntegral=0,lagIntegral=0,peakAbsError=0,peakPosition=0;
  const {kp,kd}=E8_GAINS[profile];
  const frames=captureFrames?[]:undefined;
  const cycleSummaries=[],loop=[];
  const cyclePositive=[],cycleNegative=[],cycleForceHits=[],cyclePowerHits=[];
  let cyclePos=0,cycleNeg=0,cycleForce=0,cyclePower=0,cycleError=0;
  const initialEnergy=0;
  if(captureFrames)frames.push(snap(0,x,v,0,e8Target(0,command,stroke)));
  loop.push({command:e8Target(0,command,stroke),position:x});
  let lastForce=0,finite=true;

  for(let step=0;step<steps;step++){
    const t=step*dt;
    const target=e8Target(t,command,stroke);
    const error=target-x;
    const raw=kp*error-kd*v;
    const limited=e8LimitedForce(raw,v,forceLimit,powerLimit);
    const applied=limited.applied;
    const p=limited.sampledMechanicalPower;
    const drag=-loadDamping*v;
    // A spring-like normalized external load, not a pressure or road force.
    const loadForce=-loadSpring*x;
    const net=applied+drag+loadForce;

    if(limited.forceSaturated){forceHits++;cycleForce++;}
    if(limited.powerSaturated){powerHits++;cyclePower++;}
    peakForce=Math.max(peakForce,Math.abs(applied));
    peakPower=Math.max(peakPower,Math.abs(p));
    peakSpeed=Math.max(peakSpeed,Math.abs(v));
    peakAbsError=Math.max(peakAbsError,Math.abs(error));
    errorIntegral+=error*error*dt;
    lagIntegral+=Math.abs(error)*dt;
    cycleError+=error*error*dt;
    const dw=p*dt;
    positiveWork+=Math.max(0,dw);
    negativeWork+=Math.min(0,dw);
    cyclePos+=Math.max(0,dw);
    cycleNeg+=Math.min(0,dw);
    dragWork+=drag*v*dt;

    v+=net/E8_MASS*dt;
    x+=v*dt;
    lastForce=applied;
    peakPosition=Math.max(peakPosition,Math.abs(x));
    if(!Number.isFinite(x)||!Number.isFinite(v)){finite=false;break;}
    if(captureFrames&&((step+1)%Math.round(0.1/dt)===0||step===steps-1))
      frames.push(snap((step+1)*dt,x,v,applied,e8Target((step+1)*dt,command,stroke)));
    // Only cycle protocol has meaningful loops.
    if(command==="cycle")loop.push({
      command:e8Target((step+1)*dt,command,stroke),position:x
    });
    if((step+1)*dt/E8_PERIOD>=cycleSummaries.length+1-1e-9){
      const last={cycle:cycleSummaries.length+1,
        positiveWork:round(cyclePos),
        negativeWork:round(cycleNeg),
        capHits:cycleForce,powerHits:cyclePower,
        rmsTrackingError:round(Math.sqrt(cycleError/E8_PERIOD)),
        commandResponseLoopArea:round(command==="cycle"?e8LoopArea(loop):0),
        finalPosition:round(x)};
      cycleSummaries.push(last);
      cyclePositive.push(cyclePos);cycleNegative.push(cycleNeg);
      cycleForceHits.push(cycleForce);cyclePowerHits.push(cyclePower);
      cyclePos=0;cycleNeg=0;cycleForce=0;cyclePower=0;cycleError=0;
      loop.length=0;
      loop.push({command:e8Target((step+1)*dt,command,stroke),position:x});
    }
  }

  if(!finite)return {profile,forceLimit,powerLimit,command,stroke,cycles,
    numericallyFinite:false,metrics:null,cycleSummaries,frames};
  const finalEnergy=0.5*E8_MASS*v*v+0.5*loadSpring*x*x;
  const netWork=positiveWork+negativeWork;
  const residual=finalEnergy-initialEnergy-netWork-dragWork;
  const scale=Math.max(1,Math.abs(finalEnergy),Math.abs(netWork),
    Math.abs(dragWork),positiveWork,-negativeWork);
  const window=runDuration;
  return {
    profile,forceLimit,powerLimit,cycles,command,stroke,loadSpring,loadDamping,
    duration:runDuration,dt,steps,numericallyFinite:true,
    modelVersion:E8_MODEL,cycleSummaries,frames,
    metrics:{
      finalPosition:round(x),
      finalVelocity:round(v),
      maximumAbsolutePosition:round(peakPosition),
      peakTrackingError:round(peakAbsError),
      rmsTrackingError:round(Math.sqrt(errorIntegral/window)),
      integratedAbsoluteLag:round(lagIntegral),
      peakAppliedForce:round(peakForce),
      peakSampledMechanicalPower:round(peakPower),
      peakSpeed:round(peakSpeed),
      forceCapHitCount:forceHits,
      forceCapHitFraction:round(forceHits/steps),
      powerCapHitCount:powerHits,
      powerCapHitFraction:round(powerHits/steps),
      totalPositiveMechanicalWork:round(positiveWork),
      totalNegativeMechanicalWork:round(negativeWork),
      netMechanicalWork:round(netWork),
      externalLoadDragWork:round(dragWork),
      finalStoredModelEnergy:round(finalEnergy),
      energyResidual:round(residual),
      relativeEnergyResidual:round(Math.abs(residual)/scale),
      commandResponseLoopArea:round(cycleSummaries.reduce(
        (sum,c)=>sum+c.commandResponseLoopArea,0)),
    },
  };
}

export function buildE8Receipt({
  cycles=1,loadSpring=E8_LOAD_SPRING,
  recordedAt=new Date().toISOString(),
}={}){
  if(!E8_CYCLES.includes(cycles)||
     ![0,E8_LOAD_SPRING].includes(loadSpring))throw new Error("Invalid E8 study settings");
  const runs=E8_PROFILES.flatMap(profile=>
    E8_FORCE_LIMITS.flatMap(forceLimit=>
      E8_POWER_LIMITS.map(powerLimit=>{
        const run=simulateE8({profile,forceLimit,powerLimit,cycles,loadSpring});
        return {profile,forceLimit,powerLimit,numericallyFinite:run.numericallyFinite,
          metrics:run.metrics,cycleSummaries:run.cycleSummaries};
      })));
  const controls=[
    {kind:"no-command",settings:{command:"off",profile:"medium",forceLimit:10,powerLimit:2}},
    {kind:"zero-force",settings:{profile:"medium",forceLimit:0,powerLimit:2}},
    {kind:"zero-power",settings:{profile:"medium",forceLimit:10,powerLimit:0}},
    {kind:"unbounded-reference",settings:{profile:"medium",forceLimit:null,powerLimit:null}},
  ].map(a=>{
    const run=simulateE8({cycles,loadSpring,...a.settings});
    return {kind:a.kind,numericallyFinite:run.numericallyFinite,
      positiveWork:run.metrics?.totalPositiveMechanicalWork??null,
      finalPosition:run.metrics?.finalPosition??null,
      peakPower:run.metrics?.peakSampledMechanicalPower??null};
  });
  const coarse=simulateE8({cycles:1,profile:"medium",forceLimit:10,powerLimit:2,
    loadSpring,dt:0.005});
  const fine=simulateE8({cycles:1,profile:"medium",forceLimit:10,powerLimit:2,
    loadSpring,dt:0.0025});
  const referenceTimes=[0.5,1,2];
  const reference=simulateE8({profile:"medium",command:"step",stroke:1,
    forceLimit:null,powerLimit:null,cycles:1,loadSpring:0,loadDamping:0,
    dt:0.0025,duration:2,captureFrames:true});
  const analytic=referenceTimes.map(t=>{
    const item=reference.frames.find(f=>Math.abs(f.time-t)<1e-9);
    const expected=e8AnalyticalStep(t,"medium");
    return {time:t,referenceType:"ANALYTICAL_UNBOUNDED_PD_STEP",
      analytical:round(expected),numerical:item?.position??null,
      absoluteDelta:item?round(Math.abs(expected-item.position)):null};
  });
  return {
    schema:"phi-morph.e8.receipt.v1",
    origin:"SIMULATED",physicalValidation:"NONE",recordedAt,
    protocol:E8_PROTOCOL,modelVersion:E8_MODEL,units:"normalized_dimensionless",
    design:{
      actuator:"single_dof_normalized_force_and_power_limited_PD_servo",
      referenceWheelExperiment:"PM-E7-0.8.0;not mechanically integrated",
      initialPosition:0,initialVelocity:0,mass:E8_MASS,
      commandSchedule:"round_0_1;up_1_3;hold_3_4;down_4_6;round_6_8",
      gains:E8_GAINS,profiles:[...E8_PROFILES],
      forceCaps:[...E8_FORCE_LIMITS],powerCaps:[...E8_POWER_LIMITS],
      dt:E8_DT,cycles,loadSpring,loadDamping:E8_LOAD_DAMPING,
      caseCount:runs.length,negativeControlCount:controls.length,
    },
    runs,negativeControls:controls,
    analyticalStepReference:analytic,
    timeStepDiagnostic:{
      coarseDt:0.005,fineDt:0.0025,
      positionDelta:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.finalPosition-fine.metrics.finalPosition)):null,
      residualDelta:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.relativeEnergyResidual-
          fine.metrics.relativeEnergyResidual)):null,
    },
    caveats:[
      "Isolated normalized 1-DOF plant, not coupled into E7 rolling wheel.",
      "Fast/slow labels reflect assumed PD feedback gains, not measured actuator bandwidth.",
      "Power limit bounds sampled |F*v|, not electrical current, voltage or instantaneous within-step peak.",
      "Controller command-position loop area is a dynamic lag proxy, NOT material hysteresis.",
      "No thermal behavior, stiction, physical stroke limit, pressure response or measured device.",
      "Analytical reference checks an ideal step response in a no-load, unbounded case; it is not external experimental validation.",
      "Gross positive mechanical work is not battery energy consumption.",
    ],
  };
}

export function e8Csv(receipt){
  const rows=[["protocol","profile","forceLimit","powerLimit","cycles",
    "rmsTrackingError","forceCapFraction","powerCapFraction","positiveWork",
    "negativeWork","commandLoopArea","energyResidual","numericallyFinite"]];
  for(const c of receipt.runs){
    const m=c.metrics;
    rows.push([receipt.protocol,c.profile,c.forceLimit,c.powerLimit??"unbounded",
      receipt.design.cycles,m?.rmsTrackingError??"",m?.forceCapHitFraction??"",
      m?.powerCapHitFraction??"",m?.totalPositiveMechanicalWork??"",
      m?.totalNegativeMechanicalWork??"",m?.commandResponseLoopArea??"",
      m?.energyResidual??"",c.numericallyFinite]);
  }
  return rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(",")).join("\n")+"\n";
}
