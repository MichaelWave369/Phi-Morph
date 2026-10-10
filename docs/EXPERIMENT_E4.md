# Φ-Morph E4 / PM-E4-0.5.0: discrete-contact rolling laboratory

## Scope

E3 established a vertical-only hub with upward unilateral ground reaction for a compliant point-spring shell, but no rotation, lateral movement or friction. E4 introduces those missing degrees of freedom in a separate rigid-outline test rig so friction and motor torque can be isolated.

E4 does not extend E3's deformable spring-cell solver. It uses a simplified rigid body with 24 circular contact nodes. E3 and E4 results cannot be compared as if they shared the same masses, mechanics and forces.

## Fixed numerical model

- Discrete rigid outlines: circle and rounded-square, each 24 points with initial normalized RMS radius 2.65.
- Rounded-square samples use signed superellipse parameterization, sine/cosine powers of 0.5, forming a rounded-square-like perimeter.
- Both shapes remain STATIC through each simulation. There is no active morphing or deformation energy.
- Numerical contact node radius 0.17; the drawn perimeter segments are purely visual and cannot collide.
- Hub state x, y, theta, vx, vy and angular speed omega. Initial ground clearance 0.03.
- Mass 6, planar moment of inertia 13 and downward applied normalized load.
- Clockwise positive torque command creates a negative planar z-torque, not a physical drivetrain.
- Floor at y=0 applies upward compression-only penalty reaction with stiffness 90 and closing-speed damping 2.6.
- Friction law: Ft = -mu * Fn * tanh(contactVelocityX / 0.2), so its absolute value never exceeds mu * Fn.
- Translation damping 0.03 and angular damping 0.025.
- Semi-implicit Euler dt=0.005, duration 6, 1200 integration steps.

Rigid-body contact velocity includes both hub translation and rotational motion. Upward normal and horizontal friction reactions also exert a torque around the hub.

## Frozen study

At the chosen load (0.5, 1, 2 or 4), run 2 outlines x 3 friction coefficients (0, 0.35, 0.8) x 3 torque commands (0, 0.8, 1.6) = 18 simulated cases.

Two additional negative controls disable the ground entirely for one case per shape at maximum torque and friction. Both ground impulses and horizontal translation must be exactly zero. Zero-friction cases must likewise have zero tangential impulse and zero horizontal translation, even if motor torque spins the body. Zero torque is an additional baseline, although asymmetric contact can create rotation.

## Observables

- Hub horizontal displacement and vertical drop.
- Final angular position and velocity.
- Fraction of steps with a contact node.
- Peak numerical penetration and normal reaction.
- Integrated normal and tangential force impulses.
- Mean absolute contact slip-speed proxy.
- Dissipative friction work proxy, signed motor work proxy and final rigid-body kinetic-energy proxy.
- Deterministic sampled playback frames.
- JSON receipts with SIMULATED provenance and physicalValidation NONE, and 18-case CSV.

These are dimensionless numerical metrics, not meters, seconds, newtons, joules or real tire performance. Friction work is nonnegative under the assumed regularization. A full energy balance is NOT provided.

## Falsification

1. Exactly 24 sampled nodes, matched centroids and RMS initial radii.
2. Contact produces no force without overlap and never negative upward force.
3. Magnitude of tangential force is bounded by friction coefficient times normal reaction and opposes slip.
4. With friction coefficient zero, motor torque produces no horizontal ground impulse.
5. With contact disabled, both ground impulses and horizontal displacement are zero.
6. All 18 nominal study cases remain finite and repeatable.
7. Exactly 18 contact cases and two no-ground negative controls per versioned receipt.

## Known confounders

The outline is rigid, not an actuated soft shell. Only points contact the ground; there is no continuous tire tread, intercell membrane, air or water. Static friction/stiction, steering, rolling resistance, calibrated slip, road texture, vehicle acceleration/braking distance, fatigue, material yield, hydrostatics and electric fields are absent. Equal RMS radius does not ensure equal outer envelope or contact support radius. Torque and gravity/load can create bouncing in the coarse 24-point solver.

A favorable modeled travel or slip value is not evidence of a superior vehicle wheel. Changing the outline is cost-free only because it is never attempted in E4.

## E5 gates

Evaluate sensitivity to timestep and rim discretization. Add an explicit force/energy budget with motor, load and damping terms. Then introduce *force-consistent* actuated shape change with measured work; benchmark against independent continuum/contact methods before physical engineering claims.

**Ledger above ego. Model before claim.**
