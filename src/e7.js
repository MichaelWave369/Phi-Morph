/**
 * Φ-Morph E7: force-bounded *axial* spoke servos, repeated shape commands,
 * conservative rim springs, and explicit external-work accounting.
 *
 * This is a dimensionless research toy, NOT material fatigue, vehicle safety,
 * engineering load qualification, a liquid actuator, or physical tire design.
 * All wheel mass points start from the same E6 round geometry.
 */
import { e4Outline, E4_RADIUS, E4_FLOOR_K, E4_FLOOR_DAMPING } from "./e4.js";
import { e6Command } from "./e6.js";

export const E7_PROTOCOL = "PM-E7-0.8.0";
export const E7_MODEL = "bounded-axial-servo-cycle-0.8.0";
export const E7_FORCE_LIMITS = Object.freeze([0, 4, 10, null]);
export const E7_STROKES = Object.freeze([0, 0.5, 1]);
export const E7_CYCLES = Object.freeze([1, 3]);
export const E7_LOADS = Object.freeze([1, 2, 4]);
export const E7_FRICTIONS = Object.freeze([0, 0.35, 0.8]);
export const E7_DT = 0.005;
export const E7_PERIOD = 8;
export const E7_COUNT = 24;
export const E7_STRAIN_FLAG = 0.5;

const HUB_MASS = 6, HUB_INERTIA = 13, NODE_MASS = 0.25;
const SERVO_K = 21, SERVO_D = 0.45;
const RIM_K = 11, RIM_D = 0.14;
const HUB_DRAG = 0.025, NODE_DRAG = 0.035, ANGULAR_DRAG = 0.025;
const SLIP_SPEED = 0.2;
const round = n => {
  const value = Math.round(n * 1e6) / 1e6;
  return value === 0 ? 0 : value;
};
const cross = (x,y,a,b) => x*b-y*a;
const circle = e4Outline("circle");
const square = e4Outline("rounded-square");
const rimEdges = circle.map((p,i)=>{
  const j=(i+1)%E7_COUNT;
  return {a:i,b:j,rest:Math.hypot(circle[j].x-p.x,circle[j].y-p.y)};
});

/** All modes begin with the same round rim and rim rest lengths. */
export function e7LocalTargets(time, stroke = 1, commandEnabled = true){
  if(!Number.isFinite(time)||time<0||!E7_STROKES.includes(stroke)||
     typeof commandEnabled!=="boolean")throw new Error("Invalid E7 target request");
  const phase = time % E7_PERIOD;
  const cycle = e6Command("morph-cycle",phase);
  const alpha = commandEnabled ? stroke * cycle.alpha : 0;
  const alphaRate = commandEnabled ? stroke * cycle.alphaRate : 0;
  return circle.map((p,i)=>{
    const q=square[i], dx=q.x-p.x,dy=q.y-p.y;
    return {id:i,x:p.x+alpha*dx,y:p.y+alpha*dy,
      dx:alphaRate*dx,dy:alphaRate*dy};
  });
}

/**
 * Spring-damper force along the actual node–anchor line. Unlike a Cartesian
 * force at separated points, a collinear pair produces zero internal couple.
 * The cap applies to the *resultant* applied servo force, including damping.
 */
export function e7ServoForce(dx,dy,relativeAxialSpeed,forceLimit){
  if(![dx,dy,relativeAxialSpeed].every(Number.isFinite)||
    !(forceLimit===null || (Number.isFinite(forceLimit)&&forceLimit>=0)))
    throw new Error("Invalid servo state/limit");
  const d=Math.hypot(dx,dy);
  if(d<1e-12)return {fx:0,fy:0,rawMagnitude:0,appliedMagnitude:0,saturated:false};
  const ux=dx/d,uy=dy/d;
  const raw=SERVO_K*d+SERVO_D*relativeAxialSpeed;
  const capped=forceLimit===null ? raw :
    Math.max(-forceLimit,Math.min(forceLimit,raw));
  return {
    fx:capped*ux,fy:capped*uy,rawMagnitude:Math.abs(raw),
    appliedMagnitude:Math.abs(capped),
    saturated:forceLimit!==null && Math.abs(raw)>forceLimit+1e-12,
  };
}

function localToWorld(hub,targets){
  const c=Math.cos(hub.theta),s=Math.sin(hub.theta);
  return targets.map(t=>{
    const rx=t.x*c-t.y*s,ry=t.x*s+t.y*c;
    const commandVX=t.dx*c-t.dy*s,commandVY=t.dx*s+t.dy*c;
    const baseVX=hub.vx-hub.omega*ry,baseVY=hub.vy+hub.omega*rx;
    return {id:t.id,rx,ry,x:hub.x+rx,y:hub.y+ry,
      baseVX,baseVY,commandVX,commandVY,
      vx:baseVX+commandVX,vy:baseVY+commandVY};
  });
}

