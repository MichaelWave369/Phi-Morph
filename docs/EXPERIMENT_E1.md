# Φ-Morph PM-E1-0.2.0: controlled topology load sweeps

## Why E1 exists

E0 compared three initial geometries connected to three nearest neighbors. This inadvertently changed graph structure alongside geometry, so topology was a confounder. E1 removes that particular confounder and adds a fixed load sweep and timestep-halving diagnostic. It **does not** establish a fair test of physical materials or superiority of one geometry.

## Question and nonclaims

Question: How does this normalized spring-network system respond to a prescribed range of downward forces when index adjacency and initial RMS size are held equal across three geometries?

Do not claim improved tire braking, material stiffness, electrohydraulic response, fluid pressure distribution, fatigue behavior, field-induced water solidification, or a special benefit of Fibonacci/NBG arrangement.

## Controls / freeze

- Count: 24 nodes.
- Connection graph: circulant C24 offsets 1 and 2, undirected degree four, 48 links.
- Geometry: ring, golden-angle phyllotaxis-inspired placement, nested staggered rings. Coordinates are centered and scaled to initial RMS radius 2.65.
- Node masses: normalized to one.
- Inputs: same normalized drive, link stiffness, damping and frequency settings for each geometry.
- Downward force: seven levels 0, 0.5, 1, 1.5, 2, 3, 4, distributed equally across all nodes.
- Each layout uses its actual **initial** link lengths for Hooke's law rest lengths. The edge lengths differ by geometry.
- Simulation: duration 6.4, dt 0.02, 320 integration steps; damped semi-implicit Euler velocity and position updates.
- Boundary control: either soft-tethered nodes with no pins, or the four smallest-initial-y nodes hard pinned for the complete run.
- Each node also has a linear spring tether to its starting position. Both boundary options include tethers.
- Spring coefficients: anchor 0.38× stiffness; edge 0.64× stiffness; radial drive 0.42× pressure and 0.16 periodic forcing amplitude.
- Numerical check: repeat **one selected-load case per geometry** with dt 0.01 and 640 steps, same duration. Report absolute and scaled-relative RMS differences.
- Exploratory diagnostic tolerance: 5% relative difference. This is an author-chosen model diagnostic, not engineering acceptance.

## Recorded outputs

- Final RMS displacement in dimensionless coordinates.
- Peak displacement across the time trajectory.
- Peak relative spring length change.
- Mean final vertical shift.
- Periodic forcing work proxy, not a calibrated quantity of energy.
- Numerical finiteness flag; pin identifiers; normalized initial controls and 48-link graph metadata.
- dt-halving comparison at currently selected E0 load.
- Exact simulation provenance string SIMULATED, no physical validation claim.
- JSON and CSV exports. CSV contains 21 load cases; JSON includes the full provenance, parameter freeze, per-layout convergence and caveats.

## Important residual confounders

Even with the same connection indices and degree, E1 geometries retain different initial link lengths and directions, distributions of nodes, area, outer bounds, orientation, pinned-node spatial locations, and strain concentration. Therefore the plotted relative responses cannot rank physical geometry quality.

The 'bottom-pinned' mode is an artificial positional constraint, not a contact solver. There are no ground reactions, grip coefficients, rotational motion, inflatable chambers, compressible/incompressible fluids, electric fields, membrane stress, temperature or SI units.

## Interpretation gates

- Report results as outputs from a **toy model**.
- If the dt discrepancy exceeds 5%, flag that a finer timestep study is needed; if it does not, report only that this one diagnostic passed.
- Do not promote 'physics proven', 'safe', 'validated', or 'better performance' from any E1 receipt.
- E2 priority: compare matched link-length distributions / total spring rest length, geometric size metrics and orientation, then benchmark against an independently validated constitutive/contact solver or instrumented prototype.
- Add documented numerical tolerances, more than two timesteps and sensitivity analysis before quantitative interpretation.

The initial claim ledger belongs to the model, not reality. Ledger above ego.
