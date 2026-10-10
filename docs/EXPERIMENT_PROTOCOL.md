# PM-E0-0.1.0: frozen exploratory comparison

## Research question

How do three 24-cell geometries respond under a deliberately simplified dimensionless spring network? This concerns model behavior, not material performance.

## Independent variable

Layout: ring; spiral; nested.

## Shared inputs

Normalized radial force (0–3), link stiffness (0.5–8), damping (0.1–4), downward distributed load (0–4), and periodic drive frequency (0–3 cycles per model-time unit).

## Frozen solver settings

24 cells; three nearest neighbors per cell before link deduplication; 320 integration steps; time increment 0.02; anchor spring multiplier 0.42; network multiplier 0.68; pressure/drive force multiplier 0.65; periodic drive amplitude 0.26. Point masses normalized to one.

## Outputs

Final RMS displacement, peak displacement, peak spring strain, geometric bottom-span proxy, RMS motion proxy, work proxy, numerical-bound flag, link count, timestamp, source provenance, protocol and model version.

## Control conditions and limitations

The layouts do not have identical graph topology, spring lengths, occupied area, material volume or boundary geometry. Current results are observations of the toy model, not controlled tests of golden-ratio superiority. E1 should implement matched edge-count and matched span baseline experiments. A real morphing wheel also requires calibrated material constitutive laws and contact mechanics.

## Receipt

Each comparison exports schema phi-morph.e0.receipt.v1, origin SIMULATED, and normalized_dimensionless units. It can be independently regenerated from the same parameter values, with timestamp separately supplied. Time is metadata, not solver entropy.

Ledger above ego. No superiority claims until controls and independent verification.
