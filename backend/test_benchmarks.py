from qm_solver import QuineMcCluskeySolver

BENCHMARKS = [
    {
        "name": "Standard Worked Example (4-Var with Don't Cares)",
        "vars": 4,
        "minterms": [0, 1, 2, 5, 6, 7, 8, 9, 10, 14],
        "dont_cares": [4, 15],
    },
    {
        "name": "BCD to 7-Segment 'a' Cathode Decoder",
        "vars": 4,
        "minterms": [0, 2, 3, 5, 6, 7, 8, 9],
        "dont_cares": [10, 11, 12, 13, 14, 15],
    },
    {
        "name": "4-Bit Prime Number Detector",
        "vars": 4,
        "minterms": [2, 3, 5, 7, 11, 13],
        "dont_cares": [],
    },
    {
        "name": "5-Variable Majority + Parity Benchmark",
        "vars": 5,
        "minterms": [0, 1, 4, 5, 16, 17, 20, 21, 23, 29, 31],
        "dont_cares": [2, 18],
    },
]


def run_suite():
    print("=" * 74)
    print(" LOGICBENCH — QUINE-McCLUSKEY ALGORITHMIC VERIFICATION SUITE")
    print("=" * 74)
    for idx, b in enumerate(BENCHMARKS, 1):
        solver = QuineMcCluskeySolver(b["vars"], b["minterms"], b["dont_cares"])
        res = solver.solve_minimum_cover()
        m = res["hardware_metrics"]
        print(f"\n[{idx}] {b['name']}")
        print(f"    Inputs           : {b['vars']} Variables | Minterms: {b['minterms']}")
        print(f"    Don't Cares      : {b['dont_cares'] or 'None'}")
        print(f"    Minimal SOP      : F = {res['minimal_sop']}")
        print(f"    Essential PIs    : {', '.join(res['essential_pis']) or 'Cyclic (Petrick Cover)'}")
        print(
            f"    Hardware Savings : {m['canonical_literals']} -> {m['minimized_literals']} literals "
            f"({m['literal_reduction_pct']}% reduction)"
        )
    print("\n" + "=" * 74)


if __name__ == "__main__":
    run_suite()