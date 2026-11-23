# SafeSend evaluation. SYNTHETIC: rule behavior on hand-written cases, not fraud prevented.

Shipped default: 3/4. Differences of one or two cases are not meaningful at this sample size.

## Holdout v1 (SYNTHETIC)

20 attack cases, 20 legitimate sends. Rates show raw counts and Wilson 95% intervals.

### Attacks

| Rule                    | Blocked                | Strong friction (BLOCK or middle-char WARN) | Flagged at all           | Caught by lookalike/provenance signal | Strong friction from amount rule only |
| ----------------------- | ---------------------- | ------------------------------------------- | ------------------------ | ------------------------------------- | ------------------------------------- |
| 3/3                     | 16/20 (80%, CI 58–92%) | 19/20 (95%, CI 76–99%)                      | 20/20 (100%, CI 84–100%) | 19/20 (95%, CI 76–99%)                | 0                                     |
| 3/4                     | 15/20 (75%, CI 53–89%) | 18/20 (90%, CI 70–97%)                      | 20/20 (100%, CI 84–100%) | 18/20 (90%, CI 70–97%)                | 0                                     |
| 4/4                     | 14/20 (70%, CI 48–85%) | 17/20 (85%, CI 64–95%)                      | 20/20 (100%, CI 84–100%) | 16/20 (80%, CI 58–92%)                | 1                                     |
| 4/5                     | 4/20 (20%, CI 8–42%)   | 16/20 (80%, CI 58–92%)                      | 20/20 (100%, CI 84–100%) | 4/20 (20%, CI 8–42%)                  | 12                                    |
| total>=6 (>=2 each end) | 17/20 (85%, CI 64–95%) | 20/20 (100%, CI 84–100%)                    | 20/20 (100%, CI 84–100%) | 20/20 (100%, CI 84–100%)              | 0                                     |

### Legitimate sends by friction

| Rule                    | ALLOW | Checkbox WARN         | Middle-char WARN      | BLOCK               |
| ----------------------- | ----- | --------------------- | --------------------- | ------------------- |
| 3/3                     | 8     | 3/20 (15%, CI 5–36%)  | 8/20 (40%, CI 22–61%) | 1/20 (5%, CI 1–24%) |
| 3/4                     | 8     | 4/20 (20%, CI 8–42%)  | 7/20 (35%, CI 18–57%) | 1/20 (5%, CI 1–24%) |
| 4/4                     | 8     | 6/20 (30%, CI 15–52%) | 6/20 (30%, CI 15–52%) | 0/20 (0%, CI 0–16%) |
| 4/5                     | 8     | 7/20 (35%, CI 18–57%) | 5/20 (25%, CI 11–47%) | 0/20 (0%, CI 0–16%) |
| total>=6 (>=2 each end) | 8     | 3/20 (15%, CI 5–36%)  | 8/20 (40%, CI 22–61%) | 1/20 (5%, CI 1–24%) |

### Confusion matrix per level

| Rule                    | Level   | TP  | FN  | FP  | TN  | Precision | Recall |
| ----------------------- | ------- | --- | --- | --- | --- | --------- | ------ |
| 3/3                     | blocked | 16  | 4   | 1   | 19  | 0.94      | 0.80   |
| 3/3                     | strong  | 19  | 1   | 9   | 11  | 0.68      | 0.95   |
| 3/3                     | flagged | 20  | 0   | 12  | 8   | 0.63      | 1.00   |
| 3/4                     | blocked | 15  | 5   | 1   | 19  | 0.94      | 0.75   |
| 3/4                     | strong  | 18  | 2   | 8   | 12  | 0.69      | 0.90   |
| 3/4                     | flagged | 20  | 0   | 12  | 8   | 0.63      | 1.00   |
| 4/4                     | blocked | 14  | 6   | 0   | 20  | 1.00      | 0.70   |
| 4/4                     | strong  | 17  | 3   | 6   | 14  | 0.74      | 0.85   |
| 4/4                     | flagged | 20  | 0   | 12  | 8   | 0.63      | 1.00   |
| 4/5                     | blocked | 4   | 16  | 0   | 20  | 1.00      | 0.20   |
| 4/5                     | strong  | 16  | 4   | 5   | 15  | 0.76      | 0.80   |
| 4/5                     | flagged | 20  | 0   | 12  | 8   | 0.63      | 1.00   |
| total>=6 (>=2 each end) | blocked | 17  | 3   | 1   | 19  | 0.94      | 0.85   |
| total>=6 (>=2 each end) | strong  | 20  | 0   | 9   | 11  | 0.69      | 1.00   |
| total>=6 (>=2 each end) | flagged | 20  | 0   | 12  | 8   | 0.63      | 1.00   |

