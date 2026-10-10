/**
 * Φ-Morph E4: rigid-outline, discrete-node ground-contact / rolling toy model.
 * NO compliant shell, fluid, verified contact law, physical tire, or braking.
 * Every node is rigidly attached to the translating/rotating hub; visible
 * segments are illustrative, not continuous collision edges.
 */
export const E4_PROTOCOL = "PM-E4-0.5.0";
export const E4_MODEL = "morphwheel-rigid-discrete-contact-0.5.0";
export const E4_SHAPES = Object.freeze(["circle", "rounded-square"]);
export const E4_FRICTIONS = Object.freeze([0, 0.35, 0.8]);
export const E4_TORQUES = Object.freeze([0, 0.8, 1.6]);
export const E4_LOADS = Object.freeze([0.5, 1, 2, 4]);
export const E4_NODE_COUNT = 24;
export const E4_RADIUS = 0.17;
export const E4_RMS_RADIUS = 2.65;
export const E4_DT = 0.005;
export const E4_DURATION = 6;
export const E4_FLOOR_K = 90;
export const E4_FLOOR_DAMPING = 2.6;
const BODY_MASS = 6;
const MOMENT_OF_INERTIA = 13;
const TRANSLATION_DAMPING = 0.03;
const ROTATION_DAMPING = 0.025;
const FRICTION_SPEED_SCALE = 0.2;
const SAMPLE_EVERY = 24;
const round = (n) => Math.round(n * 1e6) / 1e6;
const signPow = (x, exp) => Math.sign(x) * Math.pow(Math.abs(x), exp);

export function e4Outline(shape = "circle") {
  if (!E4_SHAPES.includes(shape)) throw new Error("Unsupported E4 shape");
  const exponent = shape === "circle" ? 1 : 0.5;
  const unscaled = Array.from({ length: E4_NODE_COUNT }, (_, i) => {
    const angle = i * 2 * Math.PI / E4_NODE_COUNT;
    return {
      id: i,
      x: signPow(Math.cos(angle), exponent),
      y: signPow(Math.sin(angle), exponent),
    };
  });
  const rms = Math.sqrt(unscaled.reduce((s, p) => s + p.x*p.x + p.y*p.y, 0) / E4_NODE_COUNT);
  const scale = E4_RMS_RADIUS / rms;
  return unscaled.map(p => ({ id: p.id, x: p.x * scale, y: p.y * scale }));
}

export function e4ContactForce(penetration, velocityX, velocityY, mu, contactEnabled = true) {
  if (![penetration,velocityX,velocityY,mu].every(Number.isFinite)
      || mu < 0 || mu > 1) throw new Error("Invalid E4 contact input");
  if (typeof contactEnabled !== "boolean") throw new Error("Invalid contact flag");
  if (!contactEnabled || penetration <= 0) return { normal: 0, tangential: 0 };
  const normal = Math.max(0, E4_FLOOR_K * penetration +
    E4_FLOOR_DAMPING * Math.max(0, -velocityY));
  // Velocity-regularized friction, |Ft| <= μFn. Not true static friction.
  const tangential = -mu * normal * Math.tanh(velocityX / FRICTION_SPEED_SCALE);
  return { normal, tangential };
}

function pose(hub, outline) {
  const c = Math.cos(hub.angle);
  const s = Math.sin(hub.angle);
  return outline.map((p) => {
    const rx = p.x*c - p.y*s;
    const ry = p.x*s + p.y*c;
    return { id: p.id, rx, ry, x: hub.x + rx, y: hub.y + ry };
  });
}

function frame(step, dt, hub, nodes, contacts) {
  return {
    time: round(step * dt),
    hub: { x: round(hub.x), y: round(hub.y), angle: round(hub.angle),
      omega: round(hub.omega) },
    nodes: nodes.map((p) => ({
      id: p.id, x: round(p.x), y: round(p.y),
      contact: contacts.includes(p.id),
    })),
  };
}

/**
 * Positive command torque is clockwise, resulting in expected positive
 * translation when friction transfers impulse from moving tread to hub.
 * Measurements are normalized solver proxies only.
 */
