/**
 * Phi-Morph E9: coupled actuator-coordinate + deformable rolling-rim toy.
 *
 * This REUSES E8's force/power-limited PD controller, with one generalized
 * actuator displacement q, and E7-style 24-node rim mechanics. The same q
 * drives all moving spoke anchors; the rim's elastic/damping reaction is
 * applied to q, rather than treating the commanded geometry as a free motion.
 *
 * Source/provenance: SIMULATED ONLY. Not a tire, material test, or machine.
 */
import {e4Outline,E4_RADIUS,E4_FLOOR_K,E4_FLOOR_DAMPING} from "./e4.js";
import {e8Target,e8LimitedForce,E8_GAINS} from "./e8.js";

export const E9_PROTOCOL="PM-E9-1.0.0";
export const E9_MODEL="coupled-generalized-coordinate-rim-1.0.0";
export const E9_PROFILES=Object.freeze(["slow","medium","fast"]);
export const E9_FORCE_LIMITS=Object.freeze([0,4,10]);
export const E9_POWER_LIMITS=Object.freeze([0,2,null]);
export const E9_CYCLES=Object.freeze([1,2]);
export const E9_DT=0.005;
export const E9_PERIOD=8;
const N=24, MASS_NODE=0.25, MASS_HUB=6, INERTIA_HUB=13, MASS_Q=1;
const SPOKE_K=21,SPOKE_C=0.45,RIM_K=11,RIM_C=0.14;
const Q_K=2,Q_DRAG=0.7,HUB_DRAG=0.025,NODE_DRAG=0.035,OMEGA_DRAG=0.025;
const MU_OPTIONS=[0,0.35,0.8],TORQUE_OPTIONS=[0,0.8],LOAD_OPTIONS=[1,2,4];
const round=x=>{const a=Math.round(x*1e6)/1e6;return a===0?0:a};
const cross=(x,y,a,b)=>x*b-y*a;
const circle=e4Outline("circle"),square=e4Outline("rounded-square");
const deltas=circle.map((p,i)=>({dx:square[i].x-p.x,dy:square[i].y-p.y}));
const rimEdges=circle.map((p,i)=>({a:i,b:(i+1)%N,rest:Math.hypot(
  circle[(i+1)%N].x-p.x,circle[(i+1)%N].y-p.y
)}));

function anchorsAt(hub,q,qdot){
 const c=Math.cos(hub.angle),s=Math.sin(hub.angle);
 return circle.map((p,i)=>{
   const localX=p.x+q*deltas[i].dx,localY=p.y+q*deltas[i].dy;
   const rx=c*localX-s*localY,ry=s*localX+c*localY;
   const qrx=c*deltas[i].dx-s*deltas[i].dy;
   const qry=s*deltas[i].dx+c*deltas[i].dy;
   const baseVX=hub.vx-hub.omega*ry,baseVY=hub.vy+hub.omega*rx;
   return {id:i,rx,ry,x:hub.x+rx,y:hub.y+ry,
     qrx,qry,baseVX,baseVY,
     vx:baseVX+qdot*qrx,vy:baseVY+qdot*qry};
 });
}
function floorForce(node,mu,enabled){
 const pen=E4_RADIUS-node.y;
 if(!enabled||pen<=0)return {normal:0,tangential:0,closing:0,penetration:0};
 const closing=E4_FLOOR_DAMPING*Math.max(0,-node.vy);
 const normal=E4_FLOOR_K*pen+closing;
 return {normal,closing,penetration:pen,
   tangential:mu===0?0:-mu*normal*Math.tanh(node.vx/0.2)};
}
function energies(hub,nodes,q,qdot,load,ground,spokesEnabled){
 const hubKin=0.5*MASS_HUB*(hub.vx**2+hub.vy**2)+0.5*INERTIA_HUB*hub.omega**2;
 const nodeKin=nodes.reduce((s,n)=>s+0.5*MASS_NODE*(n.vx**2+n.vy**2),0);
 const actuatorKin=0.5*MASS_Q*qdot*qdot,actuatorSpring=0.5*Q_K*q*q;
 const loadPotential=load*hub.y;
 const floorPotential=ground?nodes.reduce((s,n)=>{
   const pen=Math.max(0,E4_RADIUS-n.y);return s+0.5*E4_FLOOR_K*pen*pen;
 },0):0;
 const edgesEnergy=rimEdges.reduce((sum,e)=>{
   const a=nodes[e.a],b=nodes[e.b];
   const stretch=Math.hypot(b.x-a.x,b.y-a.y)-e.rest;
   return sum+0.5*RIM_K*stretch*stretch;
 },0);
 const anchors=anchorsAt(hub,q,qdot);
 const spokeEnergy=spokesEnabled?nodes.reduce((sum,n,i)=>{
   const dx=anchors[i].x-n.x,dy=anchors[i].y-n.y;
   return sum+0.5*SPOKE_K*(dx*dx+dy*dy);
 },0):0;
 return {hubKin,nodeKin,actuatorKin,actuatorSpring,loadPotential,
   floorPotential,edgesEnergy,spokeEnergy,
   total:hubKin+nodeKin+actuatorKin+actuatorSpring+loadPotential+
     floorPotential+edgesEnergy+spokeEnergy};
}
function snapshot(t,hub,nodes,anchors,q,qdot,command,ground){
 return {time:round(t),q:round(q),qdot:round(qdot),command:round(command),
   hub:{x:round(hub.x),y:round(hub.y),angle:round(hub.angle)},
   nodes:nodes.map(n=>({id:n.id,x:round(n.x),y:round(n.y),
     contacting:ground&&n.y<E4_RADIUS})),
   anchors:anchors.map(a=>({id:a.id,x:round(a.x),y:round(a.y)}))};
}