function contact(y,vx,vy,mu,enabled){
  if(!enabled||E4_RADIUS-y<=0)return {normal:0,friction:0,closing:0,penetration:0};
  const penetration=E4_RADIUS-y;
  const closing=E4_FLOOR_DAMPING*Math.max(0,-vy);
  const normal=E4_FLOOR_K*penetration+closing;
  const friction=mu===0?0:-mu*normal*Math.tanh(vx/SLIP_SPEED);
  return {normal,friction,closing,penetration};
}

function energy(hub,nodes,load,contactEnabled){
  const kinetic=0.5*HUB_MASS*(hub.vx**2+hub.vy**2)+
    0.5*HUB_INERTIA*hub.omega**2+
    nodes.reduce((sum,n)=>sum+0.5*NODE_MASS*(n.vx**2+n.vy**2),0);
  const gravity=load*hub.y;
  const rim=rimEdges.reduce((sum,e)=>{
    const a=nodes[e.a],b=nodes[e.b];
    const stretch=Math.hypot(a.x-b.x,a.y-b.y)-e.rest;
    return sum+0.5*RIM_K*stretch*stretch;
  },0);
  const ground=contactEnabled?nodes.reduce((sum,n)=>{
    const penetration=Math.max(0,E4_RADIUS-n.y);
    return sum+0.5*E4_FLOOR_K*penetration**2;
  },0):0;
  // Servo is an explicitly active bounded force: unlike E6 it has no
  // assumed elastic storage. ALL servo mechanical work is external work.
  return {kinetic,gravity,rim,ground,total:kinetic+gravity+rim+ground};
}

function frame(t,hub,nodes,anchors,enabled){
  return {
    time:round(t),
    hub:{x:round(hub.x),y:round(hub.y),theta:round(hub.theta)},
    nodes:nodes.map(n=>({id:n.id,x:round(n.x),y:round(n.y),
      contacting:enabled&&n.y<E4_RADIUS})),
    anchors:anchors.map(a=>({id:a.id,x:round(a.x),y:round(a.y)})),
  };
}

