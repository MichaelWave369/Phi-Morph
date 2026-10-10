/**
 * Phi-Morph E5: independent numerical convergence and energy-ledger audit.
 *
 * Rigid, sampled wheel outlines only. An exploratory dimensionaless model,
 * with no measured materials, tire footprint, soft-cell actuator, or road.
 * Implements the E4 force law again with configurable contact discretization
 * to preserve E4's fixed protocol and allow side-by-side baseline parity tests.
 */
import { e4Outline, E4_RMS_RADIUS, E4_RADIUS, E4_FLOOR_K,
  E4_FLOOR_DAMPING, E4_MODEL } from "./e4.js";

export const E5_PROTOCOL = "PM-E5-0.6.0";
export const E5_MODEL = "rigid-wheel-numeric-energy-ledger-0.6.0";
export const E5_COUNTS = Object.freeze([24, 48, 96]);
export const E5_STEPS = Object.freeze([0.01, 0.005, 0.0025]);
export const E5_SHAPES = Object.freeze(["circle", "rounded-square"]);
export const E5_DURATION = 4;
const MASS = 6;
const INERTIA = 13;
const DRAG = 0.03;
const ANGULAR_DRAG = 0.025;
const FRICTION_SPEED = 0.2;
const round = (v) => Math.round(v * 1e6) / 1e6;
const signedPow = (v, exp) => Math.sign(v) * Math.pow(Math.abs(v), exp);

export function makeE5Outline(shape = "circle", count = 24) {
  if (!E5_SHAPES.includes(shape)) throw new Error("Unknown E5 shape");
  if (![24,48,96].includes(count)) throw new Error("Unsupported rim resolution");
  // Frozen 24-point reference uses E4's exact initial coordinates.
  if (count === 24) return e4Outline(shape);
  const exponent = shape === "circle" ? 1 : 0.5;
  const original = Array.from({ length: count }, (_, i) => {
    const angle = i * Math.PI * 2 / count;
    return { id: i, x: signedPow(Math.cos(angle), exponent),
      y: signedPow(Math.sin(angle), exponent) };
  });
  const mx = original.reduce((s,p) => s + p.x, 0) / count;
  const my = original.reduce((s,p) => s + p.y, 0) / count;
  const centered = original.map(p => ({id:p.id,x:p.x-mx,y:p.y-my}));
  const rms = Math.sqrt(centered.reduce((s,p) => s+p.x*p.x+p.y*p.y,0) / count);
  return centered.map(p => ({id:p.id,x:p.x*E4_RMS_RADIUS/rms,
    y:p.y*E4_RMS_RADIUS/rms}));
}

function rotatedNodes(body, outline) {
  const c = Math.cos(body.angle), s = Math.sin(body.angle);
  return outline.map((p) => {
    const rx = p.x*c - p.y*s, ry = p.x*s + p.y*c;
    return {rx,ry,x:body.x+rx,y:body.y+ry,id:p.id};
  });
}

function contactLaw(penetration, vx, vy, mu, scale, contactEnabled) {
  if (!contactEnabled || penetration <= 0)
    return {elastic:0,closing:0,normal:0,tangential:0};
  const elastic = E4_FLOOR_K*scale*penetration;
  const closing = E4_FLOOR_DAMPING*scale*Math.max(0,-vy);
  const normal = elastic+closing;
  const tangential = mu === 0 ? 0 :
    -mu*normal*Math.tanh(vx/FRICTION_SPEED);
  return {elastic,closing,normal,tangential};
}

function energy(body, outline, load, contactEnabled, scale) {
  const kinetic = 0.5*MASS*(body.vx*body.vx+body.vy*body.vy) +
    0.5*INERTIA*body.omega*body.omega;
  // The applied downward force equals -d(load*y)/dy.
  const loadPotential = load*body.y;
  const contactPotential = contactEnabled ?
    rotatedNodes(body,outline).reduce((s,n) => {
      const penetration = Math.max(0,E4_RADIUS-n.y);
      return s+0.5*E4_FLOOR_K*scale*penetration*penetration;
    },0) : 0;
  return {kinetic,loadPotential,contactPotential,
    total:kinetic+loadPotential+contactPotential};
}

