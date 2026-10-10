# Φ-Morph PM-E5-0.6.0: numerical convergence and energy-ledger audit

## Why this experiment exists

E4 introduced rigid-body wheel outlines with a flat-ground penalty-contact solver and velocity-regularized friction. Those simulations were conducted at **only 24 contact nodes and one timestep**. Before proposing physical shape-changing efficiency or even trusting the numeric rankings, E5 asks how results change as the numerical discretization changes, and whether work and energy bookkeeping has unexplained residuals.

E5 is a **new versioned model**. E4 remains frozen. Neither E4 nor E5 is a validated tire contact simulator, physical vehicle model, programmable water material, or actual powered shape-changing mechanism.

## Frozen factorial study

- Wheel outline: fixed circle or fixed rounded square. There is no shape change during a run.
- Rim sampling: 24, 48 or 96 evenly parameterized **discrete contact nodes**. The visible perimeter is not a continuous contact surface.
- Timestep: 0.01, 0.005 or 0.0025 model-time units.
- Duration: 4 model-time units at every resolution.
- 2 × 3 × 3 = **18 numeric cases per study**.
- Shared chosen friction coefficient 0, 0.35 or 0.8.
- Shared chosen clockwise motor torque 0, 0.8 or 1.6.
- Shared chosen downward load 0.5, 1, 2 or 4.
- Four negative controls: one friction-off and one floor-off per outline, at 24 nodes, dt 0.005, and identical chosen torque and load. Floor-off removes normal and friction force entirely.

The original E4's 24-point initial coordinates are imported exactly. The E5 24-point 0.005-timestep model must reproduce E4 horizontal travel, orientation and normal impulse for a matching duration, within six-decimal reporting tolerance.

## Contact and integration

E5 uses a separate reimplementation of E4's simplified rigid-body force law. It has planar horizontal/vertical hub translations and a rotation angle, mass 6, planar inertia 13, downward force equal to selected load, and commanded clockwise torque. Two rigid outline presets are centered and normalized to RMS radius 2.65.

Contact node radius 0.17, floor at zero, normal force is compression-only numerical penalty stiffness plus closing-speed damping. Contact tangential reaction is proportional to normal force with velocity smoothing:

    F_t = - mu * F_n * tanh(v_contact_x / 0.2).

No contact means no tangential force, and zero mu means exactly zero tangential force.

E5 uses a **heuristic node penalty scaling of 24 / N**. Thus 48 nodes have one-half the 24-node per-point penalty and 96 nodes have one-quarter. This attempts to avoid multiplying ground stiffness simply by adding contact points, but it is NOT a derived continuum discretization or a validated material constitutive law. Different sampling still changes point locations, gaps and contact count. Results need not converge.

Symplectic/semi-implicit Euler integration updates velocities before positions. No adaptive step control or calibrated collision solver is present.

## Energy and work accounting

The initial and final reported model energy E is the sum of:

- rigid-body translational and rotational kinetic energy;
- the external downward-load potential term, load × hub height;
- the elastic penalty-contact potential energy from overlapping node spheres, sum 0.5 × k_i × penetration_i².

All work values use **start-of-step velocity quadrature**:

- motor work: commanded torque × angular velocity × dt;
- translational linear drag work: -drag × (vx² + vy²) × dt;
- angular viscous drag work: -angularDrag × omega² × dt;
- friction work: sum of F_t × contact-point tangential velocity × dt;
- closing-speed damping work: sum of F_damp × contact-point vertical velocity × dt.

Each reported friction work and normal-damping work must be nonpositive to numerical precision given the defined friction law. The residual is:

    balanceResidual = (finalEnergy - initialEnergy) - sum(recordedWork)

The relative residual is absolute residual divided by the maximum of 1, absolute initial or final energy, and sum of absolute work components. A small residual in this bookkeeping is **not** physical validation; start-of-step quadrature and the solver itself introduce errors. Residuals can be negative or positive.

No external horizontal work, finite-element strain energy, heating or material actuation energy exists in this rigid-body model.

## Numeric sensitivity outputs

The UI displays a 2×3×3 matrix of selected outputs (horizontal travel, relative energy residual, peak numerical overlap, signed friction impulse), with click-to-inspect case energy ledgers.

For each shape and point count, the receipt also reports:

- |travel(dt=0.01) - travel(dt=0.005)|;
- |travel(dt=0.005) - travel(dt=0.0025)|.

These are *two observed differences*, not a Richardson extrapolation, formal convergence rate or engineering acceptance gate. A small travel discrepancy says nothing about convergence of untested quantities such as peak force, residual, or time-resolved impact conditions.

## Provenance, integrity and limitations

Outputs must be deterministic at the same inputs and record timestamp, and exportable as a SIMULATED JSON receipt containing model/protocol version, source-reference model, all 18 cases, four controls and caveats. CSV includes 18 case rows.

Test that:

1. All 2×3 point sets are centered and RMS-normalized.
2. The 24-point dt 0.005 case reproduces E4's frozen result for matching physical settings and duration.
3. All 18 model integrations return finite outputs, and dissipative contact/friction work is nonpositive.
4. The 4 negative controls transfer no horizontal impulse or travel when friction or ground is removed.
5. The computed residual agrees with reported energy and work components to rounding tolerance.
6. Sampled frames and receipts are deterministic.
7. Invalid resolutions, timesteps, contact flags, loads, frictions and torques fail closed.

**There is still no physical tire, continuum rubber model, elastic shell deformation, real fluid, electrorheology, frequency-induced solidification, traction calibration, road surface, braking analysis, or shape-changing actuator.** All numerical values are dimensionless.

## Next E6 gate

Only once sensitivity and residuals are reviewed should the project build a **force-consistent deformable outline** in which node geometry changes against springs under explicitly applied actuator forces. Compute actuator work and compare identical initial/final conditions, with no cost-free shape transforms. This would still be a modeled design hypothesis until benchmarked against validated constitutive/contact data.

**Ledger above ego. Model before claim.**
