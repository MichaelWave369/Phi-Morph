/**
 * Φ-Morph E6: explicitly driven, force-paired deformable rim.
 *
 * 24 freely moving point masses joined by rim springs and spring/damper
 * actuators to body-fixed, controllably translating anchor points.
 * Actuator forces have equal/opposite hub reaction and moment; commanded
 * local-anchor motion is charged to actuator work F·(R·a_dot)*dt.
 *
 * Toy 2D dynamics only. NOT a tire, water, electrohydraulics, material
 * certification, validated friction law or energy-efficient shape machine.
 */
import { e4Outline, E4_RADIUS, E4_FLOOR_K, E4_FLOOR_DAMPING } from "./e4.js";

export const E6_PROTOCOL = "PM-E6-0.7.0";
export const E6_MODEL = "deformable-active-anchor-contact-0.7.0";
export const E6_MODES = Object.freeze(["round", "square", "morph-cycle"]);
export const E6_FRICTIONS = Object.freeze([0, 0.35, 0.8]);
export const E6_TORQUES = Object.freeze([0, 0.8]);
export const E6_LOADS = Object.freeze([1, 2, 4]);
export const E6_DURATION = 8;
export const E6_DT = 0.005;
export const E6_COUNT = 24;

const HUB_MASS = 6, HUB_INERTIA = 13, NODE_MASS = 0.25;
const SPOKE_STIFFNESS = 21, SPOKE_DAMPING = 0.45;
const RIM_STIFFNESS = 11, RIM_DAMPING = 0.14;
const HUB_DRAG = 0.025, NODE_DRAG = 0.035, ROTATION_DRAG = 0.025;
const FRICTION_SPEED = 0.2;
const round = n => Math.round(n*1e6)/1e6;
const cross = (ax,ay,bx,by) => ax*by-ay*bx;
const vec = (x,y) => ({x,y});
const rotate = (x,y,c,s) => ({x:c*x-s*y,y:s*x+c*y});

const roundShape=e4Outline("circle");
const squareShape=e4Outline("rounded-square");

function smoothSegment(t,from,to,increasing){
  if(t<=from) return {v:increasing?0:1,dv:0};
  if(t>=to) return {v:increasing?1:0,dv:0};
  const x=(t-from)/(to-from);
  const v=x*x*(3-2*x);
  const dv=6*x*(1-x)/(to-from);
  return {v:increasing?v:1-v,dv:increasing?dv:-dv};
}

/** Morph schedule: round 0..1; morph 1..3; hold 3..4; return 4..6; round 6..8. */
export function e6Command(mode,time){
  if(!E6_MODES.includes(mode)||!Number.isFinite(time)||time<0)
    throw new Error("Invalid E6 control schedule");
  if(mode==="round") return {alpha:0,alphaRate:0};
  if(mode==="square") return {alpha:1,alphaRate:0};
  if(time<1) return {alpha:0,alphaRate:0};
  if(time<3){
    const v=smoothSegment(time,1,3,true);
    return {alpha:v.v,alphaRate:v.dv};
  }
  if(time<=4) return {alpha:1,alphaRate:0};
  if(time<6){
    const v=smoothSegment(time,4,6,false);
    return {alpha:v.v,alphaRate:v.dv};
  }
  return {alpha:0,alphaRate:0};
}

export function e6LocalAnchors(mode,time){
  const {alpha,alphaRate}=e6Command(mode,time);
  return roundShape.map((p,i)=>{
    const q=squareShape[i];
    return {id:i,
      x:p.x+(q.x-p.x)*alpha,y:p.y+(q.y-p.y)*alpha,
      dx:(q.x-p.x)*alphaRate,dy:(q.y-p.y)*alphaRate};
  });
}

function staticRimEdges(positions){
  return positions.map((p,i)=>{
    const next=(i+1)%positions.length;
    const q=positions[next];
    return {a:i,b:next,rest:Math.hypot(q.x-p.x,q.y-p.y)};
  });
}

export function e6GroundContact(y,vx,vy,mu,enabled=true){
  if(![y,vx,vy,mu].every(Number.isFinite)||mu<0||mu>1||
     typeof enabled!=="boolean") throw new Error("Invalid E6 contact input");
  const penetration=E4_RADIUS-y;
  if(!enabled||penetration<=0) return {normal:0,friction:0,closing:0,penetration:0};
  const elastic=E4_FLOOR_K*penetration;
  const closing=E4_FLOOR_DAMPING*Math.max(0,-vy);
  const normal=elastic+closing;
  const friction=mu===0?0:-mu*normal*Math.tanh(vx/FRICTION_SPEED);
  return {normal,friction,closing,penetration};
}

