from itertools import combinations
from typing import List, Set, Dict, Tuple


class QuineMcCluskeySolver:
    """
    Exact Boolean Expression Simplification Engine using the
    Quine-McCluskey (Tabular) Method and Exact Minimum Literal Cover.
    """

    def __init__(self, num_vars: int, minterms: List[int], dont_cares: List[int] = None):
        if num_vars < 2 or num_vars > 8:
            raise ValueError("num_vars must be between 2 and 8.")
        self.num_vars = num_vars
        self.vars = [chr(65 + i) for i in range(num_vars)]  # ['A', 'B', 'C', 'D', ...]
        self.minterms = sorted(list(set(minterms)))
        self.dont_cares = sorted(list(set(dont_cares or []) - set(self.minterms)))
        self.all_terms = sorted(self.minterms + self.dont_cares)

    def _to_bin(self, n: int) -> str:
        return format(n, f'0{self.num_vars}b')

    def _can_combine(self, t1: str, t2: str) -> Tuple[bool, str]:
        diff = 0
        res = []
        for b1, b2 in zip(t1, t2):
            if b1 != b2:
                diff += 1
                res.append('-')
                if diff > 1:
                    return False, ""
            else:
                res.append(b1)
        return diff == 1, "".join(res)

    def _term_to_expr(self, term: str) -> str:
        if term == '-' * self.num_vars:
            return "1"
        literals = []
        for var, bit in zip(self.vars, term):
            if bit == '1':
                literals.append(var)
            elif bit == '0':
                literals.append(f"{var}'")
        return "".join(literals)

    def find_prime_implicants(self) -> Tuple[Dict[str, Set[int]], List[Dict]]:
        """Executes Phase 1: Tabular grouping and iterative Hamming-1 merging."""
        current_groups: Dict[int, Dict[str, Set[int]]] = {}
        for m in self.all_terms:
            b = self._to_bin(m)
            ones = b.count('1')
            current_groups.setdefault(ones, {})[b] = {m}

        prime_implicants: Dict[str, Set[int]] = {}
        steps_history = []

        while current_groups:
            step_snapshot = {
                k: {term: sorted(list(cov)) for term, cov in v.items()}
                for k, v in sorted(current_groups.items())
            }
            steps_history.append(step_snapshot)

            next_groups: Dict[int, Dict[str, Set[int]]] = {}
            combined_in_round: Set[str] = set()
            group_keys = sorted(current_groups.keys())

            for i in range(len(group_keys) - 1):
                g1, g2 = group_keys[i], group_keys[i + 1]
                if g2 - g1 != 1:
                    continue
                for t1, cov1 in current_groups[g1].items():
                    for t2, cov2 in current_groups[g2].items():
                        ok, merged = self._can_combine(t1, t2)
                        if ok:
                            combined_in_round.add(t1)
                            combined_in_round.add(t2)
                            ones = merged.count('1')
                            next_groups.setdefault(ones, {})
                            if merged not in next_groups[ones]:
                                next_groups[ones][merged] = set()
                            next_groups[ones][merged].update(cov1 | cov2)

            for g in current_groups.values():
                for term, cov in g.items():
                    if term not in combined_in_round:
                        prime_implicants[term] = cov

            current_groups = next_groups

        return prime_implicants, steps_history

    def solve_minimum_cover(self) -> Dict:
        """Executes Phase 2: Essential PI extraction + Petrick's Minimum Cover."""
        if not self.minterms:
            return {
                "minimal_sop": "0",
                "all_prime_implicants": {},
                "essential_pis": [],
                "selected_pis": [],
                "hardware_metrics": {
                    "canonical_literals": 0,
                    "minimized_literals": 0,
                    "literal_reduction_pct": 0.0,
                    "and_gates": 0,
                    "or_gates": 0,
                },
                "tabular_steps": [],
            }

        if len(self.all_terms) == (1 << self.num_vars):
            tautology_mask = '-' * self.num_vars
            return {
                "minimal_sop": "1",
                "all_prime_implicants": {
                    tautology_mask: {"expr": "1", "covers": self.all_terms}
                },
                "essential_pis": ["1"],
                "selected_pis": ["1"],
                "hardware_metrics": {
                    "canonical_literals": len(self.minterms) * self.num_vars,
                    "minimized_literals": 0,
                    "literal_reduction_pct": 100.0,
                    "and_gates": 0,
                    "or_gates": 0,
                },
                "tabular_steps": [],
            }

        pis, steps = self.find_prime_implicants()
        uncovered = set(self.minterms)
        essential_pis: List[str] = []

        minterm_to_pis = {
            m: [pi for pi, cov in pis.items() if m in cov]
            for m in self.minterms
        }

        for m, covering_pis in minterm_to_pis.items():
            if len(covering_pis) == 1:
                epi = covering_pis[0]
                if epi not in essential_pis:
                    essential_pis.append(epi)

        for epi in essential_pis:
            uncovered -= pis[epi]

        selected_pis = list(essential_pis)

        # Exact minimum cover for remaining cyclic minterms
        if uncovered:
            remaining_pis = [
                pi for pi in pis if pi not in selected_pis and (pis[pi] & uncovered)
            ]
            best_extra = None
            for r in range(1, len(remaining_pis) + 1):
                valid_combos = []
                for combo in combinations(remaining_pis, r):
                    cov = set().union(*(pis[pi] for pi in combo))
                    if uncovered.issubset(cov):
                        literal_cost = sum(
                            self.num_vars - pi.count('-') for pi in combo
                        )
                        valid_combos.append((literal_cost, combo))
                if valid_combos:
                    valid_combos.sort(key=lambda x: x[0])
                    best_extra = list(valid_combos[0][1])
                    break
            if best_extra:
                selected_pis.extend(best_extra)

        expr_terms = [self._term_to_expr(pi) for pi in selected_pis]
        final_expr = " + ".join(expr_terms) if expr_terms else "0"

        canon_literals = len(self.minterms) * self.num_vars
        min_literals = sum(self.num_vars - pi.count('-') for pi in selected_pis)

        return {
            "minimal_sop": final_expr,
            "all_prime_implicants": {
                pi: {"expr": self._term_to_expr(pi), "covers": sorted(list(cov))}
                for pi, cov in pis.items()
            },
            "essential_pis": [self._term_to_expr(pi) for pi in essential_pis],
            "selected_pis": [self._term_to_expr(pi) for pi in selected_pis],
            "hardware_metrics": {
                "canonical_literals": canon_literals,
                "minimized_literals": min_literals,
                "literal_reduction_pct": round(
                    (1 - min_literals / max(1, canon_literals)) * 100, 1
                ),
                "and_gates": sum(
                    1 for pi in selected_pis if (self.num_vars - pi.count('-')) > 1
                ),
                "or_gates": 1 if len(selected_pis) > 1 else 0,
            },
            "tabular_steps": steps,
        }


if __name__ == "__main__":
    solver = QuineMcCluskeySolver(
        4, minterms=[0, 1, 2, 5, 6, 7, 8, 9, 10, 14], dont_cares=[4, 15]
    )
    result = solver.solve_minimum_cover()
    print(f"Minimal SOP  : F = {result['minimal_sop']}")
    print(f"Essential PIs: {result['essential_pis']}")
    print(f"Metrics      : {result['hardware_metrics']}")