### Misses (attack reached ALLOW or only a checkbox WARN)

- **3/3**: H-A09 (WARN_CHECKBOX)
- **3/4**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX)
- **4/4**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX), H-A20 (WARN_CHECKBOX)
- **4/5**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX), H-A16 (WARN_CHECKBOX), H-A20 (WARN_CHECKBOX)
- **total>=6 (>=2 each end)**: none

### Outcome per case

| Case  | 3/3           | 3/4           | 4/4           | 4/5           | total>=6 (>=2 each end) |
| ----- | ------------- | ------------- | ------------- | ------------- | ----------------------- |
| H-A01 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A02 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| H-A03 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A04 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| H-A05 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A06 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A07 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-A08 | BLOCK         | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | BLOCK                   |
| H-A09 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | BLOCK                   |
| H-A10 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| H-A11 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-A12 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A13 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A14 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A15 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A16 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX | BLOCK                   |
| H-A17 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| H-A18 | BLOCK         | BLOCK         | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| H-A19 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| H-A20 | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX | WARN_STRONG             |
| H-L01 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L02 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L03 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L04 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| H-L05 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-L06 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-L07 | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_STRONG             |
| H-L08 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_STRONG             |
| H-L09 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-L10 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-L11 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| H-L12 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| H-L13 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L14 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L15 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L16 | BLOCK         | BLOCK         | WARN_CHECKBOX | WARN_CHECKBOX | BLOCK                   |
| H-L17 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| H-L18 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| H-L19 | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX | WARN_STRONG             |
| H-L20 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |

## Dev set (SYNTHETIC)

40 attack cases, 40 legitimate sends. Rates show raw counts and Wilson 95% intervals.

### Attacks

| Rule                    | Blocked                | Strong friction (BLOCK or middle-char WARN) | Flagged at all           | Caught by lookalike/provenance signal | Strong friction from amount rule only |
| ----------------------- | ---------------------- | ------------------------------------------- | ------------------------ | ------------------------------------- | ------------------------------------- |
| 3/3                     | 17/40 (43%, CI 29–58%) | 36/40 (90%, CI 77–96%)                      | 40/40 (100%, CI 91–100%) | 25/40 (63%, CI 47–76%)                | 11                                    |
| 3/4                     | 12/40 (30%, CI 18–45%) | 36/40 (90%, CI 77–96%)                      | 40/40 (100%, CI 91–100%) | 17/40 (43%, CI 29–58%)                | 19                                    |
| 4/4                     | 11/40 (28%, CI 16–43%) | 36/40 (90%, CI 77–96%)                      | 40/40 (100%, CI 91–100%) | 15/40 (38%, CI 24–53%)                | 21                                    |
| 4/5                     | 5/40 (13%, CI 5–26%)   | 31/40 (78%, CI 62–88%)                      | 40/40 (100%, CI 91–100%) | 6/40 (15%, CI 7–29%)                  | 25                                    |
| total>=6 (>=2 each end) | 23/40 (57%, CI 42–71%) | 38/40 (95%, CI 83–99%)                      | 40/40 (100%, CI 91–100%) | 34/40 (85%, CI 71–93%)                | 4                                     |

### Legitimate sends by friction

| Rule                    | ALLOW | Checkbox WARN         | Middle-char WARN       | BLOCK              |
| ----------------------- | ----- | --------------------- | ---------------------- | ------------------ |
| 3/3                     | 10    | 9/40 (23%, CI 12–38%) | 21/40 (53%, CI 37–67%) | 0/40 (0%, CI 0–9%) |
| 3/4                     | 10    | 9/40 (23%, CI 12–38%) | 21/40 (53%, CI 37–67%) | 0/40 (0%, CI 0–9%) |
| 4/4                     | 10    | 9/40 (23%, CI 12–38%) | 21/40 (53%, CI 37–67%) | 0/40 (0%, CI 0–9%) |
| 4/5                     | 10    | 9/40 (23%, CI 12–38%) | 21/40 (53%, CI 37–67%) | 0/40 (0%, CI 0–9%) |
| total>=6 (>=2 each end) | 10    | 8/40 (20%, CI 10–35%) | 22/40 (55%, CI 40–69%) | 0/40 (0%, CI 0–9%) |

