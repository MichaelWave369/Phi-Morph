# Model limitations and epistemic boundaries

## What exists in E0

A deterministic 2D array of 24 point masses under normalized forces, with 3-nearest-neighbor undirected spring links, individual springs anchored to initial reference points, linear damping, uniform downward distributed forcing and periodic phase-offset radial forcing. A Three.js renderer visualizes the coordinates as spheres and lines.

Every geometry shares global parameters, step count (320) and time increment (0.02). Different layouts have different connectivity, rest lengths and edge counts. This is not a fair material-engineering comparison without further controls.

## What the numbers mean

- RMS displacement: RMS distance of final cell points from starting positions, in normalized length units.
- Peak displacement: greatest observed cell displacement over the trajectory.
- Peak spring strain: greatest absolute relative spring length change.
- Bottom span proxy: horizontal width of nodes within an arbitrary distance above the lowest node. This does NOT represent contact area, grip, braking or ground pressure.
- RMS motion proxy: root mean square cell velocity over the run.
- Drive work proxy: integral of absolute periodic forcing times radial velocity. This is NOT a measured energy in joules.
- Within toy-model bounds: finite coordinates, peak displacement below four and peak strain below two. Not a safety classification.

## What the model omits

Water physics, electrical charge, fluid incompressibility, pressure vessels, electrohydraulic actuation, electric fields, thermal effects, nonlinear membranes, leaks, ground friction, wheel rotation, vehicle dynamics, material fatigue, calibrated stress and measured experimental data.

These omitted effects must not be inferred from E0 metrics or graphics.

## Claim classes

- OBSERVED: a UI action, not a measured physical experiment.
- SIMULATED: E0 model outputs, diagnostics and receipts.
- INFERRED: engineering implications requiring actual validation.
- VERIFIED: independently measured or replicated evidence, not used for E0.

## Future gates

E1 adds normalized load sweeps, timestep sensitivity, solver convergence, graph-degree-matched controls and boundary-condition controls.

E2 can use a documented physical constitutive model, SI units, published calibration benchmarks and independent replication.

No part of E0 constitutes evidence that the golden ratio, charged water or NBG improves a physical machine.