function rotatedAnchors(hub,local){
  const c=Math.cos(hub.theta),s=Math.sin(hub.theta);
  return local.map(a=>{
    const r=rotate(a.x,a.y,c,s);
    const dr=rotate(a.dx,a.dy,c,s);
    return {id:a.id, rx:r.x,ry:r.y, x:hub.x+r.x,y:hub.y+r.y,
      vx:hub.vx-hub.omega*r.y+dr.x,
      vy:hub.vy+hub.omega*r.x+dr.y,
      commandVX:dr.x,commandVY:dr.y};
  });
}
function poseFrames(step,dt,hub,nodes,anchors,enabled){
  return {
    time:round(step*dt),hub:{x:round(hub.x),y:round(hub.y),
      theta:round(hub.theta),omega:round(hub.omega)},
    nodes:nodes.map(n=>({id:n.id,x:round(n.x),y:round(n.y),
      contacting:enabled&&n.y<E4_RADIUS})),
    anchors:anchors.map(a=>({id:a.id,x:round(a.x),y:round(a.y)})),
  };
}

function totalEnergy(hub,nodes,anchors,edges,load,contactEnabled){
  const kinetic=0.5*HUB_MASS*(hub.vx**2+hub.vy**2)+0.5*HUB_INERTIA*hub.omega**2+
    nodes.reduce((s,n)=>s+0.5*NODE_MASS*(n.vx**2+n.vy**2),0);
  const loadPotential=load*hub.y;
  let spokeElastic=0, rimElastic=0, floorElastic=0;
  for(let i=0;i<nodes.length;i++){
    const dx=nodes[i].x-anchors[i].x,dy=nodes[i].y-anchors[i].y;
    spokeElastic+=0.5*SPOKE_STIFFNESS*(dx*dx+dy*dy);
    if(contactEnabled){
      const pen=Math.max(0,E4_RADIUS-nodes[i].y);
      floorElastic+=0.5*E4_FLOOR_K*pen*pen;
    }
  }
  for(const edge of edges){
    const a=nodes[edge.a],b=nodes[edge.b];
    const stretch=Math.hypot(b.x-a.x,b.y-a.y)-edge.rest;
    rimElastic+=0.5*RIM_STIFFNESS*stretch*stretch;
  }
  return {kinetic,loadPotential,spokeElastic,rimElastic,floorElastic,
    total:kinetic+loadPotential+spokeElastic+rimElastic+floorElastic};
}

/**
 * A structural oscillator with a controllable body-attached spring end.
 * All forces between rim nodes and hub are paired; the hub receives
 * rotational reaction -r_anchor × F_node. Commands move anchors in hub
 * coordinates, so energy injected through that motion is explicitly counted.
 */
