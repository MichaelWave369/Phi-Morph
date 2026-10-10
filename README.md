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
