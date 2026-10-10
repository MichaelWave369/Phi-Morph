# Φ-Morph E9 / PM-E9-1.0.0: coupled actuator-coordinate MorphWheel

## Research objective

E7 added capped force and repeated rim morphing but imposed moving target
anchors by a prescribed time schedule. E8 characterized a **separate**
one-degree-of-freedom controller whose position lagged the shape command
under mechanical force/power caps. E9 couples these two ideas so that
the wheel's spring reaction enters the controller's equation of motion.

The purpose is testing **back-reaction and explicit drive work**, not
claiming a feasible programmable tire. No real-world actuator, fluid,
pressure vessel, experimental observation or motor calibration is present.

## Frozen topology and initial conditions

All E9 runs start with:
- 24 normalized round-profile rim nodes, each mass 0.25.
- A hub with planar x/y translation and orientation theta, mass 6 and
  inertia 13; starts from numerical ground clearance 0.03.
- 24 neighboring rim springs, stiffness 11, damping 0.14.
- 24 hub-attached spoke springs, stiffness 21, axial damping 0.45.
- Hub/node/rotational linear drag: 0.025 / 0.035 / 0.025.
- Discrete spherical ground contact nodes radius 0.17 against flat y=0.
  Penalty normal stiffness 90 and closing-speed damping 2.6.
- Tangential contact friction: Ft = -mu Fn tanh(vx/0.2).
- One shared actuator q of normalized mass 1, load spring coefficient 2,
  drag coefficient 0.7.
- External vertical hub load 1, 2, 4; clockwise drive torque 0, 0.8.
- Default semi-implicit Euler dt=0.005 and 8 time units per cycle.
- Every experiment begins with q=0, qdot=0 and all zero hub/rim velocities.

The shape interpolation is local coordinate

    anchor_i_local(q) = round_i + q * (square_i - round_i)

and is rotated/transferred into the hub frame. The rim nodes are NOT
set equal to these anchors; they move under spring forces.

## Why the connection is mechanically meaningful

The body-fixed spoke target has two velocity contributions:
(1) rigid-body translation and rotation, (2) movement from qdot times
the rotated local round-to-square delta for that node.

Each spoke experiences an **axial** spring/damper force on its rim node
toward the current anchor. Equal-and-opposite force and moment are
applied to the hub. Reaction to the actuator coordinate is

    F_q,reaction = -sum_i (F_spoke,i dot R(theta) * delta_i)

This is the negative derivative of the spoke potential with respect to
q, with corresponding damping. The actuator is **not** allowed to move
the target for free: increasing q stores spoke strain energy and rim
forces can slow or backdrive q. The axial spoke force also avoids an
artificial internal couple from noncollinear force application.

The commanded q_target(t) follows the earlier smooth round → square →
round cycle. The controller applies

    F_raw = kp * (q_target - q) - kd * qdot

with E8's synthetic slow, medium and fast gain profiles. The force is
first capped at 0, 4 or 10, then subject to power capping using
absolute instantaneous sampled Fdrive*qdot <= 0, 2, or unbounded.
The q velocity and position evolve from actual net forces.

At rest, an ideal force can be nonzero while sampled mechanical power
is zero. The power cap is not a guarantee on within-step peak, hardware
electrical consumption or battery energy. No physical stroke stop,
force/speed curves, latency or electromechanical efficiency is present.

## Energy accounting

Conservative model energy:
- Rigid hub and node translational/rotational kinetic energy.
- q mass kinetic energy.
- External hub load potential and q load spring energy.
- Rim and spoke elastic spring energies.
- Ground penalty-spring energy.

External work:
- Force-limited motor applied to q: Fdrive*qdot*dt.
- Hub drive torque: -torque*omega*dt.
- Drag losses of q, hub, nodes and rotation.
- Axial spoke/rim damping losses.
- Floor friction and closing-speed damping losses.

The moving spoke anchors are powered by the generalized q controller.
Their apparent motion is internal to the coupled model; **do not count
separate commanded-anchor work as external energy in addition to Fdrive
times qdot**.

Each receipt reports initial/final system energy, model work, signed
net actuator work, gross positive and negative portions, and the
numerical energy-balance residual. Nonzero residual exposes finite-step
integration and quadrature discrepancy; a small value is not material
or tire-validation evidence.

## Controlled study

At a chosen cycle count (1 or 2), load, friction and hub drive torque:

- 3 controller profiles × 3 force caps × 3 power caps = **27 cases**.
- No-spokes control removes the mechanical coupling; q must then
  numerically reproduce E8's standalone actuator for matched inputs.
- Zero-force drive still allows potential backdrive from a loaded wheel.
  It must not inject direct controller work.
- Zero-sampled-mechanical-power drive has zero sampled drive work.
- No-ground and no-friction controls respectively remove normal/friction
  impulses and horizontal friction impulse.
- One timestep-halving diagnostic at 0.005 and 0.0025 for a nominated
  coupled case. Not a convergence guarantee.

The workbench shows moving rim nodes, target anchors, contact markers,
command-versus-achieved q, and a 27-case study table. Every research
receipt is versioned as origin SIMULATED, physicalValidation NONE, with
CSV/JSON exports.

## Limitations and E10 gate

This is a synthetic 2D point-spring rig with a *single shared q*
coordinate rather than 24 independent actuators. No membrane, fluid,
charged water, electroactive polymer, piezoelectric stack, brake,
real tire carcass, thermal budget, vehicle dynamics, manufacturing
constraints, physical safety margin or measured material stiffness
is modeled.

Numerical friction is not a validated contact constitutive law.
Controller gains are assumed, not measured motor bandwidth. Mechanical
positive work is NOT electrical input power. Command-response loop
area is dynamic lag and NOT material hysteresis. A force-capped model
does not establish an engineered motor's load capability.

Next: calibration-friendly external benchmark fixtures, a true
independent unit/energy audit, controller power/thermal bounds in
measured SI quantities, convergence over both dt and discretization,
and a more physically specified actuator architecture. Hardware data
must be marked OBSERVED and independently checked before extrapolating
to practical use.

**Ledger above ego. Model before claim.**