export function simulateE6({
  mode="morph-cycle",mu=0.35,torque=0.8,load=2,
  contactEnabled=true,actuationEnabled=true,
  dt=E6_DT,duration=E6_DURATION,captureFrames=false,
}={}){
  if(!E6_MODES.includes(mode))throw new Error("Invalid E6 mode");
  if(!E6_FRICTIONS.includes(mu)||!E6_TORQUES.includes(torque)||
    !E6_LOADS.includes(load))throw new Error("Invalid E6 protocol control");
  if(typeof contactEnabled!=="boolean"||typeof actuationEnabled!=="boolean")
    throw new Error("Invalid E6 enabling flags");
  if(![0.005,0.0025].includes(dt))throw new Error("Invalid E6 timestep");
  if(!Number.isFinite(duration)||duration<=0||duration>8)throw new Error("Invalid E6 duration");
  const steps=Math.round(duration/dt);
  if(Math.abs(steps*dt-duration)>1e-9)throw new Error("Duration not divisible by timestep");
  const drivenMode=actuationEnabled?mode:"round";
  const initialAnchors=e6LocalAnchors(drivenMode,0);
  // Static anchor positions define the unstressed rim: a held-square control
  // has different rest lengths and support geometry than a round start.
  const edges=staticRimEdges(initialAnchors);
  const minY=Math.min(...initialAnchors.map(a=>a.y));
  const hub={x:0,y:E4_RADIUS+0.03-minY,vx:0,vy:0,theta:0,omega:0};
  const nodes=initialAnchors.map(a=>({
    id:a.id,x:a.x,y:a.y+hub.y,vx:0,vy:0,
  }));
  let anchors=rotatedAnchors(hub,initialAnchors);
  const initialEnergy=totalEnergy(hub,nodes,anchors,edges,load,contactEnabled);
  const work={motor:0,actuator:0,hubDrag:0,nodeDrag:0,rotationDrag:0,
    spokeDamping:0,rimDamping:0,groundFriction:0,groundClosingDamping:0};
  let peakPenetration=0,peakNormalForce=0,normalImpulse=0,frictionImpulse=0;
  let peakActuatorPower=0,peakActuatorForce=0,contactSteps=0,finite=true;
  const frames=captureFrames?[]:undefined;
  if(captureFrames) frames.push(poseFrames(0,dt,hub,nodes,anchors,contactEnabled));

  for(let step=0;step<steps;step++){
    const t=step*dt;
    anchors=rotatedAnchors(hub,e6LocalAnchors(drivenMode,t));
    const fx=new Float64Array(E6_COUNT),fy=new Float64Array(E6_COUNT);
    let hx=-HUB_DRAG*hub.vx,hy=-load-HUB_DRAG*hub.vy;
    const motorTorque=-torque;
    let tau=motorTorque-ROTATION_DRAG*hub.omega;
    work.motor+=motorTorque*hub.omega*dt;
    work.hubDrag-=HUB_DRAG*(hub.vx**2+hub.vy**2)*dt;
    work.rotationDrag-=ROTATION_DRAG*hub.omega**2*dt;
    let forceSum=0,normalThisStep=0,touching=0,actuatorPower=0;

    for(let i=0;i<E6_COUNT;i++){
      const n=nodes[i],a=anchors[i];
      const relativeX=a.x-n.x,relativeY=a.y-n.y;
      const vrx=a.vx-n.vx,vry=a.vy-n.vy;
      const springFx=SPOKE_STIFFNESS*relativeX+SPOKE_DAMPING*vrx;
      const springFy=SPOKE_STIFFNESS*relativeY+SPOKE_DAMPING*vry;
      fx[i]+=springFx;fy[i]+=springFy;
      hx-=springFx;hy-=springFy;
      tau-=cross(a.rx,a.ry,springFx,springFy);
      const power=springFx*a.commandVX+springFy*a.commandVY;
      work.actuator+=power*dt;actuatorPower+=power;
      forceSum=Math.max(forceSum,Math.hypot(springFx,springFy));
      work.spokeDamping-=SPOKE_DAMPING*(vrx*vrx+vry*vry)*dt;
      work.nodeDrag-=NODE_DRAG*(n.vx*n.vx+n.vy*n.vy)*dt;
      fx[i]-=NODE_DRAG*n.vx;fy[i]-=NODE_DRAG*n.vy;
      const ground=e6GroundContact(n.y,n.vx,n.vy,mu,contactEnabled);
      fx[i]+=ground.friction;fy[i]+=ground.normal;
      if(ground.normal>0){
        touching++;normalThisStep+=ground.normal;
        normalImpulse+=ground.normal*dt;
        frictionImpulse+=ground.friction*dt;
        peakPenetration=Math.max(peakPenetration,ground.penetration);
        work.groundFriction+=ground.friction*n.vx*dt;
        work.groundClosingDamping+=ground.closing*n.vy*dt;
      }
    }

    for(const edge of edges){
      const a=nodes[edge.a],b=nodes[edge.b];
      const dx=b.x-a.x,dy=b.y-a.y;
      const d=Math.max(1e-10,Math.hypot(dx,dy));
      const ux=dx/d,uy=dy/d;
      const relativeSpeed=(b.vx-a.vx)*ux+(b.vy-a.vy)*uy;
      const magnitude=RIM_STIFFNESS*(d-edge.rest)+RIM_DAMPING*relativeSpeed;
      const edgeX=magnitude*ux,edgeY=magnitude*uy;
      fx[edge.a]+=edgeX;fy[edge.a]+=edgeY;
      fx[edge.b]-=edgeX;fy[edge.b]-=edgeY;
      work.rimDamping-=RIM_DAMPING*relativeSpeed*relativeSpeed*dt;
    }

    if(touching>0)contactSteps++;
    peakNormalForce=Math.max(peakNormalForce,normalThisStep);
    peakActuatorPower=Math.max(peakActuatorPower,Math.abs(actuatorPower));
    peakActuatorForce=Math.max(peakActuatorForce,forceSum);

    hub.vx+=hx/HUB_MASS*dt;hub.vy+=hy/HUB_MASS*dt;
    hub.omega+=tau/HUB_INERTIA*dt;
    hub.x+=hub.vx*dt;hub.y+=hub.vy*dt;hub.theta+=hub.omega*dt;
    for(let i=0;i<E6_COUNT;i++){
      const n=nodes[i];
      n.vx+=fx[i]/NODE_MASS*dt;n.vy+=fy[i]/NODE_MASS*dt;
      n.x+=n.vx*dt;n.y+=n.vy*dt;
    }
    if(![hub.x,hub.y,hub.theta,hub.vx,hub.vy,hub.omega,
      ...nodes.flatMap(n=>[n.x,n.y,n.vx,n.vy])].every(Number.isFinite)){
      finite=false;break;
    }
    if(captureFrames&&((step+1)%Math.round(0.1/dt)===0||step===steps-1)){
      const aa=rotatedAnchors(hub,e6LocalAnchors(drivenMode,(step+1)*dt));
      frames.push(poseFrames(step+1,dt,hub,nodes,aa,contactEnabled));
    }
  }
  if(!finite) return {mode,drivenMode,mu,torque,load,contactEnabled,
    numericallyFinite:false,metrics:null,frames};

  anchors=rotatedAnchors(hub,e6LocalAnchors(drivenMode,duration));
  const end=totalEnergy(hub,nodes,anchors,edges,load,contactEnabled);
  const workSum=Object.values(work).reduce((sum,v)=>sum+v,0);
  const delta=end.total-initialEnergy.total;
  const residual=delta-workSum;
  const energyScale=Math.max(1,Math.abs(end.total),Math.abs(initialEnergy.total),
    Object.values(work).reduce((sum,v)=>sum+Math.abs(v),0));
  return {
    mode,drivenMode,mu,torque,load,contactEnabled,actuationEnabled,
    dt,duration,steps,numericallyFinite:true,modelVersion:E6_MODEL,
    metrics:{
      horizontalTravel:round(hub.x),hubHeight:round(hub.y),
      rotationDegrees:round(hub.theta*180/Math.PI),
      contactFraction:round(contactSteps/steps),
      peakNormalReaction:round(peakNormalForce),
      peakGroundPenetration:round(peakPenetration),
      normalImpulse:round(normalImpulse),frictionImpulse:round(frictionImpulse),
      peakActuatorForce:round(peakActuatorForce),
      peakActuatorPowerMagnitude:round(peakActuatorPower),
      actuatorNetWork:round(work.actuator),
      actuatorPositiveWork:round(Number.NaN), // placeholder replaced below
      motorWork:round(work.motor),
      nodeDampingWork:round(work.nodeDrag),
      hubDampingWork:round(work.hubDrag),
      rotationDampingWork:round(work.rotationDrag),
      spokeDampingWork:round(work.spokeDamping),
      rimDampingWork:round(work.rimDamping),
      frictionWork:round(work.groundFriction),
      groundDampingWork:round(work.groundClosingDamping),
      initialEnergy:round(initialEnergy.total),
      finalEnergy:round(end.total),
      initialPotential:round(initialEnergy.loadPotential),
      finalSpokeElastic:round(end.spokeElastic),
      finalRimElastic:round(end.rimElastic),
      finalContactElastic:round(end.floorElastic),
      deltaEnergy:round(delta),
      energyResidual:round(residual),
      relativeEnergyResidual:round(Math.abs(residual)/energyScale),
    },frames
  };
}

