# PM-E2-0.3.0: orientation and scalar link-budget controls

## Research purpose

E0 had differing neighbor networks. E1 matched vertex count, indexed graph, degree and initial RMS radius, but left spring lengths, orientation and shape geometry different. E2 explicitly measures sensitivity to some of those conditions.

The existing E0 and E1 protocols are unchanged. E2 is its own versioned experiment, not an update to older receipts.

## Factorial design (144 cases)

- **Three layouts:** ring, golden-angle phyllotaxis-inspired spiral, and nested staggered rings.
- **Two normalization modes:** rms-radius and edge-budget.
- **Eight planar orientations:** 0, 45, 90, 135, 180, 225, 270, 315 degrees.
- **Three normalized downward loads:** 0, 2, 4.
- **One boundary condition per receipt:** four lowest initial nodes pinned (reselected for each rotation) OR no hard pins with linear soft-tethers. Run these boundary settings as separate experiments.

The chosen stiffness, damping, radial drive and actuator frequency remain equal across cases in a receipt. The global downward load slider is overridden by the three E2 fixed loads. There are 3 × 2 × 8 × 3 = 144 cases.

## Normalization controls

For each geometry, start with E1 centered coordinates having RMS radius 2.65, along with E1's fixed circulant C24(1,2) indexed graph (24 nodes, 48 edges, degree four).

- **RMS-radius mode:** maintain initial RMS radius 2.65, rotate as requested. Total link rest length differs by layout.
- **Edge-budget mode:** uniformly scale positions until the sum of all 48 initial spring rest lengths equals the ring's corresponding total at RMS radius 2.65, then rotate. This mode does not maintain a common RMS radius.

These constraints CANNOT in general be simultaneously achieved through one uniform scale. More importantly, equal total rest length is a scalar *surrogate* for material budget, **not a match of per-link lengths, material mass, stiffness-energy budget or manufacturing cost**.

The graph uses linked indexed nodes, not nearest-neighbor proximity after scaling. It can connect widely separated spiral nodes and its segments can intersect. No geometric collision or self-contact is modeled.

## Simplified solver

E2 copies the E1 normalized damped semi-implicit Euler point-mass spring-network equations into a separately versioned model. It uses 320 integration steps at dt=0.02, duration 6.4. Each point has an initial-position tether and springs along the fixed indexed edges with initial geometric rest lengths.

The vertical load direction stays fixed while the lattice rotates. The drive phase uses each point's initial polar angle, so **rotation changes both geometric orientation and drive phase**, a further confounder. Hard pins fix four of the lowest initial nodes but are **not a physical ground contact**. The model has no SI units, liquid physics, electric fields, vehicle, rotating tire, membrane properties, pressure, friction or physical validation.

## Outputs and reproducibility

Outputs per case: geometry, normalization mode, angle, load, finiteness, initial stats, pinned IDs, final RMS displacement, maximal displacement, peak absolute link strain, final mean vertical shift, periodic drive work proxy.

The interface offers three switchable-load heatmap slices, an audit table with matched/unmatched shape statistics and angle sensitivity ranges, downloadable JSON including provenance and limitations, and a 144-data-row CSV for outside analysis.

Identical inputs and timestamp give identical receipts. All outputs are labeled SIMULATED and physicalValidation NONE. Neither heatmap saturation nor numeric ranking establishes material quality.

## Checks

1. Every geometry/mode/angle has 24 centered nodes, 48 edges and four connections per node.
2. RMS-radius mode preserves radius 2.65, while edge-budget mode preserves the ring reference total rest length.
3. At 0 degrees and RMS-radius mode, the E2 point solver reproduces E1 metrics under the same boundary/inputs, within the retained six-decimal metric precision.
4. Repeat runs are bitwise deterministic in the same runtime.
5. Invalid geometry, normalization, boundary and orientation are rejected.
6. Exactly 144 simulations and 144 CSV data rows are recorded per study.

## Future gate: E3

Before making geometry performance statements: match spring-length distributions or stiffness-energy budgets, examine point placement symmetry, vary actuator phase independently from rotation, add multi-step numerical convergence checks, and benchmark with a validated continuum/contact model or independently calibrated physical tests. A wheel application additionally requires rotational dynamics, a calibrated friction law and explicitly modeled tire-ground contact forces.

**Ledger above ego. Model before claim.**
