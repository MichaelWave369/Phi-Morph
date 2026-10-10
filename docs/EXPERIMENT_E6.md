# Φ-Morph PM-E6-0.7.0: moving-anchor deformable wheel experiment

## Objective

E4/E5 compare **fixed, rigid** sampled outlines. E6 is the first separate study where rim mass points actually move in response to prescribed spring-anchor motion. This is a **2D dimensionless point-mass/spring/contact model**, not a physical tire design. Earlier E0–E5 models are preserved unchanged.

Question: When a virtual rim is forced to transition from a round starting geometry toward rounded-square and back, how do model motion, contact reaction, and explicit actuator-work quantities change relative to stationary geometry commands?

## Nodes, anchors, hub, springs

- 24 rim mass points, each mass=0.25 in normalized units. A hub can translate x/y and rotate, mass=6 and planar inertia=13.
- Every rim mass is linked to its adjacent neighbors by ordinary linear springs (24 rim edges, stiffness=11) and axial viscous damping (0.14).
- Each node is also pulled toward a body-mounted **commandable anchor target** by a Cartesian spring (stiffness=21) and dashpot (0.45).
- All node spring forces produce equal and opposite force on the hub. Each anchor's reaction also generates hub moment: negative cross(anchor offset, node force).
- Rim springs exert exactly opposing pairwise forces on linked mass points, not on the hub.
- The hub receives an external downward force (one of 1, 2 or 4), external clockwise motor torque (0 or 0.8), linear drag 0.025 and rotational drag 0.025. Each rim node gets linear drag 0.035.
- Contact uses discrete circular nodes with numerical radius 0.17 against y=0, compression-only floor penalty stiffness 90 and closing damping 2.6. Tangential ground force is negative mu × normal × tanh(contact velocity / 0.2). mu is 0, 0.35 or 0.8, so force never exceeds mu × normal.

The moving anchor point is hub center plus R(theta) × a_i(t), where a_i is the prescribed local spoke endpoint. The target's velocity includes hub velocity, hub rotation and the **explicit local-command velocity** R(theta) × a'_i(t). The dashpot uses the node-minus-target relative velocity.

This produces an unbalanced reaction on the hub only through explicitly modeled paired forces and torques. It is not an independently pressure-regulated chamber, electrorheological suspension, water actuator, or finite-element membrane.

## Programmed transformation

The geometry targets are from E4's centered, equal-RMS-size round and rounded-square outlines. E6 linearly interpolates anchor offsets during transitions. The *nodes themselves* respond dynamically rather than teleporting to that interpolation.

- 0–1: round;
- 1–3: smoothly command square, cubic smoothstep;
- 3–4: hold target square;
- 4–6: smoothly command round;
- 6–8: hold target round.

Fixed-round and fixed-square controls hold their geometry constant throughout. The fixed-square case initializes with that square outline and its own unstressed adjacent-spring rest lengths. The cyclic case initializes round with round rest lengths. This is an important **different-initial-geometry confounder**: a fixed-square score cannot legitimately be interpreted as a fair performance ranking against the cyclic round-start wheel.

Initial rim points coincide with their anchors and start above the floor with clearance 0.03. The hub and nodes initially have zero velocity.

## Actuator-work ledger

The spring force on node i is F_i = k (anchor_i - node_i) + c (velocityAnchor_i - velocityNode_i).

When the user-programmed anchor position changes in the rotating hub frame, the control introduces power:

    P_actuator(t) = sum_i F_i · [R(theta) da_i/dt]

The model integrates start-of-step power × dt and reports three related quantities:

- **Net actuator work**: signed total across the experiment.
- **Gross positive actuator work**: integral of max(0, individual-node instantaneous power) over time. Input-energy proxy, *not electrical consumption*.
- **Negative actuator work**: integral of min(0, individual-node instantaneous power). Energy returned to the controller's mechanical boundary in the model, not proof of recoverable electrical power.

Positive and negative components sum to signed net actuator work (subject to export rounding). There is no assumed battery, pump, capacitor, motor efficiency, recuperation mechanism, or power electronics model.

A fixed command has da/dt=0 and hence zero programmed-anchor work; the model may still have nonzero motor work and damping losses.

The total model energy contains hub and node kinetic energy, external load potential (load × hub height), spoke spring energy, rim spring energy and contact penalty-spring energy. The simulated ledger records external motor work, anchor work and negative dissipative contributions from node/hub drag, rotational drag, dashpots, floor friction and floor closing damping.

The residual is total-energy change minus summed work. Nonzero residual exposes numerical integration and first-order work quadrature errors; small residual does not validate the physical model.

## Study design and provenance

At one selected load, E6 runs 3 shape policies (fixed round, fixed rounded-square, cyclic shape change) × 3 friction coefficients × 2 motor torques = **18 deterministic trials**.

The receipt also includes:
- No-ground negative control: contact disabled; ground normal impulse, friction impulse and horizontal translation should all be zero.
- No-friction negative control: zero friction force and horizontal translation, regardless of torque and shape-change input.
- No-actuation negative control: the morphing command is disabled, and the resulting dynamics should match the fixed-round baseline, including zero actuator work.
- Timestep halving from dt=0.005 to dt=0.0025 at fixed mu=0.35/torque=0.8, one case per shape policy. These are numerical discrepancies, not proof of convergence.

The UI offers animated playback with moving anchors, node positions and floor contacts, plus a full 18-case table and JSON/CSV receipts with explicit SIMULATED provenance and physicalValidation NONE.

## Known limitations

- This is an idealized Cartesian anchor actuation formulation, not a physically engineered radial telescoping spoke or sealed fluid-cell membrane.
- The model uses ideal mass points, linear springs and dashpots. It has no beam bending, tire carcass, thickness, fatigue, fracture, pressure/volume constraints, hydrostatic coupling, self-collision, contact between spokes, water charge, sensors, electrical impedance, actuator stroke limits, force saturation, actuator response delay or motor efficiency.
- At the specified numerical timestep, 24 discrete contact points can create hopping and unrealistic contact force spikes.
- No physical units or measured material properties exist; do not label normalized forcing as newtons, work as joules, or displacement as meters.
- Fixed-square and morph-cycle cases do not share identical unstressed rim rest lengths and geometry. Comparisons are exploratory outputs, not fair physical superiority tests.
- A small net actuator work could result from negative work canceling positive work; **gross positive actuator work must always be disclosed**.
- There is no energy-recovery engineering or real battery/capacitor.
- Timestep halving is an insufficient accuracy study, and there is no independent experimental verification.

## E7: further validation gate

Perform explicit force/momentum and energy audits, include actuator force/stroke limits, compare alternative actuation laws, assess node/rim resolution and step-size sensitivity, then introduce a contact and elastic model calibrated against independent measurements. No proposal to install this on a vehicle is justified by E6 alone.

**Ledger above ego. Model before claim.**
