# Φ-Morph

**Programmable Matter & Adaptive Shell Laboratory**

[![CI](https://github.com/MichaelWave369/Phi-Morph/actions/workflows/ci.yml/badge.svg)](https://github.com/MichaelWave369/Phi-Morph/actions/workflows/ci.yml)

An open computational laboratory investigating morphable cell assemblies, variable-stiffness concepts, adaptive wheels, and speculative machine shells.

**Planned GitHub Pages laboratory (after deployment succeeds):**
https://michaelwave369.github.io/Phi-Morph/

## Experiment E0: 24-cell geometry comparison

The initial React + Three.js lab offers three virtual layouts: an even ring, a golden-angle-inspired cell arrangement, and staggered nested rings. Each layout is connected by its three nearest neighbors in a deterministic spring network. Controls vary normalized radial forcing, link stiffness, damping, downward load and periodic forcing frequency.

The UI provides live normalized displacement and strain proxies, a geometric bottom-span proxy and a crude actuation-work proxy. E0 comparisons freeze the inputs and export JSON receipts with SIMULATED provenance and fixed protocol/model versions.

**This is a dimensionless toy simulator, not fluid mechanics, CFD, finite-element analysis, electrorheology, tire traction, or physically validated structural engineering.** Geometry comparisons are hypothesis-generating only. The geometry-specific networks are not mechanically equivalent; no performance claim follows from reported values.

## Development

Requires Node 20.19+ or Node 22.12+.

1. Install dependencies with npm install.
2. Run npm run dev to start the local Vite server.
3. Run npm test for the deterministic model tests.
4. Run npm run build to generate the GitHub Pages-compatible dist directory.

**Reproducibility note:** The v0.1 PR does not yet include a dependency lockfile. Direct dependency versions are pinned but the transitive dependency graph is not frozen; generate and commit an npm lockfile before claiming frontend supply-chain reproducibility.

GitHub Actions includes CI and a deploy workflow. The deployment workflow runs on pushes to main; set repository Settings → Pages → Build and deployment → Source → GitHub Actions if needed. A workflow file does not itself prove successful deployment.

## E1: topology-controlled load sweeps

**New in v0.2.0:** The second laboratory panel tests a consistent 24-node, 48-link,
four-regular graph across all three geometries. The layouts are centered and
scaled to a common initial RMS radius. Run 7 force levels per shape, switch
between a soft-tether condition and four pinned bottom nodes, inspect the
RMS displacement traces, compare two numerical time steps, and export
SIMULATED JSON / CSV research receipts.

E1 reduces an E0 topology confounder but still leaves different spring lengths,
orientation, distributions, boundary geometry and other differences. This
**does not demonstrate physical material superiority or water-based tires**.

Full protocol: [PM-E1-0.2.0](docs/EXPERIMENT_E1.md).

## E2: orientation and scalar rest-length-budget audit

The third panel performs 144 deterministic modeled cases: two normalization
policies, three geometric layouts, eight orientations and three load levels.
The audit directly contrasts matching RMS starting radius with matching the
scalar sum of all 48 spring rest lengths, and reports orientation-sensitive
displacement ranges. Results are exportable as a provenance-labeled JSON
receipt or 144-case CSV.

These are still exploratory spring-model comparisons, **not claims about
material properties, fluid pressure, friction or vehicle design**. Neither
policy matches all individual link lengths or the physical material budget.

Protocol: [PM-E2-0.3.0](docs/EXPERIMENT_E2.md).

## E3: MorphWheel unilateral ground-contact bench

The fourth laboratory adds a **2D, dimensionless, vertical hub + spring-cell
ground-contact simulator**. Twenty-four linked virtual nodes can press into
a flat floor under a prescribed hub load; the floor returns upward reaction
only during numerical overlap. This is a **unilateral penalty-contact model**,
not a tire road-test or physical fluid actuator.

- Scrub an animated 24-node virtual shell with contact nodes highlighted.
- Compare soft and firm *numerical floor penalties* under four loads and
  three starting geometries (24 contact simulations).
- Check three **no-ground negative controls**, whose reaction must be zero.
- Export protocol-versioned SIMULATED JSON receipts and a 24-case CSV.
- Interpret hub drop, maximum numerical overlap, late-window reaction and
  final contact-node counts as **solver-specific proxies only**.

The underlying model has no rotation, braking, tire contact area, calibrated
units, membranes, electrohydraulics, charged water, or material validation.
Ground stiffness and damping both differ between the two numeric floors.

Full E3 protocol: [PM-E3-0.4.0](docs/EXPERIMENT_E3.md).

## E4: discrete-contact rolling and friction laboratory

The fifth experimental station adds a **separate rigid wheel-outline model**
with hub translation/rotation, clockwise motor torque, upward unilateral
ground penalty forces and velocity-regularized tangential friction.

Two *fixed* outlines (round and rounded square) share 24 contact nodes,
a normalized RMS starting radius, mass and moment of inertia. The wheel
view animates the rotation and simulated travel. The study runs 18
combinations of shape, friction coefficient and torque at a chosen load,
plus two no-ground negative controls, with JSON and CSV receipts.

Zero-friction trials explicitly test whether a rotating wheel can move
laterally without tangential contact forces. It should not.

**E4 does not model actual shape change, fluid-cell actuation, physical
tire traction, braking distance or a real structural material.** The
segmented outline is rigid, coarse and has only point-node contact.
The comparisons are not real design rankings.

Protocol: [PM-E4-0.5.0](docs/EXPERIMENT_E4.md).

## E5: numerical resolution and energy-ledger audit

Before allowing freeform simulated morphing, the sixth station verifies
how sensitive the E4 rigid-wheel mechanics are to model discretization.
E5 runs **18 cases**: two fixed shapes × three point resolutions (24/48/96)
× three time steps (0.01, 0.005, 0.0025). A selectable force/torque/friction
set is frozen for each experiment receipt.

The new energy ledger records rigid kinetic energy, applied-load potential,
ground penalty-spring potential, motor work, friction losses, viscous
damping and a **numerical energy-balance residual**. A visible residual is
not hidden as a success status. Four no-ground/no-friction controls test
that no lateral force appears without a frictional ground pathway.

Outputs are SIMULATED, dimensionless, and **do not demonstrate powered
shape changes or real tire efficiency**. E6 can tackle actuator deformation
only with force-consistent mechanics and explicit actuator work.

Protocol: [PM-E5-0.6.0](docs/EXPERIMENT_E5.md).

## E6: active morphing rim and actuator energy ledger

The seventh station introduces an **explicit deformable rim**. It contains 24
independently moving point masses connected by rim springs, plus moving
body-mounted spoke anchors and **equal-and-opposite hub reactions and
moments**. A smooth round → rounded-square → round command changes the
anchor targets during an eight-unit numerical trial. Actual nodes respond
to forces rather than teleporting to an interpolated shape.

E6 measures **gross positive actuator work, negative actuator work, and
signed net work separately**, alongside motor work and the full model's
energy-balance residual. The control study has 18 combinations of stationary
and morphing command modes, friction and torque, plus no-ground,
no-friction and no-actuation controls and dt-halving checks.

The animation exposes rim masses, their moving target anchors, and ground
contact points. JSON/CSV receipts preserve SIMULATED provenance. This
is a force-paired toy model, **not a validated fluid-actuated tire**.
No electrical energy use, pump, material durability or actual braking
performance is predicted.

Protocol: [PM-E6-0.7.0](docs/EXPERIMENT_E6.md).

## E7: force limits and repeated morphing-cycle audit

E7 is a separate dimensionless experiment that gives every shape-changing
actuator a **capped axial force**, and tests how the virtual rim responds to
repeated morphing cycles **without resetting the moving state**.

All 24-node cases share the same round starting geometry and rim rest lengths.
Controls cover force caps of 0, 4, 10 or uncapped, commanded stroke fractions
of 0%, 50% or 100%, and one versus three continuous shape-change cycles.

The new bench animates the force-limited rim and reports cap saturation
frequency, node-to-anchor tracking error, per-cycle positive/negative servo
mechanical work, numerical rim strain and energy-residual diagnostics.
A 24-case study includes four negative controls and exports SIMULATED
JSON/CSV evidence receipts.

**This is not a real durability or fatigue test**. A peak strain flag is
an arbitrary model diagnostic, and mechanical actuator work is not
electrical battery use. The solver contains no measured material laws,
thermally limited motors, pressure systems, tire rubber or validated road
traction.

Protocol: [PM-E7-0.8.0](docs/EXPERIMENT_E7.md).

## E8: actuator response and mechanical-power characterization

The ninth research station is deliberately an **isolated one-degree-of-freedom
actuator bench** rather than another unvalidated tweak to the wheel solver.
It studies a normalized controller that follows the E7 round → square → round
command under force and sampled mechanical-power limits.

E8 includes three gain-response profiles, three force caps, three power caps,
a 27-case study, four negative/reference controls, and a mathematical
analytic step-response comparison. The React panel graphs command against
achieved position and reports lag, peak force/power, gross positive/negative
work, energy residual and command-response loop-area proxy.

The loop area represents **controller lag**, not observed material
hysteresis. The force/power numbers are dimensionless model quantities,
NOT watts, newtons or measured electrical consumption. No hardware or
water-based material has been tested.

The E8 protocol includes an explicitly labeled future physical
measurement schema so that real calibrated samples can eventually be
evaluated without being confused with simulated receipts.

Protocol: [PM-E8-0.9.0](docs/EXPERIMENT_E8.md).

## E9: limited actuator mechanically coupled back to MorphWheel

E9 is the tenth research station, combining a **single shared normalized
actuator coordinate q** with the E7-style 24-node spring-linked wheel.
The controller's commanded q follows the established round-to-square-
to-round schedule, but actual q is dynamically determined by the E8
force/power-limited PD controller and the deforming rim's back-reaction.

Unlike a scripted geometric animation, the spring potential and
damping forces feed a work-conjugate reaction into q. The modeled
controller has to perform explicit mechanical work to overcome it.

The interactive station compares **requested versus achieved shape**
alongside a moving wheel and ground-contact visualization, with
27 force/power/controller configurations, five controls and a
timestep-halving check. Crucially, disconnecting the spoke linkage
must reproduce the earlier E8 actuator mathematics.

No real pneumatic/electric actuator, pressure-regulated liquid, tire
material, brake or tested traction behavior is provided. Results are
SIMULATED and dimensionless, not physical motor efficiency claims.

Protocol: [PM-E9-1.0.0](docs/EXPERIMENT_E9.md).

## Research boundaries

- Ordinary or 'charged' water does not become a load-bearing solid merely from dialing a frequency.
- Future electrohydraulic, fluidic, electric-field and variable-stiffness mechanisms must be specified and validated separately.
- A frequency slider here excites a spring system; it is **not** a material-changing electromagnetic resonance experiment.
- No automotive, human-load-bearing, therapeutic or safety-critical uses are implied.

See [model limitations](docs/MODEL_LIMITATIONS.md) and [experiment protocol](docs/EXPERIMENT_PROTOCOL.md).

## Related work

- Nested Bubble Gear / Altermath: inspiration for candidate geometry arrangements; no experimental validation inferred.
- OpenBlue / EVIE: potential future CAD exchange.
- PixelForge: potential future rendering pipeline.

## License

MIT © 2026 MichaelWave369.
