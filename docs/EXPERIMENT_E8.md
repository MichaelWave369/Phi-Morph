# Φ-Morph E8 · PM-E8-0.9.0: actuator response, power cap and controller-loop audit

## Why E8 is separate from E7

E7 has a simulated moving wheel whose per-node actuator forces are capped.
It does not identify real actuator response bandwidth, instantaneous
power limits, delay, electrical losses or material hysteresis.

E8 isolates ONE normalized translational degree of freedom to study how
a proportional-derivative feedback actuator follows exactly the same
round-to-square-to-round scalar command used by the wheel experiments.
**E8 does not yet drive the E7 rim model.** This separation allows analytic
reference checks without confusing point-contact dynamics with the motor.

No motor or device was measured. All E8 sources are labeled SIMULATED.

## Frozen one-degree-of-freedom plant

- Position x, velocity v, unit effective translating mass.
- Start x=0, v=0 in every case.
- External conservative return spring with coefficient either 0 or 2:
  load force = -k_load*x.
- External viscous damping coefficient either 0 (analytic controls)
  or 0.7 (main study): drag = -c_load*v.
- Controller feedback F_raw = kp*(command - x) - kd*v.
- Feedback gain profiles: slow (kp=4,kd=2);
  medium (kp=12,kd=3.5); fast (kp=24,kd=5).
- Force limits: 0, 4, 10. Unbounded force is used solely in analytic
  and control references.
- Mechanical sampled power limits: 0, 2, unbounded.
- Signed saturated force is computed in TWO stages:
  F_force = clamp(F_raw, -F_max, F_max).
  F_applied = clamp(F_force, -P_max/abs(v), +P_max/abs(v)),
  unless the sampled v=0, where instantaneous mechanical work is zero.
- Semi-implicit Euler dt=0.005 by default, with dt=0.0025 diagnostic.
- Morph schedule: t=0–1 round; 1–3 command toward square; 3–4 hold;
  4–6 return to round; 6–8 hold round; repeat without resetting state
  for 1 or 3 cycles.
- Scalar x=0 means round-command position and x=1 means square-command
  position. x can slightly overshoot because this model does not install a
  physical end stop. It is NOT a tire circumference measurement.

The power cap bounds the sampled instantaneous absolute value of F*v at
the start of a numerical step. It is NOT guaranteed to bound intra-step
peak energy, electrical input power, peak current, electrical drive
voltage, motor heating or real hardware wattage. F and v have no SI units.

## 27-study experiment and controls

For one selected cycle count and load-spring condition, the study crosses:

- 3 controller gain profiles × 3 force limits × 3 mechanical power limits
- **27 cases** per study, with no hidden changes in initial state.
- Negative controls: no-command, zero-force, zero-sampled-power and
  unbounded-force/power reference.
- All runs record finiteness, force/power saturation hits,
  tracking RMS error, integrated absolute target lag, peak force,
  peak sampled mechanical power, positive/negative mechanical actuator
  work and energy residual.

Three analytic references are included for an UNBOUNDED normalized PD
controller responding to a **unit step** with no external load spring or
viscous load. The exact solution of x'' + kd*x' + kp*x = kp is compared
at t=0.5, 1, 2 against E8's numerical integration. This validates that
particular differential equation implementation, not the friction/contact
physics of a real machine.

## Work/energy ledger

Plant kinetic and load-spring energy:

    E = 0.5*m*v^2 + 0.5*k_load*x^2

Controller-applied mechanical work at each step:

    W_act += F_applied * v * dt

Split W_act into gross positive and negative contributions. Viscous load
work accumulates -c_load*v^2*dt. The numerical residual is:

    (E_final - E_initial) - W_act - W_load_drag.

As in E5–E7, this residual explicitly reflects finite-step integration
and first-order work quadrature. It is not zero by construction, and a
small residual cannot validate the material physics or controller.

## Dynamic lag versus physical hysteresis

To visualize lag, the model accumulates an ordered plot of command versus
actual position for each complete commanded cycle, closes that polygon,
and reports its **absolute geometric area**. This is called the
command-response loop-area proxy.

That quantity is NOT a physical material hysteresis-loop area, dissipation
measurement, calibrated viscoelastic response or evidence that water has
field-tunable structure. Controller gain, load, force/power clipping and
finite integration can produce a loop even with a purely elastic load.

A measured material hysteresis experiment requires calibrated force and
displacement at controlled cycling rates and temperatures, with repeatable
loading/unloading loops and an explicit constitutive model.

## Prospective hardware bench protocol

Before claiming any hardware performance, collect independently observed
samples with at least the following columns:

    elapsed_seconds, command_displacement_m, measured_displacement_m,
    force_newtons, current_amperes, supply_volts, temperature_celsius

Also record the actuator manufacturer/model, sensor types, calibration dates,
sampling frequency, test fixture and calibration uncertainties, controller
firmware/software version, supply and driver settings, and physical load
configuration.

Suggested tests: a no-load step response; loaded step response; symmetric
triangular or smooth position cycle; multiple frequencies; zero-command drift;
force versus velocity and voltage/current measurements; positive/negative
electrical energy and thermal behavior.

Do not import any future empirical samples as SIMULATED or convert simulator
results to OBSERVED. The current repo does not claim data acquisition, sensor
connections, real-world benchmark measurements or independent validation.

## Next milestone, E9

If no hardware data is available, add independently checkable numerical
controller benchmarks and full E7↔E8 coupling with unit-consistent force,
power, mechanical energy and measured/assumed efficiency boundaries.
If actual calibrated data arrives, fit and compare against it with explicit
provenance, holdout tests and uncertainty.

**Ledger above ego. Model before claim.**