export function simulateE4({
  shape = "circle", mu = 0.35, torque = 0.8, load = 2,
  contactEnabled = true, dt = E4_DT, duration = E4_DURATION,
  captureFrames = false,
} = {}) {
  if (!E4_SHAPES.includes(shape)) throw new Error("Unsupported shape");
  if (![mu, torque, load, dt, duration].every(Number.isFinite) ||
      mu < 0 || mu > 1 || torque < 0 || torque > 2.5 ||
      load < 0 || load > 5 || dt <= 0 || dt > 0.01 ||
      duration <= 0 || duration > 8) throw new Error("Invalid E4 simulation settings");
  if (typeof contactEnabled !== "boolean") throw new Error("Invalid contact setting");
  const steps = Math.round(duration / dt);
  if (Math.abs(steps * dt - duration) > 1e-9) throw new Error("Time steps must divide duration");
  const outline = e4Outline(shape);
  const minY = Math.min(...outline.map(p => p.y));
  const hub = { x: 0, y: E4_RADIUS + 0.03 - minY,
    vx: 0, vy: 0, angle: 0, omega: 0 };
  const initialY = hub.y;
  const frames = captureFrames ? [frame(0, dt, hub, pose(hub, outline), [])] : undefined;
  let maxPenetration = 0;
  let peakNormal = 0;
  let normalImpulse = 0;
  let tangentialImpulse = 0;
  let frictionDissipation = 0;
  let motorWork = 0;
  let contactStepCount = 0;
  let contactNodeSamples = 0;
  let sumContactSlip = 0;
  let maxRotationalSpeed = 0;
  let finite = true;

  for (let step = 0; step < steps; step++) {
    const nodes = pose(hub, outline);
    let fx = -TRANSLATION_DAMPING * hub.vx;
    let fy = -load - TRANSLATION_DAMPING * hub.vy;
    const driveTorque = -torque;
    let tau = driveTorque - ROTATION_DAMPING * hub.omega;
    let normalThisStep = 0;
    const touching = [];
    for (const n of nodes) {
      const penetration = E4_RADIUS - n.y;
      // Rigid-body contact-point velocity, including tangential rotation.
      const vx = hub.vx - hub.omega * n.ry;
      const vy = hub.vy + hub.omega * n.rx;
      const contact = e4ContactForce(penetration, vx, vy, mu, contactEnabled);
      if (contact.normal === 0) continue;
      touching.push(n.id);
      normalThisStep += contact.normal;
      fx += contact.tangential;
      fy += contact.normal;
      tau += n.rx * contact.normal - n.ry * contact.tangential;
      maxPenetration = Math.max(maxPenetration, penetration);
      tangentialImpulse += contact.tangential * dt;
      frictionDissipation += -contact.tangential * vx * dt;
      sumContactSlip += Math.abs(vx);
      contactNodeSamples++;
    }
    if (touching.length) contactStepCount++;
    peakNormal = Math.max(peakNormal, normalThisStep);
    normalImpulse += normalThisStep * dt;
    motorWork += driveTorque * hub.omega * dt;

    hub.vx += fx / BODY_MASS * dt;
    hub.vy += fy / BODY_MASS * dt;
    hub.omega += tau / MOMENT_OF_INERTIA * dt;
    hub.x += hub.vx * dt;
    hub.y += hub.vy * dt;
    hub.angle += hub.omega * dt;
    maxRotationalSpeed = Math.max(maxRotationalSpeed, Math.abs(hub.omega));
    if (![hub.x,hub.y,hub.vx,hub.vy,hub.angle,hub.omega].every(Number.isFinite)) {
      finite = false;
      break;
    }
    if (captureFrames && ((step+1) % SAMPLE_EVERY === 0 || step === steps-1)) {
      const next = pose(hub, outline);
      const ids = contactEnabled ? next.filter(n => n.y < E4_RADIUS).map(n => n.id) : [];
      frames.push(frame(step+1,dt,hub,next,ids));
    }
  }
  const finalNodes = finite ? pose(hub, outline) : [];
  const finalContacts = contactEnabled ? finalNodes.filter(n => n.y < E4_RADIUS) : [];
  return {
    shape, mu, torque, load, contactEnabled,
    numericallyFinite: finite, dt, duration, steps,
    modelVersion: E4_MODEL,
    metrics: finite ? {
      horizontalTravel: round(hub.x),
      finalHubHeight: round(hub.y),
      hubDrop: round(initialY - hub.y),
      finalAngleDegrees: round(hub.angle * 180/Math.PI),
      finalAngularVelocity: round(hub.omega),
      peakAngularSpeed: round(maxRotationalSpeed),
      contactTimeFraction: round(contactStepCount / steps),
      finalContactNodes: finalContacts.length,
      peakNumericalPenetration: round(maxPenetration),
      peakNormalReaction: round(peakNormal),
      normalImpulseProxy: round(normalImpulse),
      signedFrictionImpulseProxy: round(tangentialImpulse),
      meanAbsoluteContactSlipProxy: contactNodeSamples ?
        round(sumContactSlip / contactNodeSamples) : 0,
      frictionDissipationProxy: round(frictionDissipation),
      signedMotorWorkProxy: round(motorWork),
      finalKineticEnergyProxy: round(
        0.5 * BODY_MASS * (hub.vx*hub.vx + hub.vy*hub.vy) +
        0.5 * MOMENT_OF_INERTIA * hub.omega*hub.omega),
    } : null,
    frames,
  };
}