export function simulateE5({
  shape="circle", count=24, dt=0.005, duration=E5_DURATION,
  mu=0.35, torque=0.8, load=2, contactEnabled=true,
  captureFrames=false,
}={}) {
  if (!E5_SHAPES.includes(shape)) throw new Error("Unsupported E5 shape");
  if (![24,48,96].includes(count)) throw new Error("Unsupported E5 contact count");
  if (![0.01,0.005,0.0025].includes(dt)) throw new Error("Unsupported E5 timestep");
  if (![0,0.35,0.8].includes(mu)) throw new Error("Unsupported E5 coefficient");
  if (![0,0.8,1.6].includes(torque)) throw new Error("Unsupported E5 torque");
  if (![0.5,1,2,4].includes(load)) throw new Error("Unsupported E5 load");
  if (typeof contactEnabled !== "boolean") throw new Error("Invalid contact flag");
  if (!Number.isFinite(duration) || duration <= 0 || duration > 6)
    throw new Error("Invalid E5 duration");
  const steps = Math.round(duration/dt);
  if (Math.abs(steps*dt-duration)>1e-9) throw new Error("Non-integral timestep");
  const outline = makeE5Outline(shape,count);
  const scale = 24/count; // equal approximate aggregate penalty strength, not a material law
  const bottom = Math.min(...outline.map(p=>p.y));
  const body={x:0,y:E4_RADIUS+0.03-bottom,vx:0,vy:0,angle:0,omega:0};
  const initialEnergy=energy(body,outline,load,contactEnabled,scale);
  const work={motor:0,translationalDrag:0,angularDrag:0,
    tangentialFriction:0,normalClosingDamping:0};
  let contactSteps=0, maxPenetration=0, normalImpulse=0, frictionImpulse=0;
  let peakNormalReaction=0, finite=true;
  const frames=captureFrames ? [] : undefined;
  if(captureFrames)frames.push({
    time:0,x:0,y:round(body.y),angle:0,
    nodes:rotatedNodes(body,outline).map(p=>({id:p.id,x:round(p.x),y:round(p.y),contact:false}))
  });

  for(let step=0;step<steps;step++){
    const nodes=rotatedNodes(body,outline);
    let fx=-DRAG*body.vx,fy=-load-DRAG*body.vy;
    const motorTorque=-torque;
    let tau=motorTorque-ANGULAR_DRAG*body.omega;
    let normalTotal=0;
    let touching=0;

    // Work measured against start-of-step velocities. This first-order
    // quadrature contributes to the reported numerical energy residual.
    work.motor += motorTorque*body.omega*dt;
    work.translationalDrag -= DRAG*(body.vx*body.vx+body.vy*body.vy)*dt;
    work.angularDrag -= ANGULAR_DRAG*body.omega*body.omega*dt;

    for(const n of nodes){
      const pen=E4_RADIUS-n.y;
      const vcx=body.vx-body.omega*n.ry;
      const vcy=body.vy+body.omega*n.rx;
      const c=contactLaw(pen,vcx,vcy,mu,scale,contactEnabled);
      if(c.normal===0)continue;
      touching++;
      fx+=c.tangential;fy+=c.normal;
      tau+=n.rx*c.normal-n.ry*c.tangential;
      normalTotal+=c.normal;
      maxPenetration=Math.max(maxPenetration,pen);
      frictionImpulse+=c.tangential*dt;
      normalImpulse+=c.normal*dt;
      work.tangentialFriction+=c.tangential*vcx*dt;
      work.normalClosingDamping+=c.closing*vcy*dt;
    }
    if(touching>0)contactSteps++;
    peakNormalReaction=Math.max(peakNormalReaction,normalTotal);
    body.vx+=fx/MASS*dt;
    body.vy+=fy/MASS*dt;
    body.omega+=tau/INERTIA*dt;
    body.x+=body.vx*dt;
    body.y+=body.vy*dt;
    body.angle+=body.omega*dt;

    if(![body.x,body.y,body.vx,body.vy,body.angle,body.omega].every(Number.isFinite)){
      finite=false;break;
    }
    if(captureFrames && ((step+1)%Math.max(1,Math.round(0.12/dt))===0 || step===steps-1)){
      const next=rotatedNodes(body,outline);
      frames.push({time:round((step+1)*dt),x:round(body.x),y:round(body.y),
        angle:round(body.angle),
        nodes:next.map(p=>({id:p.id,x:round(p.x),y:round(p.y),
          contact:contactEnabled && p.y<E4_RADIUS}))});
    }
  }
  if(!finite)return {shape,count,dt,mu,torque,load,contactEnabled,numericallyFinite:false,
    metrics:null,frames};

  const finalEnergy=energy(body,outline,load,contactEnabled,scale);
  const totalExternalWork=Object.values(work).reduce((s,v)=>s+v,0);
  const deltaEnergy=finalEnergy.total-initialEnergy.total;
  const residual=deltaEnergy-totalExternalWork;
  const denominator=Math.max(1,Math.abs(initialEnergy.total),
    Math.abs(finalEnergy.total),Object.values(work).reduce((s,v)=>s+Math.abs(v),0));
  const metrics={
    horizontalTravel:round(body.x),
    finalHubY:round(body.y),
    finalAngleDegrees:round(body.angle*180/Math.PI),
    finalAngularSpeed:round(body.omega),
    contactFraction:round(contactSteps/steps),
    maxNumericalPenetration:round(maxPenetration),
    peakNormalReaction:round(peakNormalReaction),
    normalImpulse:round(normalImpulse),
    frictionImpulse:round(frictionImpulse),
    initialEnergy:round(initialEnergy.total),
    finalEnergy:round(finalEnergy.total),
    finalKineticEnergy:round(finalEnergy.kinetic),
    finalLoadPotential:round(finalEnergy.loadPotential),
    finalContactPotential:round(finalEnergy.contactPotential),
    deltaEnergy:round(deltaEnergy),
    motorWork:round(work.motor),
    translationalDragWork:round(work.translationalDrag),
    angularDragWork:round(work.angularDrag),
    frictionWork:round(work.tangentialFriction),
    normalDampingWork:round(work.normalClosingDamping),
    energyBalanceResidual:round(residual),
    relativeEnergyResidual:round(Math.abs(residual)/denominator),
  };
  return {shape,count,dt,mu,torque,load,contactEnabled,steps,duration,
    modelVersion:E5_MODEL, numericalFinite:true,metrics,frames};
}