export function buildE6Receipt({
  load=2,recordedAt=new Date().toISOString(),
}={}){
  if(!E6_LOADS.includes(load))throw new Error("Invalid E6 study load");
  const runs=E6_MODES.flatMap(mode=>E6_FRICTIONS.flatMap(mu=>
    E6_TORQUES.map(torque=>{
      const s=simulateE6({mode,mu,torque,load});
      return {mode,mu,torque,load,numericallyFinite:s.numericallyFinite,
        metrics:s.metrics};
    })
  ));
  const controls=[
    {kind:"no-ground",contactEnabled:false,actuationEnabled:true,mu:0.8},
    {kind:"no-friction",contactEnabled:true,actuationEnabled:true,mu:0},
    {kind:"no-actuation",contactEnabled:true,actuationEnabled:false,mu:0.8},
  ].map(condition=>{
    const s=simulateE6({mode:"morph-cycle",mu:condition.mu,torque:0.8,load,
      contactEnabled:condition.contactEnabled,actuationEnabled:condition.actuationEnabled});
    return {kind:condition.kind,
      normalImpulse:s.metrics?.normalImpulse??null,
      frictionImpulse:s.metrics?.frictionImpulse??null,
      actuatorNetWork:s.metrics?.actuatorNetWork??null,
      horizontalTravel:s.metrics?.horizontalTravel??null,
      numericallyFinite:s.numericallyFinite};
  });
  const halfSteps=E6_MODES.map(mode=>{
    const coarse=simulateE6({mode,mu:0.35,torque:0.8,load,dt:0.005});
    const fine=simulateE6({mode,mu:0.35,torque:0.8,load,dt:0.0025});
    return {mode,dtCoarse:0.005,dtFine:0.0025,
      travelDifference:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.horizontalTravel-fine.metrics.horizontalTravel)):null,
      residualDifference:coarse.metrics&&fine.metrics?
        round(Math.abs(coarse.metrics.relativeEnergyResidual-
          fine.metrics.relativeEnergyResidual)):null};
  });
  return {
    schema:"phi-morph.e6.receipt.v1",origin:"SIMULATED",
    physicalValidation:"NONE",recordedAt,
    protocol:E6_PROTOCOL,modelVersion:E6_MODEL,
    units:"normalized_dimensionless",
    frozen:{
      nodeCount:E6_COUNT,rimEdges:E6_COUNT,nodeMass:NODE_MASS,
      hubMass:HUB_MASS,hubInertia:HUB_INERTIA,
      radialSpokeStiffness:SPOKE_STIFFNESS,spokeDamping:SPOKE_DAMPING,
      rimStiffness:RIM_STIFFNESS,rimDamping:RIM_DAMPING,
      dt:E6_DT,duration:E6_DURATION,
      shapeInterpolation:"local_anchor_linear_round_to_rounded_square",
      schedule:"round_0_1;morph_1_3;square_3_4;return_4_6;round_6_8",
      forceReaction:"F_node=-F_hub, tau_hub=-(r_anchor cross F_node)",
      actuatorPower:"F_node dot (R * local_anchor_rate)",
      contactLaw:"compression_only_penalty_and_velocity_smoothed_friction",
      load,frictions:[...E6_FRICTIONS],torques:[...E6_TORQUES],
      modes:[...E6_MODES],caseCount:runs.length,negativeControlCount:controls.length,
    },
    runs,negativeControls:controls,timeStepChecks:halfSteps,
    caveats:[
      "A mass-spring demonstration with body-attached moving anchor points, not a pressure-driven tire.",
      "Held-square and round controls begin at different outlines and independent rim rest lengths; not a controlled performance ranking.",
      "Signed net actuator work may be negative when returning energy; it is not electrical consumption. Gross positive work must be reported separately.",
      "No motors, pumps, energy recovery efficiency, membrane, fluid, wear, temperature or manufacturing constraints.",
      "Velocity-smoothed friction and discrete node-floor penalty are not calibrated physical laws.",
      "Run-to-run timestep differences do not constitute independent physical validation.",
    ],
  };
}
export function e6Csv(receipt){
  const rows=[["protocol","mode","mu","torque","load","travel","actuatorNetWork",
    "motorWork","peakActuatorForce","energyResidual","normalImpulse",
    "frictionImpulse","numericallyFinite"]];
  for(const r of receipt.runs){
    const m=r.metrics;
    rows.push([receipt.protocol,r.mode,r.mu,r.torque,r.load,
      m?.horizontalTravel??"",m?.actuatorNetWork??"",m?.motorWork??"",
      m?.peakActuatorForce??"",m?.energyResidual??"",m?.normalImpulse??"",
      m?.frictionImpulse??"",r.numericallyFinite]);
  }
  return rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n")+"\n";
}
