# Φ-Morph PM-E3-0.4.0: unilateral ground-contact bench

## Research question

What does a **dimensionless 24-node spring assembly** do when a freely moving vertical hub is loaded downward and virtual circular nodes interact with an explicitly modeled flat floor?

E0 only displayed a near-bottom span heuristic. E1 and E2 used positional pins or tethers to reference coordinates, not a ground reaction. E3 introduces a contact force and a no-ground negative control. The improvement is **numerical model specificity**, not proof of an actual morphing wheel.

## Frozen design

- Three starting node geometries from E1: ring, golden-angle/spiral-inspired layout, and staggered nested rings.
- Initial node positions centered at zero and scaled to RMS radius 2.65.
- Fixed indexed topology: 24 nodes, 48 links, four incident links per node (circulant C24 with offsets 1 and 2).
- Each node is a unit mass; the vertically translating hub has mass 2 and is horizontally constrained at x=0.
- Radial spoke springs connect the hub to each node, and ordinary link springs connect the network nodes.
- Spokes change target length according to a small radial command from the normalized 'pressure/drive' slider. When frequency is nonzero, a small periodic radial modulation is applied. This is **not** a physical fluid or electrostatic drive.
- Initial clearance between the lowest circular node surface and the floor is 0.04 normalized units.
- Each node has numerical collision radius 0.22. The flat floor is y=0.
- Default dt=0.01, duration=8 simulation-time units (800 semi-implicit Euler steps).
- Viscous point and hub damping is present. There is no hidden absolute-position spring holding the hub in the air.
- Downward load enters only on the hub; the hub's vertical dynamics are resisted by spokes, which transmit force to nodes, which can then receive upward reaction from the ground.

## Compression-only penalty contact

For a node center height y, downward velocity vy, node radius R, numerical ground stiffness k, and contact damping c:

    δ = max(0, R - y)
    Fn = 0                             if δ = 0
    Fn = max(0, k δ + c max(0, -vy))   if δ > 0

Fn acts upward **only** on a penetrating node. The law has no adhesion or attractive floor force. During contact disabled negative controls, Fn is set identically to zero regardless of node position.

Two parameter sets are used as sensitivity controls, not real material profiles:

- soft: k=35, c=2
- firm: k=100, c=3.5

## Experiment design

- 3 layouts × 2 ground stiffnesses × 4 normalized downward loads (0.5, 1, 2, 4) = **24 contact runs**.
- Plus 3 no-ground **negative controls** (one per layout, load 2, soft parameter label).
- Each 8-unit run starts from an unstressed above-floor position and zero velocities.
- The chosen non-load slider values are frozen for each receipt.
- Individual previews can be replayed as 2D traces. Contacting nodes are highlighted when their final/current center is at or below their numerical radius.

## Reported metrics

- Hub drop relative to initial hub height, and final hub height.
- Final number of touching nodes and horizontal span between them, measured only as a **node-geometry proxy**.
- Maximum numerical node-floor penetration (overlap, not measured compression of a real material).
- Peak instantaneous normal force.
- Final instantaneous normal force.
- Mean ground reaction over the final quarter of the simulation.
- Average magnitude of hub vertical velocity in the final quarter.
- Ratio of late-window mean normal reaction to applied downward load. The ratio is diagnostic only: **it may depart from one substantially because of transient motion, vertical damping, and time-limited integration**.
- Largest difference from target spokes, another normalized model quantity.

The downloadable receipt includes full control parameters, solver metadata, explicit SIMULATED origin, physicalValidation NONE, 24 cases, and three no-floor controls. CSV includes the 24 contact cases only. The animated preview is intentionally separate, preserving a reasonably small experiment receipt.

## Integrity / falsification requirements

1. No contact force when the node is at or above the plane (including arbitrarily fast approach from above).
2. Penetrating points experience nonnegative upward reaction, never adhesive force.
3. Disabling ground contact gives identically zero ground reaction and does not covertly pin any nodes.
4. The finite-integration checks cover every geometry and floor parameter set at the nominal load.
5. Identical parameters and timestamps reproduce identical outputs and preview traces.
6. A changed load changes hub dynamics; negative and positive contact controls are visibly distinct.
7. The source always labels these measurements dimensionless and SIMULATED, without physical-safety claims.

## Remaining limitations

This remains a 2D point-spring computational demonstration, **not** a real tire simulation or an experimentally validated physical contact constitutive law. It omits rolling, slip, static/kinetic friction, steering, braking torque, intercell membrane interaction, punctures, pressure vessels, water, electric fields, adhesion, verified strength, calibrated load capacity, and thermal/fatigue behavior.

The two floor configurations vary numerical penalty stiffness and damping simultaneously; they do not isolate stiffness as an independent physical factor. Penalty overlap is a numerical artifact, not a tire deformation measurement. Different starting layouts retain unequal spring lengths and shape envelopes. The radial drive's oscillation may prevent true settling. No contact-width metric can be interpreted as tire-road area.

## E4 target

Add a solver convergence and energy/momentum audit, a contact-only no-drive baseline, comparison of stiffness and damping as separate variables, and 2D rolling/contact with an explicitly documented friction law. For actual mechanical relevance, benchmark a constitutive and contact model against an independent physical measurement or qualified contact solver.

**Ledger above ego. Model before claim.**