/** A single q motor moves 24 spoke anchors and receives rim reaction. */
export function simulateE9({
 profile="medium",forceLimit=10,powerLimit=2,cycles=1,
 load=2,mu=0.35,torque=0.8,spokesEnabled=true,groundEnabled=true,
 dt=E9_DT,captureFrames=false,
}={}){
 if(!E9_PROFILES.includes(profile)||!([null,...E9_FORCE_LIMITS].includes(forceLimit))||
   !E9_POWER_LIMITS.includes(powerLimit)||!E9_CYCLES.includes(cycles)||
   !LOAD_OPTIONS.includes(load)||!MU_OPTIONS.includes(mu)||
   !TORQUE_OPTIONS.includes(torque)||
   typeof spokesEnabled!=="boolean"||typeof groundEnabled!=="boolean"||
   ![0.005,0.0025].includes(dt))
   throw new Error("Invalid E9 study inputs");
 const steps=Math.round(E9_PERIOD*cycles/dt);
 const low=Math.min(...circle.map(p=>p.y));
 const hub={x:0,y:E4_RADIUS+0.03-low,angle:0,vx:0,vy:0,omega:0};
 const nodes=circle.map(p=>({id:p.id,x:p.x,y:p.y+hub.y,vx:0,vy:0}));
 let q=0,qdot=0;
 let anchors=anchorsAt(hub,q,qdot);
 const initial=energies(hub,nodes,q,qdot,load,groundEnabled,spokesEnabled);
 const w={drive:0,qDrag:0,hubDrag:0,rotationDrag:0,nodeDrag:0,
   spokeDamping:0,rimDamping:0,floorFriction:0,floorDamping:0};
 let positive=0,negative=0,forceHits=0,powerHits=0,normalImpulse=0;
 let frictionImpulse=0,peakSpokeForce=0,maxRimStrain=0,peakOverlap=0;
 let peakAppliedDrive=0,peakSampledDrivePower=0,trackingSquared=0;
 let trackingAbsolute=0,peakError=0,finite=true;
 const frames=captureFrames?[]:undefined;
 const summaries=[];
 let cyclePositive=0,cycleNegative=0,cycleForce=0,cyclePower=0,cycleTrack=0;
 let loop=[];
 if(captureFrames)frames.push(snapshot(0,hub,nodes,anchors,q,qdot,0,groundEnabled));
 loop.push({command:0,position:0});
 const {kp,kd}=E8_GAINS[profile];

 for(let step=0;step<steps;step++){
   const time=step*dt;
   const target=e8Target(time,"cycle",1);
   const error=target-q;
   const limited=e8LimitedForce(kp*error-kd*qdot,qdot,forceLimit,powerLimit);
   const drive=limited.applied;
   let qForce=drive-Q_K*q-Q_DRAG*qdot;
   let hubFx=-HUB_DRAG*hub.vx,hubFy=-load-HUB_DRAG*hub.vy;
   let hubTorque=-torque-OMEGA_DRAG*hub.omega;
   const fx=new Float64Array(N),fy=new Float64Array(N);
   anchors=anchorsAt(hub,q,qdot);

   if(limited.forceSaturated){forceHits++;cycleForce++;}
   if(limited.powerSaturated){powerHits++;cyclePower++;}
   peakAppliedDrive=Math.max(peakAppliedDrive,Math.abs(drive));
   peakSampledDrivePower=Math.max(peakSampledDrivePower,
     Math.abs(limited.sampledMechanicalPower));
   peakError=Math.max(peakError,Math.abs(error));
   trackingSquared+=error*error*dt;trackingAbsolute+=Math.abs(error)*dt;
   cycleTrack+=error*error*dt;
   const inputWork=limited.sampledMechanicalPower*dt;
   w.drive+=inputWork;
   positive+=Math.max(0,inputWork);negative+=Math.min(0,inputWork);
   cyclePositive+=Math.max(0,inputWork);cycleNegative+=Math.min(0,inputWork);
   w.qDrag-=Q_DRAG*qdot*qdot*dt;
   w.hubDrag-=HUB_DRAG*(hub.vx*hub.vx+hub.vy*hub.vy)*dt;
   w.rotationDrag-=OMEGA_DRAG*hub.omega*hub.omega*dt;

   for(let i=0;i<N;i++){
     const n=nodes[i],a=anchors[i];
     if(spokesEnabled){
       const dx=a.x-n.x,dy=a.y-n.y;
       const d=Math.hypot(dx,dy);
       if(d>1e-12){
         const ux=dx/d,uy=dy/d;
         const relative=(a.vx-n.vx)*ux+(a.vy-n.vy)*uy;
         const magnitude=SPOKE_K*d+SPOKE_C*relative;
         const fsx=magnitude*ux,fsy=magnitude*uy;
         fx[i]+=fsx;fy[i]+=fsy;
         hubFx-=fsx;hubFy-=fsy;
         hubTorque-=cross(a.rx,a.ry,fsx,fsy);
         // Exact work-conjugate response to moving the local spoke anchor.
         qForce-=fsx*a.qrx+fsy*a.qry;
         w.spokeDamping-=SPOKE_C*relative*relative*dt;
         peakSpokeForce=Math.max(peakSpokeForce,Math.abs(magnitude));
       }
     }
     fx[i]-=NODE_DRAG*n.vx;fy[i]-=NODE_DRAG*n.vy;
     w.nodeDrag-=NODE_DRAG*(n.vx*n.vx+n.vy*n.vy)*dt;
     const g=floorForce(n,mu,groundEnabled);
     fx[i]+=g.tangential;fy[i]+=g.normal;
     normalImpulse+=g.normal*dt;frictionImpulse+=g.tangential*dt;
     peakOverlap=Math.max(peakOverlap,g.penetration);
     w.floorFriction+=g.tangential*n.vx*dt;
     w.floorDamping+=g.closing*n.vy*dt;
   }
   for(const e of rimEdges){
     const a=nodes[e.a],b=nodes[e.b];
     const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1e-12,Math.hypot(dx,dy));
     const ux=dx/d,uy=dy/d;
     const rate=(b.vx-a.vx)*ux+(b.vy-a.vy)*uy;
     const ext=d-e.rest;
     const f=RIM_K*ext+RIM_C*rate;
     fx[e.a]+=f*ux;fy[e.a]+=f*uy;
     fx[e.b]-=f*ux;fy[e.b]-=f*uy;
     w.rimDamping-=RIM_C*rate*rate*dt;
     maxRimStrain=Math.max(maxRimStrain,Math.abs(ext/e.rest));
   }

   qdot+=qForce/MASS_Q*dt;
   q+=qdot*dt;
   hub.vx+=hubFx/MASS_HUB*dt;hub.vy+=hubFy/MASS_HUB*dt;
   hub.omega+=hubTorque/INERTIA_HUB*dt;
   hub.x+=hub.vx*dt;hub.y+=hub.vy*dt;hub.angle+=hub.omega*dt;
   for(let i=0;i<N;i++){
     const n=nodes[i];n.vx+=fx[i]/MASS_NODE*dt;n.vy+=fy[i]/MASS_NODE*dt;
     n.x+=n.vx*dt;n.y+=n.vy*dt;
   }
   if(![q,qdot,hub.x,hub.y,hub.vx,hub.vy,hub.angle,hub.omega,
       ...nodes.flatMap(n=>[n.x,n.y,n.vx,n.vy])].every(Number.isFinite)){
     finite=false;break;
   }
   if(captureFrames&&((step+1)%Math.round(0.1/dt)===0||step===steps-1)){
     const tNext=(step+1)*dt;
     frames.push(snapshot(tNext,hub,nodes,anchorsAt(hub,q,qdot),
       q,qdot,e8Target(tNext,"cycle",1),groundEnabled));
   }
   loop.push({command:e8Target((step+1)*dt,"cycle",1),position:q});
   if((step+1)*dt/E9_PERIOD>=summaries.length+1-1e-9){
     // This is command/response area, not material hysteresis.
     let signed=0;
     for(let j=0;j<loop.length;j++){
       const a=loop[j],b=loop[(j+1)%loop.length];
       signed+=a.command*b.position-b.command*a.position;
     }
     summaries.push({cycle:summaries.length+1,finalQ:round(q),
       positiveDriveWork:round(cyclePositive),negativeDriveWork:round(cycleNegative),
       forceCapSteps:cycleForce,powerCapSteps:cyclePower,
       rmsTrackingError:round(Math.sqrt(cycleTrack/E9_PERIOD)),
       commandResponseLoopArea:round(Math.abs(signed)*0.5)});
     cyclePositive=0;cycleNegative=0;cycleForce=0;cyclePower=0;cycleTrack=0;
     loop=[{command:e8Target((step+1)*dt,"cycle",1),position:q}];
   }
 }
 if(!finite)return {profile,forceLimit,powerLimit,cycles,spokesEnabled,
   numericallyFinite:false,metrics:null,summaries,frames};
 const final=energies(hub,nodes,q,qdot,load,groundEnabled,spokesEnabled);
 const workSum=Object.values(w).reduce((s,v)=>s+v,0);
 const delta=final.total-initial.total;
 const residual=delta-workSum;
 const scale=Math.max(1,Math.abs(initial.total),Math.abs(final.total),
   Object.values(w).reduce((s,v)=>s+Math.abs(v),0));
 const metrics={
   finalQ:round(q),finalQSpeed:round(qdot),hubTravel:round(hub.x),
   finalHubY:round(hub.y),rotationDegrees:round(hub.angle*180/Math.PI),
   rmsTrackingError:round(Math.sqrt(trackingSquared/(E9_PERIOD*cycles))),
   integratedTrackingLag:round(trackingAbsolute),peakTrackingError:round(peakError),
   maxRimStrainProxy:round(maxRimStrain),
   maxSpokeForce:round(peakSpokeForce),
   maximumFloorOverlap:round(peakOverlap),normalImpulse:round(normalImpulse),
   frictionImpulse:round(frictionImpulse),
   forceCapHitCount:forceHits,forceCapHitFraction:round(forceHits/steps),
   powerCapHitCount:powerHits,powerCapHitFraction:round(powerHits/steps),
   peakAppliedDrive:round(peakAppliedDrive),
   peakSampledDrivePower:round(peakSampledDrivePower),
   grossPositiveDriveWork:round(positive),negativeDriveWork:round(negative),
   netDriveWork:round(w.drive),motorWork:round(-torque*0 + 0),
   qDragWork:round(w.qDrag),hubDragWork:round(w.hubDrag),
   rotationDragWork:round(w.rotationDrag),nodeDragWork:round(w.nodeDrag),
   spokeDampingWork:round(w.spokeDamping),rimDampingWork:round(w.rimDamping),
   floorFrictionWork:round(w.floorFriction),floorDampingWork:round(w.floorDamping),
   initialStoredEnergy:round(initial.total),finalStoredEnergy:round(final.total),
   energyDelta:round(delta),energyResidual:round(residual),
   relativeEnergyResidual:round(Math.abs(residual)/scale),
 };
 return {profile,forceLimit,powerLimit,cycles,load,mu,torque,spokesEnabled,
   groundEnabled,numericallyFinite:true,dt,duration:E9_PERIOD*cycles,
   modelVersion:E9_MODEL,metrics,summaries,frames};
}
export function buildE9Receipt({
 cycles=1,load=2,mu=0.35,torque=0.8,recordedAt=new Date().toISOString()
}={}){
 if(!E9_CYCLES.includes(cycles)||!LOAD_OPTIONS.includes(load)||
   !MU_OPTIONS.includes(mu)||!TORQUE_OPTIONS.includes(torque))
   throw new Error("Invalid E9 receipt settings");
 const runs=E9_PROFILES.flatMap(profile=>
   E9_FORCE_LIMITS.flatMap(forceLimit=>E9_POWER_LIMITS.map(powerLimit=>{
     const result=simulateE9({profile,forceLimit,powerLimit,cycles,load,mu,torque});
     return {profile,forceLimit,powerLimit,
       numericallyFinite:result.numericallyFinite,metrics:result.metrics};
   })));
 const controls=[
   {kind:"no-spokes",args:{spokesEnabled:false,profile:"medium",forceLimit:10,powerLimit:2}},
   {kind:"zero-drive-force",args:{profile:"medium",forceLimit:0,powerLimit:2}},
   {kind:"zero-drive-power",args:{profile:"medium",forceLimit:10,powerLimit:0}},
   {kind:"no-ground",args:{groundEnabled:false,profile:"medium",forceLimit:10,powerLimit:2}},
   {kind:"no-friction",args:{mu:0,profile:"medium",forceLimit:10,powerLimit:2}},
 ].map(a=>{
   const r=simulateE9({cycles,load,mu,torque,...a.args});
   return {kind:a.kind,numericallyFinite:r.numericallyFinite,
     driveWork:r.metrics?.netDriveWork??null,finalQ:r.metrics?.finalQ??null,
     groundImpulse:r.metrics?.normalImpulse??null,
     frictionImpulse:r.metrics?.frictionImpulse??null,
     hubTravel:r.metrics?.hubTravel??null};
 });
 const coarse=simulateE9({cycles:1,load,mu,torque,profile:"medium",
   forceLimit:10,powerLimit:2,dt:0.005});
 const fine=simulateE9({cycles:1,load,mu,torque,profile:"medium",
   forceLimit:10,powerLimit:2,dt:0.0025});
 return {
   schema:"phi-morph.e9.receipt.v1",origin:"SIMULATED",physicalValidation:"NONE",
   protocol:E9_PROTOCOL,modelVersion:E9_MODEL,recordedAt,units:"normalized_dimensionless",
   frozen:{
     sourceModels:["PM-E7-0.8.0","PM-E8-0.9.0"],
     wheelNodes:N,edgeCount:N,actuatorCoordinateCount:1,actuatorMass:MASS_Q,
     controller:"E8 force-then-sampled-mechanical-power-limited PD",
     reaction:"wheel spoke force work-conjugate reaction back onto q",
     profiles:[...E9_PROFILES],forceLimits:[...E9_FORCE_LIMITS],
     powerLimits:[...E9_POWER_LIMITS],cycles,load,mu,torque,
     dt:E9_DT,caseCount:runs.length,negativeControlCount:controls.length,
   },
   runs,negativeControls:controls,
   numericalDiagnostic:{coarseDt:0.005,fineDt:0.0025,
     finalQDelta:coarse.metrics&&fine.metrics?
       round(Math.abs(coarse.metrics.finalQ-fine.metrics.finalQ)):null,
     travelDelta:coarse.metrics&&fine.metrics?
       round(Math.abs(coarse.metrics.hubTravel-fine.metrics.hubTravel)):null,
     residualDelta:coarse.metrics&&fine.metrics?
       round(Math.abs(coarse.metrics.relativeEnergyResidual-
         fine.metrics.relativeEnergyResidual)):null,
   },
   caveats:[
     "Coupling is one shared normalized actuator coordinate; not 24 real individual servos.",
     "The wheel feeds elastic and damping reaction to q; command targets are not kinematically imposed on the rim.",
     "Sampled mechanical power cap does not bound electrical power or within-step peaks.",
     "Normal/friction point contact is an uncalibrated numerical penalty model.",
     "A shared q can be backdriven by the wheel without active input; zero input does not imply zero q motion.",
     "Different controller profiles are synthetic assumptions; no measured actuator bandwidth.",
     "Command-response loop area is dynamic lag, not intrinsic material hysteresis.",
     "The solver has no real actuator efficiency, water, fluid, tire material or physical validation.",
   ],
 };
}
export function e9Csv(receipt){
 const rows=[["protocol","profile","forceCap","powerCap","cycles",
   "finalQ","hubTravel","rmsTrackingError","positiveDriveWork",
   "forceCapFraction","powerCapFraction","maxSpokeForce",
   "relativeEnergyResidual","numericallyFinite"]];
 for(const r of receipt.runs){
   const m=r.metrics;
   rows.push([receipt.protocol,r.profile,r.forceLimit,
     r.powerLimit??"unbounded",receipt.frozen.cycles,
     m?.finalQ??"",m?.hubTravel??"",m?.rmsTrackingError??"",
     m?.grossPositiveDriveWork??"",m?.forceCapHitFraction??"",
     m?.powerCapHitFraction??"",m?.maxSpokeForce??"",
     m?.relativeEnergyResidual??"",r.numericallyFinite]);
 }
 return rows.map(row=>row.map(value=>
   '"'+String(value).replace(/"/g,'""')+'"').join(",")).join("\n")+"\n";
}
