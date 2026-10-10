# Phi-Morph E7 · PM-E7-0.8.0: bounded axial servos and repeated-cycle audit

## Purpose

E6 used a morphing 24-point rim with moving anchor targets and unbounded spring forces. E7 investigates what changes if an actuator has a force limit, the morph command has limited stroke, or the command is repeated three times. This is a DIFFERENT frozen numerical model from E6, so cross-protocol metrics must not be treated as identical-system performance results.

## Controlled starting conditions

All study cases start from the **same round geometry**, the same round rim spring rest lengths, zero velocities and the same initial numerical ground clearance. This removes E6's different-starting-square baseline confounder.

- Hub mass 6; planar inertia 13; 24 nodes each mass 0.25.
- Rim edges 24, linear spring stiffness 11 and axial damping 0.14.
- Spoke-like active axial servo stiffness 21 and axial relative-velocity damping 0.45.
- Node drag 0.035; hub drag 0.025; angular drag 0.025.
- Numerical floor radius 0.17; penalty stiffness 90; closing damping 2.6.
- Friction coefficient 0, 0.35 or 0.8: Ft = -mu * Fn * tanh(v_node_x/0.2).
- External hub load 1, 2, 4. Clockwise motor torque 0, 0.8.
- dt 0.005; 8 time units per morphing cycle.

All these values are dimensionless and have no measured material correspondence.

## Force saturation and torque consistency

For each node and movable body-mounted target anchor:

    direction = (anchor - node) / ||anchor - node||
    raw = 21 * separation + 0.45 * relative_axial_velocity
    applied = clamp(raw, -cap, cap)
    force_on_node = applied * direction
    force_on_hub = -force_on_node
    torque_on_hub = -cross(anchor_offset, force_on_node)

Zero separation gives zero force, avoiding an undefined axial direction.

Available force caps are 0, 4, 10, and uncapped (JSON null). The cap constrains the FULL applied spring-damper force magnitude.

The force acts along the node–anchor line and has zero internal torque couple when paired with the hub reaction; this is a cleaner mechanical idealization than applying a noncollinear force between separated points. It is still NOT a realizable actuator design.

## Stroke, repetition and controls

Every command starts round. Its target goes round → square → round on a smooth eight-unit schedule. Stroke multipliers 0, 0.5, 1 mean none, half, and full of the prescribed normalized geometric change. They are not actual actuator stroke measurements.

A one-cycle run lasts 8 units. A three-cycle run lasts 24 units without ever resetting motion, deformation, or hub state between cycles.

The study crosses 4 force caps, 3 stroke fractions and 2 cycle lengths, giving **24 runs** per receipt at fixed load, friction and torque.

Negative controls:
- No ground: normal and friction impulses zero.
- No friction: friction impulse zero.
- Zero servo force: cap zero, applied-force mechanical work zero.
- No command: target positions remain round, command-boundary work zero, although servos may still do nonzero work resisting body dynamics.

One nominated case is checked at dt 0.005 and dt 0.0025. It is NOT a proof of convergence.

## Explicit active-servo work ledger

Unlike E6's implicit conservative spoke spring, the force-limited E7 servo is an external **active bounded force**, with no assumed spoke spring energy reservoir. Stored modeled energy comprises kinetic energy of hub and nodes, gravitational/load potential, conservative rim-spring potential and numerical ground-penalty potential.

The servo applies force F to a rim node and -F to the rigid hub, at its anchor location. Its total mechanical work rate on the modeled bodies is:

    P_servo = F dot (v_node - v_rigid_anchor)

This can be split into:

    P_command = F dot v_commanded_anchor
    P_tracking = F dot (v_node - v_actual_anchor)
    P_servo = P_command + P_tracking

Where the commanded-anchor velocity is the programmed motion in the rotating frame; rigid-anchor velocity includes hub translation and rotation.

Gross positive servo work is accumulated from positive P_servo, and negative servo work from negative P_servo, **separately**. Net work is their sum. None of these constitutes electrical energy consumption, battery efficiency or real regeneration.

Other ledger terms: external motor work, hub/node/rotational drag work, rim damping, floor friction, closing-speed damping. The residual measures energy difference minus explicitly recorded work. A small residual does NOT establish physical predictive accuracy.

## Structural indicators and forbidden claims

Record per-cycle travel change, gross positive/negative servo work, force-cap hits, maximum rim spring strain, RMS tracking error and contact metrics. Rim strain is relative change in neighboring-point spring length.

A strain value over 0.5 gets a flag for human scrutiny. This is an **arbitrary analysis marker**, not yield, permanent damage, fatigue, fracture or allowable safety load.

No fatigue law, material plasticity, buckling, endurance curve, heat, motor thermal response, pressure vessel, hydrostatics, water charge, leakage, membrane, tire carcass, electrical limits or tested friction model exists. A multi-cycle run DOES NOT predict a real component's service life.

The receipt is versioned with origin SIMULATED and physicalValidation NONE; CSV contains 24 case rows.

## E8 validation gates

Study timestep/resolution convergence and momentum/energy budgets, separately characterize actuator force-displacement curves, power and bandwidth limits, thermal behavior, hysteresis and return-work efficiency, and benchmark geometry/contact models against independently measured data. Claims about real machine performance require external measurements, not colorful graphs.

**Ledger above ego. Model before claim.**
