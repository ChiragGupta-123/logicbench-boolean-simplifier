# Minor Project Report: Boolean Expression Simplification & Synthesis Workbench

## 1. Abstract
This project implements an exact algorithmic Boolean Expression Simplification engine and interactive digital logic synthesis workbench (**LogicBench**). By combining the **Quine-McCluskey (Tabular) Method** with **Petrick's Exact Minimum Literal Cover**, the system eliminates the 4-variable visual ceiling of manual Karnaugh Maps while computing hardware literal savings, two-level AND-OR gate schematics, and IEEE-1364 Verilog HDL netlists in real time.

## 2. Methodology & Two-Phase Algorithmic Pipeline
1. **Phase 1 — Prime Implicant Generation (Quine-McCluskey):**
   - Canonical minterms ($\sum m$) and Don't Care terms ($\sum d$) are converted into $n$-bit binary strings and partitioned by their Hamming weight (number of `1` bits).
   - Adjacent Hamming groups $(k, k+1)$ are compared iteratively. Any pair differing by a Hamming distance of $1$ is merged by replacing the differing bit position with `-`.
   - Uncombined implicants across each pass are extracted as **Prime Implicants (PIs)**.
2. **Phase 2 — Essential Prime Implicant Extraction & Minimum Cover:**
   - A Prime Implicant Coverage Matrix maps all PIs against strictly required minterms ($\sum m$, excluding Don't Cares).
   - Columns covered by a single PI identify **Essential Prime Implicants (EPIs)**.
   - Any remaining uncovered cyclic minterms are solved by evaluating minimal combinations weighted by literal count.

## 3. Worked Algorithmic Trace
**Problem Statement:** Simplify $F(A, B, C, D) = \sum m(0, 1, 2, 5, 6, 7, 8, 9, 10, 14) + d(4, 15)$

- **Extracted Prime Implicants:**
  - $PI_1 = \text{`-00-`} \ (0, 1, 8, 9) \rightarrow B'C'$
  - $PI_2 = \text{`-0-0`} \ (0, 2, 8, 10) \rightarrow B'D'$
  - $PI_3 = \text{`0--0`} \ (0, 2, 4_d, 6) \rightarrow A'D'$
  - $PI_4 = \text{`01--`} \ (4_d, 5, 6, 7) \rightarrow A'B$
  - $PI_5 = \text{`--10`} \ (2, 6, 10, 14) \rightarrow CD'$
  - $PI_6 = \text{`-11-`} \ (6, 7, 14, 15_d) \rightarrow BC$
- **Essential Selection:**
  - Minterm $9$ is uniquely covered by $B'C'$ ($\star$ EPI).
  - Minterm $5$ is uniquely covered by $A'B$ ($\star$ EPI).
  - Remaining uncovered minterms $\{2, 10, 14\}$ are completely covered by $CD'$.
- **Minimal SOP Output:** $F(A, B, C, D) = B'C' + A'B + CD'$
- **Hardware Reduction:** Canonical literals reduced from $40$ to $6$ (**85.0% reduction**).