export function simulateE7({
  forceLimit=10,stroke=1,cycles=1,load=2,mu=0.35,torque=0.8,
  commandEnabled=true,contactEnabled=true,dt=E7_DT,captureFrames=false,
}={}){
  if(!E7_FORCE_LIMITS.includes(forceLimit)||!E7_STROKES.includes(stroke)||
     !E7_CYCLES.includes(cycles)||!E7_LOADS.includes(load)||
     !E7_FRICTIONS.includes(mu)||![0,0.8].includes(torque)||
     typeof commandEnabled!=="boolean"||typeof contactEnabled!=="boolean"||
     ![0.005,0.0025].includes(dt))
    throw new Error("Invalid E7 frozen input");
  const steps=Math.round(E7_PERIOD*cycles/dt);
  const bottom=Math.min(...circle.map(p=>p.y));
  const hub={x:0,y:E4_RADIUS+0.03-bottom,theta:0,
    vx:0,vy:0,omega:0};
  const nodes=circle.map(p=>({id:p.id,x:p.x,y:p.y+hub.y,vx:0,vy:0}));
  let anchors=localToWorld(hub,e7LocalTargets(0,stroke,commandEnabled));
  const start=energy(hub,nodes,load,contactEnabled);
  const ledger={servoMechanical:0,commandBoundary:0,servoTracking:0,motor:0,
    rimDamping:0,hubDrag:0,nodeDrag:0,angularDrag:0,friction:0,closingDamping:0};
  let grossPositiveServo=0,grossNegativeServo=0,contactSteps=0;
  let impulseNormal=0,impulseFriction=0,maxRimStrain=0,maxOverlap=0;
  let maxActuatorForce=0,maxPairTorqueResidual=0;
  let capHits=0,servoSamples=0,errorSum=0;
  let finite=true;
  const cycleSummaries=[],frames=captureFrames?[]:undefined;
  let cyclePos=0,cycleNeg=0,cycleSaturations=0,cyclePeakStrain=0;
  let lastCycleX=0;
  if(captureFrames)frames.push(frame(0,hub,nodes,anchors,contactEnabled));

  for(let step=0;step<steps;step++){
    const time=step*dt;
    anchors=localToWorld(hub,e7LocalTargets(time,stroke,commandEnabled));
    const fx=new Float64Array(E7_COUNT),fy=new Float64Array(E7_COUNT);
    let hx=-HUB_DRAG*hub.vx,hy=-load-HUB_DRAG*hub.vy;
    const drive=-torque;
    let hTorque=drive-ANGULAR_DRAG*hub.omega;
    ledger.motor+=drive*hub.omega*dt;
    ledger.hubDrag-=HUB_DRAG*(hub.vx**2+hub.vy**2)*dt;
    ledger.angularDrag-=ANGULAR_DRAG*hub.omega**2*dt;
    let touching=0;

    for(let i=0;i<E7_COUNT;i++){
      const n=nodes[i],a=anchors[i];
      const dx=a.x-n.x,dy=a.y-n.y;
      const length=Math.hypot(dx,dy);
      const ux=length>1e-12?dx/length:0;
      const uy=length>1e-12?dy/length:0;
      const closing=(a.vx-n.vx)*ux+(a.vy-n.vy)*uy;
      const servo=e7ServoForce(dx,dy,closing,forceLimit);
      fx[i]+=servo.fx;fy[i]+=servo.fy;
      hx-=servo.fx;hy-=servo.fy;
      hTorque-=cross(a.rx,a.ry,servo.fx,servo.fy);
      // Lever arm (node - anchor) parallel to F, so it cannot create torque.
      maxPairTorqueResidual=Math.max(maxPairTorqueResidual,
        Math.abs(cross(n.x-a.x,n.y-a.y,servo.fx,servo.fy)));
      maxActuatorForce=Math.max(maxActuatorForce,servo.appliedMagnitude);
      if(servo.saturated){capHits++;cycleSaturations++;}
      servoSamples++;errorSum+=length*length;
      // Servo external power into point masses + rigid hub.
      // v_base excludes prescribed anchor motion, so this captures the
      // mechanical energy of a capped controller, not imaginary spring energy.
      const servoP=servo.fx*(n.vx-a.baseVX)+servo.fy*(n.vy-a.baseVY);
      const commandP=servo.fx*a.commandVX+servo.fy*a.commandVY;
      ledger.servoMechanical+=servoP*dt;
      ledger.commandBoundary+=commandP*dt;
      ledger.servoTracking+=(servoP-commandP)*dt;
      grossPositiveServo+=Math.max(0,servoP)*dt;
      grossNegativeServo+=Math.min(0,servoP)*dt;
      cyclePos+=Math.max(0,servoP)*dt;
      cycleNeg+=Math.min(0,servoP)*dt;
      fx[i]-=NODE_DRAG*n.vx;
      fy[i]-=NODE_DRAG*n.vy;
      ledger.nodeDrag-=NODE_DRAG*(n.vx*n.vx+n.vy*n.vy)*dt;
      const g=contact(n.y,n.vx,n.vy,mu,contactEnabled);
      fx[i]+=g.friction;fy[i]+=g.normal;
      if(g.normal>0){
        touching++;
        impulseNormal+=g.normal*dt;
        impulseFriction+=g.friction*dt;
        maxOverlap=Math.max(maxOverlap,g.penetration);
        ledger.friction+=g.friction*n.vx*dt;
        ledger.closingDamping+=g.closing*n.vy*dt;
      }
    }

    for(const edge of rimEdges){
      const a=nodes[edge.a],b=nodes[edge.b];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1e-12,Math.hypot(dx,dy));
      const ux=dx/d,uy=dy/d;
      const relative=(b.vx-a.vx)*ux+(b.vy-a.vy)*uy;
      const extension=d-edge.rest;
      const force=RIM_K*extension+RIM_D*relative;
      fx[edge.a]+=force*ux;fy[edge.a]+=force*uy;
      fx[edge.b]-=force*ux;fy[edge.b]-=force*uy;
      ledger.rimDamping-=RIM_D*relative**2*dt;
      const strain=Math.abs(extension/Math.max(edge.rest,1e-12));
      maxRimStrain=Math.max(maxRimStrain,strain);
      cyclePeakStrain=Math.max(cyclePeakStrain,strain);
    }

    if(touching)contactSteps++;
    hub.vx+=hx/HUB_MASS*dt;
    hub.vy+=hy/HUB_MASS*dt;
    hub.omega+=hTorque/HUB_INERTIA*dt;
    hub.x+=hub.vx*dt;
    hub.y+=hub.vy*dt;
    hub.theta+=hub.omega*dt;
    for(let i=0;i<E7_COUNT;i++){
      const n=nodes[i];
      n.vx+=fx[i]/NODE_MASS*dt;n.vy+=fy[i]/NODE_MASS*dt;
      n.x+=n.vx*dt;n.y+=n.vy*dt;
    }
    if(![hub.x,hub.y,hub.theta,hub.vx,hub.vy,hub.omega,
       ...nodes.flatMap(n=>[n.x,n.y,n.vx,n.vy])].every(Number.isFinite)){
      finite=false;break;
    }
    if(captureFrames&&((step+1)%Math.round(0.1/dt)===0||step===steps-1)){
      const current=localToWorld(hub,e7LocalTargets((step+1)*dt,stroke,commandEnabled));
      frames.push(frame((step+1)*dt,hub,nodes,current,contactEnabled));
    }
    if((step+1)*dt/E7_PERIOD>=cycleSummaries.length+1-1e-9){
      cycleSummaries.push({
        cycle:cycleSummaries.length+1,
        horizontalTravelDelta:round(hub.x-lastCycleX),
        positiveServoWork:round(cyclePos),
        negativeServoWork:round(cycleNeg),
        saturatedNodeSteps:cycleSaturations,
        maxRimStrainProxy:round(cyclePeakStrain),
      });
      lastCycleX=hub.x;cyclePos=0;cycleNeg=0;cycleSaturations=0;cyclePeakStrain=0;
    }
  }
  if(!finite)return {forceLimit,stroke,cycles,load,mu,torque,
    numericallyFinite:false,metrics:null,cycleSummaries,frames};
  anchors=localToWorld(hub,e7LocalTargets(E7_PERIOD*cycles,stroke,commandEnabled));
  const end=energy(hub,nodes,load,contactEnabled);
  // commandBoundary + servoTracking = servoMechanical; do NOT double count.
  const workSum=ledger.servoMechanical+ledger.motor+ledger.rimDamping+
    ledger.hubDrag+ledger.nodeDrag+ledger.angularDrag+
    ledger.friction+ledger.closingDamping;
  const delta=end.total-start.total;
  const residual=delta-workSum;
  const denom=Math.max(1,Math.abs(start.total),Math.abs(end.total),
    Math.abs(workSum),Math.abs(ledger.servoMechanical));
  return {
    forceLimit,stroke,cycles,load,mu,torque,commandEnabled,contactEnabled,dt,
    numericallyFinite:true,modelVersion:E7_MODEL,cycleSummaries,frames,
    metrics:{
      horizontalTravel:round(hub.x),
      finalHubY:round(hub.y),
      finalRotationDegrees:round(hub.theta*180/Math.PI),
      totalPositiveServoWork:round(grossPositiveServo),
      totalNegativeServoWork:round(grossNegativeServo),
      netServoMechanicalWork:round(ledger.servoMechanical),
      commandedAnchorBoundaryWork:round(ledger.commandBoundary),
      servoTrackingWork:round(ledger.servoTracking),
      motorWork:round(ledger.motor),
      maxAppliedServoForce:round(maxActuatorForce),
      forceCapHitCount:capHits,
      forceCapHitFraction:round(capHits/Math.max(1,servoSamples)),
      rmsTrackingErrorProxy:round(Math.sqrt(errorSum/Math.max(1,servoSamples))),
      maxRimStrainProxy:round(maxRimStrain),
      strainFlagHeuristic:maxRimStrain>E7_STRAIN_FLAG,
      maxPairTorqueResidual:round(maxPairTorqueResidual),
      maxNumericalFloorOverlap:round(maxOverlap),
      normalImpulse:round(impulseNormal),
      frictionImpulse:round(impulseFriction),
      contactTimeFraction:round(contactSteps/steps),
      rimDampingWork:round(ledger.rimDamping),
      nodeDragWork:round(ledger.nodeDrag),
      hubDragWork:round(ledger.hubDrag),
      angularDragWork:round(ledger.angularDrag),
      frictionWork:round(ledger.friction),
      floorDampingWork:round(ledger.closingDamping),
      initialEnergy:round(start.total),
      finalEnergy:round(end.total),
      energyDelta:round(delta),
      energyResidual:round(residual),
      relativeEnergyResidual:round(Math.abs(residual)/denom),
      grossWorkToAbsoluteTravelProxy:round(
        grossPositiveServo/Math.max(0.01,Math.abs(hub.x))),
    }
  };
}

