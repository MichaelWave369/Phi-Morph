# Phi-Morph E10 / PM-E10-1.1.0: physical actuator options and SI evidence gate

## Research purpose

The E0–E9 chain established numerical model architectures, shape scheduling, ground-force proxies, actuator force/power caps and force-coupled deformable rim mechanics. **No SI-scale experiment, calibrated actuator curve, real material parameter or observed tire outcome** has been established.

E10 is deliberately a transition from *model-only evidence* to a system capable of accepting future physical bench data. It is **NOT** an automatic model-calibration engine or proof that a programmable tire can be built.

## Three candidate actuator mechanisms

These are alternatives for a future independently engineered fixture, not a chosen bill of materials or endorsement.

| Approach | Potential drive | Required additional measurements | Main unresolved risks |
| --- | --- | --- | --- |
| Electromechanical linear stage | DC/stepper/servo drive through screw, cam or linear guide | Stroke, load-cell force, motor terminal voltage/current, temperature, encoder position | Mechanical backlash, jam/stall force, friction, speed/force envelope, thermal limits |
| Pneumatic/hydraulic compliant chamber | Pump/compressor, valve, bounded pressure chamber | Pressure, volume/flow, temperature, deformation, force, input energy | Leakage, pressure-vessel safety, fluid dynamics, fatigue, actuator speed, serviceability |
| Specified electroactive or variable-stiffness material | Qualified material plus rated electrical driver | Force-displacement curves versus bias/rate, insulation tests, current/voltage, temperature | Field strength, breakdown, stiffness range, material aging, replicability |

None of these suggests that ordinary or electrically charged water turns solid by changing frequency. A physically realized mechanism must be sourced, sized and safety-engineered separately.

## Canonical seven-column CSV

E10 accepts UTF-8 CSV (with optional BOM) with exactly the following column names, in any order:

    time_s,command_m,displacement_m,force_N,voltage_V,current_A,temperature_C

Every row represents a time-coherent sample **as asserted by the file provider**, with:

- time_s: nonnegative, strictly increasing elapsed seconds.
- command_m: commanded actuator displacement in meters.
- displacement_m: measured actuator displacement in meters.
- force_N: measured actuator force in newtons, with an independently documented sign convention.
- voltage_V: measured electrical potential difference across an identified drive boundary in volts.
- current_A: measured signed current across the same identified electrical boundary in amperes.
- temperature_C: measured temperature in degrees Celsius, with known sensor placement.

The implementation rejects duplicate/missing headers, blank or nonnumeric values, infinity, nonmonotonic time, below-absolute-zero temperatures, fewer than three samples, more than 10,000 samples and text files over 1 MB. It does **not** accept arbitrary CSV comments, multiline quoted cells, or undocumented inferred units.

**Mandatory outside-CSV metadata for eventual verification**:
device model and serial, test fixture geometry, electrical measurement boundary and polarity, load-cell orientation, actuator/displacement sensor part number and calibration certificate, calibration uncertainty, test date, operator, environmental temperature, acquisition clock synchronization, sample rate and anti-aliasing setup, command generation method, power supply/driver, firmware/source version and an independently archived original data file. The optional text inputs in the UI are NOT sufficient to verify these facts.

### Quality handling

The CSV parser checks syntax, numeric finiteness, chronology and gross signal consistency. A simple time-interval ratio flags strongly uneven sampling; it does **not** reject all irregular sampling or certify sample quality.

Energy diagnostics use signed sampled values:

    P_elec(t_i) = voltage_V_i * current_A_i
    Delta E_elec_i = 0.5 * (P_i + P_(i-1)) * Delta t_i
    Delta W_mech_i = 0.5 * (F_i + F_(i-1)) *
                     (displacement_i - displacement_(i-1))

Each interval contributes separately to positive and negative energy/work totals. Numeric totals use every imported row. The displayed plot may be decimated for rendering only.

These are **trapezoidal sample estimates**, subject to synchronization, bandwidth, sampling, force/current polarity and which physical boundaries the instruments actually span.

The report includes RMS command-tracking error, sampled force and electrical-power peaks, mean sample rate, maximum approximate displacement speed, signed positive/negative mechanical work, positive/negative electrical energy, recorded temperature range and basic sampling quality flags.

The report never computes efficiency, recovery or a tire performance ranking. Electrical and mechanical signs/boundaries have **not** been independently reconciled and stored-energy/driver losses are unknown. A negative electrical integral is not automatically evidence of recovered energy.

## Immutable provenance boundary

There are only two entry paths:

1. The built-in deterministic demonstration fixture: origin SIMULATED. Its 201 records are generated from arithmetic, not from sensors.
2. A user-supplied local CSV: origin USER_SUPPLIED_UNVERIFIED, even when a user types a calibration record reference.

Both paths report verification NOT_INDEPENDENTLY_VERIFIED, physicalValidation NONE and calibrationEvidenceStatus USER_ASSERTED_ONLY. There is **no** automated path to grant origin VERIFIED or OBSERVED. A user can edit the text of a receipt outside the app, so unsigned JSON is a working research report, not a cryptographic certificate of authenticity.

Future independently reviewed data must have a separate controlled admission procedure including raw-file integrity hashes, archived calibration files, reviewed acquisition instrumentation, operator attestations and a reproducible data-processing script. The present implementation intentionally does not provide such a gate.

## UI and files

The browser reads one local CSV through its file-input API into client memory for analysis. No project server upload or API is created by this feature. The interface offers:

- Blank seven-column template (header only, NOT a fabricated physical sample).
- Deterministic synthetic demonstration plainly labeled SIMULATED.
- Signal plot of requested and recorded displacement in SI-declared meters.
- Optional rig label, calibration-reference string and fixture notes.
- JSON receipt preserving provenance, all computed metrics and caveats.
- Export of inspected data rows back to an SI-format CSV.
- A selectable planning comparison of three candidate actuator architectures.

The browser's measured/SI assertions depend entirely on the uploaded content and are not independently tested.

## Separate model versus measurement layers

E9 dynamics are **dimensionless** and must stay so. E10 imports columns labeled in SI, but does NOT convert E9's normalized force or displacement to newtons/meters, calibrate controller gains from a single file, or implicitly multiply inferred values by arbitrary scales.

A defensible E9/E10 bridge would require independently established geometry scales, masses, time scale, force/energy boundary definitions, uncertainty budgets, aligned command and sensor timestamps, multi-condition fitting with a held-out validation set, and a model-mismatch report. Until then e9PhysicalScaleMappingEligible remains false.

## Recommended first external benchmark

Start with a safe, professionally engineered **single-axis bench fixture**, not a road-going wheel. Obtain a current-rated device and properly rated load fixture. Capture an unloaded step, loaded step, bidirectional slow cycle, multiple-rate cycles, motor/driver current and voltage, force, displacement and temperatures. Perform instrument checks before test sequences, use mechanical stops and emergency de-energizing protections, and avoid unsupported high-voltage or pressure experiments.

E10 does not send commands to real hardware and does not replace a qualified mechanical/electrical design review.

## Follow-on E11

Once real signed source files and verified calibration evidence exist, define an observation-admission workflow, uncertainty-aware parameter identification with training/holdout sets, and frozen acceptance tolerances. Without them, proceed only with independently checkable mathematical fixtures and explicit synthetic provenance.

**Ledger above ego. Model before claim.**