export function buildE4Receipt(load = 2, at = new Date().toISOString()) {
  if (!E4_LOADS.includes(load)) throw new Error("E4 receipt load outside frozen protocol");
  const cases = E4_SHAPES.flatMap(shape =>
    E4_FRICTIONS.flatMap(mu =>
      E4_TORQUES.map(torque => {
        const s = simulateE4({ shape, mu, torque, load });
        return {
          shape, mu, torque, load,
          numericallyFinite: s.numericallyFinite,
          metrics: s.metrics,
        };
      })
    )
  );
  const noGroundControls = E4_SHAPES.map(shape => {
    const s = simulateE4({ shape, mu: 0.8, torque: 1.6, load, contactEnabled: false });
    return {
      shape, normalImpulseProxy: s.metrics?.normalImpulseProxy ?? null,
      signedFrictionImpulseProxy: s.metrics?.signedFrictionImpulseProxy ?? null,
      horizontalTravel: s.metrics?.horizontalTravel ?? null,
      numericallyFinite: s.numericallyFinite,
    };
  });
  return {
    schema: "phi-morph.e4.receipt.v1",
    origin: "SIMULATED",
    physicalValidation: "NONE",
    protocol: E4_PROTOCOL,
    modelVersion: E4_MODEL,
    recordedAt: at,
    units: "normalized_dimensionless",
    design: {
      shapePresets: [...E4_SHAPES],
      nodesPerOutline: E4_NODE_COUNT,
      normalizedRmsRadius: E4_RMS_RADIUS,
      nodeContactRadius: E4_RADIUS,
      horizontalAndVerticalHubMotion: true,
      singleHubAngularDegreeOfFreedom: true,
      rigidNodePlacement: true,
      numericalFloorStiffness: E4_FLOOR_K,
      numericalFloorClosingDamping: E4_FLOOR_DAMPING,
      regularizedFriction: "Ft=-mu*Fn*tanh(v_contact_x/0.2)",
      appliedTorqueConvention: "clockwise_positive_command",
      dt: E4_DT,
      duration: E4_DURATION,
      mass: BODY_MASS,
      planarInertia: MOMENT_OF_INERTIA,
      load,
      coefficients: [...E4_FRICTIONS],
      torqueCommands: [...E4_TORQUES],
      caseCount: cases.length,
      noGroundControlCount: noGroundControls.length,
    },
    cases,
    noGroundControls,
    caveats: [
      "Discrete 24-point rigid outlines. Visible lines do not collide with the floor.",
      "Rounded-square is a static shape preset, not an electrically morphing tire.",
      "Zero-friction control must transfer no horizontal contact impulse.",
      "Velocity-smoothed tangential friction omits true static stick and realistic tires.",
      "Motor and friction work proxies omit deformation/shape-change actuation costs.",
      "No tire material, water, pressure, road testing, SI units or physical validation.",
      "Numerical timestep and point resolution require sensitivity studies before interpretation.",
    ]
  };
}

export function e4Csv(receipt) {
  const rows = [[
    "protocol","shape","mu","torque","load","horizontalTravel",
    "hubDrop","peakPenetration","normalImpulse","frictionImpulse",
    "frictionDissipation","motorWork","contactTimeFraction","numericallyFinite",
  ]];
  for (const row of receipt.cases) {
    const m = row.metrics;
    rows.push([
      receipt.protocol,row.shape,row.mu,row.torque,row.load,
      m?.horizontalTravel ?? "",m?.hubDrop ?? "",
      m?.peakNumericalPenetration ?? "",m?.normalImpulseProxy ?? "",
      m?.signedFrictionImpulseProxy ?? "",m?.frictionDissipationProxy ?? "",
      m?.signedMotorWorkProxy ?? "",m?.contactTimeFraction ?? "",row.numericallyFinite,
    ]);
  }
  return rows.map(row => row.map(value =>
    '"' + String(value).replace(/"/g, '""') + '"').join(",")).join("\n") + "\n";
}