export function buildE7Receipt({
  load=2,mu=0.35,torque=0.8,recordedAt=new Date().toISOString()
}={}){
  if(!E7_LOADS.includes(load)||!E7_FRICTIONS.includes(mu)||
     ![0,0.8].includes(torque))throw new Error("Invalid E7 frozen study controls");
  const cases=E7_FORCE_LIMITS.flatMap(forceLimit=>
    E7_STROKES.flatMap(stroke=>E7_CYCLES.map(cycles=>{
      const s=simulateE7({forceLimit,stroke,cycles,load,mu,torque});
      return {forceLimit,stroke,cycles,numericallyFinite:s.numericallyFinite,
        metrics:s.metrics,cycleSummaries:s.cycleSummaries};
    })));
  const negatives=[
    {kind:"no-ground",args:{contactEnabled:false,forceLimit:10,stroke:1,cycles:1}},
    {kind:"no-friction",args:{mu:0,forceLimit:10,stroke:1,cycles:1}},
    {kind:"zero-actuator-force",args:{forceLimit:0,stroke:1,cycles:1}},
    {kind:"no-command",args:{commandEnabled:false,forceLimit:10,stroke:1,cycles:1}},
  ].map(n=>{
    const s=simulateE7({load,mu,torque,...n.args});
    return {kind:n.kind,numericallyFinite:s.numericallyFinite,
      normalImpulse:s.metrics?.normalImpulse??null,
      frictionImpulse:s.metrics?.frictionImpulse??null,
      netServoWork:s.metrics?.netServoMechanicalWork??null,
      commandWork:s.metrics?.commandedAnchorBoundaryWork??null,
      capHitCount:s.metrics?.forceCapHitCount??null};
  });
  const coarse=simulateE7({forceLimit:10,stroke:1,cycles:1,load,mu,torque,dt:0.005});
  const fine=simulateE7({forceLimit:10,stroke:1,cycles:1,load,mu,torque,dt:0.0025});
  return {
    schema:"phi-morph.e7.receipt.v1",origin:"SIMULATED",
    physicalValidation:"NONE",modelVersion:E7_MODEL,protocol:E7_PROTOCOL,
    recordedAt,units:"normalized_dimensionless",
    frozen:{
      nodeCount:E7_COUNT,rimEdgeCount:E7_COUNT,
      rimRestLengthsFrom:"same initial round geometry for all cases",
      forceLimits:[...E7_FORCE_LIMITS],strokeFractions:[...E7_STROKES],
      cycleCounts:[...E7_CYCLES],cyclePeriod:E7_PERIOD,
      dt:E7_DT,load,mu,torque,caseCount:cases.length,
      negativeControlCount:negatives.length,
      servoLaw:"collinear spring-damper force capped by resultant magnitude",
      servoEnergy:"active mechanical work F dot (v_node - v_rigid_anchor)",
      conservativeEnergy:"kinetic+gravity+rim_spring+ground_penalty",
      failureCriterion:"NONE; strainFlagHeuristic is only a research threshold",
    },
    cases,negativeControls:negatives,
    timeStepDiagnostic:{
      coarseDt:0.005,fineDt:0.0025,
      travelDelta:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.horizontalTravel-fine.metrics.horizontalTravel)):null,
      energyResidualDelta:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.relativeEnergyResidual-
          fine.metrics.relativeEnergyResidual)):null,
      warning:"One timestep-halving check is not convergence proof",
    },
    limitations:[
      "A bounded active force servo is not a physical pneumatic/electric actuator or membrane.",
      "Force cap is dimensionless; a cap hit is not a motor failure or structural damage.",
      "No fatigue law: repeated-cycle strain is an indicator, not a lifespan prediction.",
      "Gross positive servo work is mechanical work and not battery consumption.",
      "Travel-to-work ratio is not a vehicle efficiency or traction measurement.",
      "No physical materials, water tuning, rolling resistance calibration or validation.",
    ]
  };
}
export function e7Csv(receipt){
  const rows=[["protocol","forceLimit","stroke","cycles","travel",
    "positiveServoWork","negativeServoWork","netServoWork",
    "capHitFraction","rmsTrackingError","peakRimStrain","strainFlag",
    "relativeEnergyResidual","numericallyFinite"]];
  for(const row of receipt.cases){
    const m=row.metrics;
    rows.push([receipt.protocol,row.forceLimit??"uncapped",row.stroke,row.cycles,
      m?.horizontalTravel??"",m?.totalPositiveServoWork??"",
      m?.totalNegativeServoWork??"",m?.netServoMechanicalWork??"",
      m?.forceCapHitFraction??"",m?.rmsTrackingErrorProxy??"",
      m?.maxRimStrainProxy??"",m?.strainFlagHeuristic??"",
      m?.relativeEnergyResidual??"",row.numericallyFinite]);
  }
  return rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n")+"\n";
}