export function buildE5Receipt({
  mu=0.35,torque=0.8,load=2,
  recordedAt=new Date().toISOString(),
}={}){
  if(![0,0.35,0.8].includes(mu)||![0,0.8,1.6].includes(torque)||
     ![0.5,1,2,4].includes(load))throw new Error("Invalid E5 protocol controls");
  const runs=E5_SHAPES.flatMap(shape=>E5_COUNTS.flatMap(count=>E5_STEPS.map(dt=>{
    const r=simulateE5({shape,count,dt,mu,torque,load});
    return {shape,count,dt,numericallyFinite:r.numericallyFinite,metrics:r.metrics};
  })));
  const numericalChecks=E5_SHAPES.flatMap(shape=>E5_COUNTS.map(count=>{
    const rows=runs.filter(r=>r.shape===shape&&r.count===count);
    const fine=rows.find(r=>r.dt===0.0025)?.metrics?.horizontalTravel;
    const mid=rows.find(r=>r.dt===0.005)?.metrics?.horizontalTravel;
    const coarse=rows.find(r=>r.dt===0.01)?.metrics?.horizontalTravel;
    return {
      shape,count,observable:"horizontalTravel",
      mediumToFineAbsoluteDelta:mid==null||fine==null?null:round(Math.abs(mid-fine)),
      coarseToMediumAbsoluteDelta:coarse==null||mid==null?null:round(Math.abs(coarse-mid)),
      note:"Two differences are diagnostics, NOT extrapolated numerical convergence or physical validation.",
    };
  }));
  const negativeControls=E5_SHAPES.flatMap(shape=>[
    {kind:"no-ground",shape,parameters:{mu,torque,load,contactEnabled:false}},
    {kind:"no-friction",shape,parameters:{mu:0,torque,load,contactEnabled:true}},
  ].map(control=>{
    const r=simulateE5({shape,count:24,dt:0.005,duration:E5_DURATION,...control.parameters});
    return {kind:control.kind,shape,normalImpulse:r.metrics?.normalImpulse??null,
      frictionImpulse:r.metrics?.frictionImpulse??null,
      horizontalTravel:r.metrics?.horizontalTravel??null,
      numericallyFinite:r.numericallyFinite};
  }));
  return {
    schema:"phi-morph.e5.receipt.v1",
    origin:"SIMULATED",
    physicalValidation:"NONE",
    protocol:E5_PROTOCOL,modelVersion:E5_MODEL,
    e4ReferenceModel:E4_MODEL,recordedAt,
    units:"normalized_dimensionless",
    controls:{
      shapes:[...E5_SHAPES],pointCounts:[...E5_COUNTS],timeSteps:[...E5_STEPS],
      dtIntegration:"semi_implicit_euler",
      ledgerQuadrature:"start_of_step_force_times_velocity",
      duration:E5_DURATION,hubMass:MASS,hubInertia:INERTIA,
      referenceRmsRadius:E4_RMS_RADIUS,contactRadius:E4_RADIUS,
      nodePenaltyScaleRule:"24/count",
      load,mu,torque,runCount:runs.length,
      negativeControlCount:negativeControls.length,
    },
    runs,numericalChecks,negativeControls,
    caveats:[
      "Changing the node count alters the discrete contact representation even when aggregate penalty coefficients scale as 24/count.",
      "This is an energy ledger for a rigid, point-contact toy model, not a complete physical energy proof.",
      "Work quadrature is first order; nonzero energy residual is a measured numerical discrepancy.",
      "Convergence diagnostics concern horizontal travel only; a small delta does not validate other outputs.",
      "The rounded-square outline is fixed. No actuated transformation or its energetic cost is included.",
      "No physical traction, pressure, water, membranes, road contact benchmark or SI units.",
    ],
  };
}

export function e5Csv(receipt){
  const rows=[["protocol","shape","points","dt","mu","torque","load",
    "horizontalTravel","maxNumericalPenetration","normalImpulse","frictionImpulse",
    "motorWork","frictionWork","normalDampingWork","energyBalanceResidual",
    "relativeEnergyResidual","numericallyFinite"]];
  for(const row of receipt.runs){
    const m=row.metrics;
    rows.push([receipt.protocol,row.shape,row.count,row.dt,receipt.controls.mu,
      receipt.controls.torque,receipt.controls.load,
      m?.horizontalTravel??"",m?.maxNumericalPenetration??"",
      m?.normalImpulse??"",m?.frictionImpulse??"",m?.motorWork??"",
      m?.frictionWork??"",m?.normalDampingWork??"",m?.energyBalanceResidual??"",
      m?.relativeEnergyResidual??"",row.numericallyFinite]);
  }
  return rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n")+"\n";
}
