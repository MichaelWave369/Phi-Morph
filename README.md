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
