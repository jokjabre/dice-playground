# Throw Logic Reconstruction: Architecture & Execution Plan

This document specifies the end-to-end plan for reconstructing the dice throw logic and visual interaction in `dice-playground`.

---

## 1. Specification & Agreed Behaviors

| Feature | Requirement / Decision |
|---|---|
| **Arrow Interaction** | Starts at mouse/touch down point ($P_{\text{start}}$), tip follows cursor ($P_{\text{current}}$). Arrow base stays anchored at $P_{\text{start}}$. |
| **Max Length ($L_{\text{max}}$)** | Clamped at predetermined maximum distance ($L_{\text{max}} \approx 180\text{--}200\text{px}$). Dragging further clamps tip along the vector ray. |
| **Speed Mapping** | Initial speed is proportional to clamped arrow length (with an ease curve). |
| **Visual Styling** | Dynamic color gradient: Cyan/Teal (soft) $\to$ Amber/Gold (medium) $\to$ Fiery Orange/Red (max). Radial boundary ring at $L_{\text{max}}$ and release snap animation. |
| **Tap / Threshold** | Sub-threshold drags ($< 18\text{px}$) cancel the throw, preserving click-to-select functionality for `RaycastPicker`. |
| **Spawn Origin** | Dice spawn in 3D world space at the unprojected position of $P_{\text{start}}$ at throw height $Z_{\text{spawn}}$. |
| **Collision Prevention** | Dice spawn scattered around $P_{\text{start}}$ with center-to-center distance $\ge \text{die diameter} + \text{margin}$ (rejection/Poisson sampling) and clamped within enclosure boundaries. |
| **Trajectory (Z-axis)** | **Upward lob:** Dice launch with positive $V_z$ upward arc before gravity curves them downward onto the table. |
| **Die Variations** | Individual speed jitter ($\pm 10\text{--}15\%$), angle cone deviation ($\pm 6^\circ\text{--}10^\circ$), randomized 3D spin/tumbling velocity proportional to throw power, and randomized initial orientations. |
| **Continuous Mode** | Does **not** clear or respawn dice. Applies directional impulse, upward pop, and angular spin to **all active dice** with slight random variance per die via `host.applyImpulse()`. |

---

## 2. Atomic Implementation Phases

### Phase 1: Pure Math & Throw Vector Generation (`packages/world`, `packages/input`)
* **Goals:**
  * Implement origin-anchored spawn positioning in `packages/world/src/SpawnProfile.js` and `packages/input/src/gesture.js`.
  * Implement non-overlapping distribution around the origin using collision radius checking.
  * Implement upward arc trajectory ($V_z > 0$) scaled with throw force.
  * Implement per-die speed jitter, horizontal angular cone spread, and 3D rotational spin.
  * Ensure enclosure boundary clamping for box, sphere, and cylinder.
* **Exit Criteria:**
  * Unit tests in `packages/world/test/` and `packages/input/test/gesture.test.js` verify:
    * Deterministic generation with seed.
    * No two dice spawn within collision distance of each other.
    * All spawn positions reside within enclosure bounds.
    * Velocity has positive $V_z$ and appropriate angular variation.

### Phase 2: Continuous Mode Impulse Distribution (`packages/input`, `packages/engine`)
* **Goals:**
  * Add continuous mode detection and impulse dispatch logic in `packages/input/src/PointerInput.js`.
  * Calculate per-die impulse vectors based on the throw vector, adding upward impulse ($+Z$) and randomized torque.
  * Dispatch via `host.applyImpulse(ids, impulse, worldPoint)` without triggering `host.roll()`.
* **Exit Criteria:**
  * Unit tests in `packages/input/test/PointerInput.test.js` confirm:
    * When `host.mode === 'continuous'`, flick gestures call `host.applyImpulse()` across all dice and do NOT call `host.roll()`.
    * Impulses have varied directions and magnitudes per die.

### Phase 3: Interactive SVG Throw Visualizer (`packages/ui` or `packages/input`)
* **Goals:**
  * Implement `ThrowVisualizer` overlay managing a responsive `<svg>` element on the container.
  * Render the directional vector arrow, arrow head, base anchor, and maximum power boundary ring.
  * Dynamic color interpolation based on power ratio: Teal $\to$ Gold $\to$ Red-Orange.
  * Smooth release animation (fade + scale snap) upon pointer up.
  * Auto-hide on sub-threshold drags or pointer cancel.
* **Exit Criteria:**
  * Visualizer tests verify DOM creation, styling, length clamping, and teardown on detach.

### Phase 4: PointerInput & Screen-to-World Projection Integration
* **Goals:**
  * Wire `ThrowVisualizer` lifecycle into `PointerInput` (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
  * Implement screen-to-scene coordinate mapping using camera metrics to convert 2D $P_{\text{start}}$ into 3D world coordinates $(X, Y, Z_{\text{spawn}})$.
  * Wire sub-threshold threshold ($< 18\text{px}$) rejection.
* **Exit Criteria:**
  * Full unit tests in `packages/input/test/PointerInput.test.js` pass with the visualizer and updated gesture pipeline.
  * No regressions in existing tests.

### Phase 5: End-to-End App Integration & Polish
* **Goals:**
  * Validate interaction in `apps/sandbox` in both Standard and Continuous modes.
  * Verify visual lab and other demos (`apps/demos/*`).
  * Run lint, TypeScript checks, and full Vitest suite.
* **Exit Criteria:**
  * `npm test` passes 100%.
  * Manual and automated checks confirm fluid throwing, visual arrow tracking, non-overlapping spawns, and continuous mode impulse tumbling.

---

## 3. Universal Prompt for Sessions / Agents

Below is the universal prompt template you can use to spawn dedicated sessions or subagents for each phase.

```markdown
PHASE: <N>

Execute exactly Phase <N> of the Throw Logic Reconstruction plan and then stop for review.

## Reference Plan
Read the specification and exit criteria for Phase <N> in:
.planning/throw-logic-reconstruction/throw-logic-reconstruction-plan.md

## Toolchain & Environment
- Node 22 LTS and npm system-wide.
- Run tests using: `npm test` or `npx vitest run <target-test-file>`.

## Session Rules
1. Work directly on the current branch.
2. Leave all changes uncommitted; do not run git commit.
3. Only implement the deliverables scoped for Phase <N>. Do not proceed to subsequent phases.
4. Keep diffs focused, maintain existing code style, and preserve documentation comments.
5. All tests must pass before completing the phase.

## Phase Execution Checklist
1. Inspect the relevant source files and tests for Phase <N>.
2. Implement the scoped changes.
3. Add or update unit tests to verify all exit criteria for Phase <N>.
4. Run `npm test` to ensure zero regressions across all packages.
5. Report the final status using the standard report format:
   - PHASE <N> — <title>: DONE | BLOCKED
   - Changed files
   - Implemented features
   - Test results
   - Uncommitted git status
```