### Confusion matrix per level

| Rule                    | Level   | TP  | FN  | FP  | TN  | Precision | Recall |
| ----------------------- | ------- | --- | --- | --- | --- | --------- | ------ |
| 3/3                     | blocked | 17  | 23  | 0   | 40  | 1.00      | 0.42   |
| 3/3                     | strong  | 36  | 4   | 21  | 19  | 0.63      | 0.90   |
| 3/3                     | flagged | 40  | 0   | 30  | 10  | 0.57      | 1.00   |
| 3/4                     | blocked | 12  | 28  | 0   | 40  | 1.00      | 0.30   |
| 3/4                     | strong  | 36  | 4   | 21  | 19  | 0.63      | 0.90   |
| 3/4                     | flagged | 40  | 0   | 30  | 10  | 0.57      | 1.00   |
| 4/4                     | blocked | 11  | 29  | 0   | 40  | 1.00      | 0.28   |
| 4/4                     | strong  | 36  | 4   | 21  | 19  | 0.63      | 0.90   |
| 4/4                     | flagged | 40  | 0   | 30  | 10  | 0.57      | 1.00   |
| 4/5                     | blocked | 5   | 35  | 0   | 40  | 1.00      | 0.13   |
| 4/5                     | strong  | 31  | 9   | 21  | 19  | 0.60      | 0.78   |
| 4/5                     | flagged | 40  | 0   | 30  | 10  | 0.57      | 1.00   |
| total>=6 (>=2 each end) | blocked | 23  | 17  | 0   | 40  | 1.00      | 0.57   |
| total>=6 (>=2 each end) | strong  | 38  | 2   | 22  | 18  | 0.63      | 0.95   |
| total>=6 (>=2 each end) | flagged | 40  | 0   | 30  | 10  | 0.57      | 1.00   |

### Misses (attack reached ALLOW or only a checkbox WARN)

- **3/3**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **3/4**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **4/4**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **4/5**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A08 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A16 (WARN_CHECKBOX), D-A17 (WARN_CHECKBOX), D-A22 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX), D-A34 (WARN_CHECKBOX)
- **total>=6 (>=2 each end)**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX)

### Outcome per case

| Case  | 3/3           | 3/4           | 4/4           | 4/5           | total>=6 (>=2 each end) |
| ----- | ------------- | ------------- | ------------- | ------------- | ----------------------- |
| D-A01 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| D-A02 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-A03 | BLOCK         | BLOCK         | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A04 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A05 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-A06 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A07 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A08 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_STRONG             |
| D-A09 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A10 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| D-A11 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A12 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_STRONG             |
| D-A13 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A14 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| D-A15 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A16 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_STRONG             |
| D-A17 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX | BLOCK                   |
| D-A18 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A19 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A20 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A21 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A22 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX | BLOCK                   |
| D-A23 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| D-A24 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A25 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A26 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| D-A27 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A28 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A29 | BLOCK         | BLOCK         | BLOCK         | BLOCK         | BLOCK                   |
| D-A30 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | BLOCK                   |
| D-A31 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A32 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A33 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A34 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX | BLOCK                   |
| D-A35 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A36 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A37 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-A38 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| D-A39 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | BLOCK                   |
| D-A40 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   | BLOCK                   |
| D-L01 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L02 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L03 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L04 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L05 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L06 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L07 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_STRONG             |
| D-L08 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L09 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L10 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L11 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L12 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L13 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L14 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L15 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L16 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L17 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L18 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L19 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L20 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L21 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L22 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L23 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L24 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L25 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L26 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L27 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L28 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L29 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L30 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L31 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L32 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L33 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L34 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L35 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L36 | ALLOW         | ALLOW         | ALLOW         | ALLOW         | ALLOW                   |
| D-L37 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L38 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
| D-L39 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX           |
| D-L40 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG             |
