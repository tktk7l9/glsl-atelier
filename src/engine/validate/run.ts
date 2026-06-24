// Orchestration: run every validator against one snapshot and collect failures.

import { runSpec, type ValidatorSpec } from "./primitives.js";
import type { Snapshot, ValidationResult } from "./snapshot.js";

export interface Evaluation {
  readonly passed: boolean;
  readonly results: readonly ValidationResult[];
  readonly failures: readonly string[];
}

export function evaluate(
  specs: readonly ValidatorSpec[],
  snapshot: Snapshot,
): Evaluation {
  const results = specs.map((spec) => runSpec(spec, snapshot));
  const failures = results.filter((r) => !r.pass).map((r) => r.message);
  return { passed: failures.length === 0, results, failures };
}
