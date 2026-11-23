# SafeSend evaluation. SYNTHETIC: rule behavior on hand-written cases, not fraud prevented.

Shipped default: 3/4. Differences of one or two cases are not meaningful at this sample size.

## Holdout v1 (SYNTHETIC)

20 attack cases, 20 legitimate sends. Rates show raw counts and Wilson 95% intervals.

### Attacks

| Rule | Blocked                | Strong friction (BLOCK or middle-char WARN) | Flagged at all           | Caught by lookalike/provenance signal | Strong friction from amount rule only |
| ---- | ---------------------- | ------------------------------------------- | ------------------------ | ------------------------------------- | ------------------------------------- |
| 3/3  | 15/20 (75%, CI 53–89%) | 18/20 (90%, CI 70–97%)                      | 20/20 (100%, CI 84–100%) | 18/20 (90%, CI 70–97%)                | 0                                     |
| 3/4  | 14/20 (70%, CI 48–85%) | 17/20 (85%, CI 64–95%)                      | 20/20 (100%, CI 84–100%) | 17/20 (85%, CI 64–95%)                | 0                                     |
| 4/4  | 13/20 (65%, CI 43–82%) | 16/20 (80%, CI 58–92%)                      | 20/20 (100%, CI 84–100%) | 15/20 (75%, CI 53–89%)                | 1                                     |
| 4/5  | 4/20 (20%, CI 8–42%)   | 16/20 (80%, CI 58–92%)                      | 20/20 (100%, CI 84–100%) | 4/20 (20%, CI 8–42%)                  | 12                                    |

### Legitimate sends by friction

| Rule | ALLOW | Checkbox WARN         | Middle-char WARN      | BLOCK               |
| ---- | ----- | --------------------- | --------------------- | ------------------- |
| 3/3  | 9     | 3/20 (15%, CI 5–36%)  | 7/20 (35%, CI 18–57%) | 1/20 (5%, CI 1–24%) |
| 3/4  | 9     | 4/20 (20%, CI 8–42%)  | 6/20 (30%, CI 15–52%) | 1/20 (5%, CI 1–24%) |
| 4/4  | 9     | 6/20 (30%, CI 15–52%) | 5/20 (25%, CI 11–47%) | 0/20 (0%, CI 0–16%) |
| 4/5  | 9     | 7/20 (35%, CI 18–57%) | 4/20 (20%, CI 8–42%)  | 0/20 (0%, CI 0–16%) |

### Confusion matrix per level

| Rule | Level   | TP  | FN  | FP  | TN  | Precision | Recall |
| ---- | ------- | --- | --- | --- | --- | --------- | ------ |
| 3/3  | blocked | 15  | 5   | 1   | 19  | 0.94      | 0.75   |
| 3/3  | strong  | 18  | 2   | 8   | 12  | 0.69      | 0.90   |
| 3/3  | flagged | 20  | 0   | 11  | 9   | 0.65      | 1.00   |
| 3/4  | blocked | 14  | 6   | 1   | 19  | 0.93      | 0.70   |
| 3/4  | strong  | 17  | 3   | 7   | 13  | 0.71      | 0.85   |
| 3/4  | flagged | 20  | 0   | 11  | 9   | 0.65      | 1.00   |
| 4/4  | blocked | 13  | 7   | 0   | 20  | 1.00      | 0.65   |
| 4/4  | strong  | 16  | 4   | 5   | 15  | 0.76      | 0.80   |
| 4/4  | flagged | 20  | 0   | 11  | 9   | 0.65      | 1.00   |
| 4/5  | blocked | 4   | 16  | 0   | 20  | 1.00      | 0.20   |
| 4/5  | strong  | 16  | 4   | 4   | 16  | 0.80      | 0.80   |
| 4/5  | flagged | 20  | 0   | 11  | 9   | 0.65      | 1.00   |

### Misses (attack reached ALLOW or only a checkbox WARN)

- **3/3**: H-A09 (WARN_CHECKBOX), H-A16 (WARN_CHECKBOX)
- **3/4**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX), H-A16 (WARN_CHECKBOX)
- **4/4**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX), H-A16 (WARN_CHECKBOX), H-A20 (WARN_CHECKBOX)
- **4/5**: H-A08 (WARN_CHECKBOX), H-A09 (WARN_CHECKBOX), H-A16 (WARN_CHECKBOX), H-A20 (WARN_CHECKBOX)

### Outcome per case

| Case  | 3/3           | 3/4           | 4/4           | 4/5           |
| ----- | ------------- | ------------- | ------------- | ------------- |
| H-A01 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A02 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| H-A03 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A04 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| H-A05 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A06 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A07 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-A08 | BLOCK         | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-A09 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-A10 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| H-A11 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-A12 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A13 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A14 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A15 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A16 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-A17 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| H-A18 | BLOCK         | BLOCK         | WARN_STRONG   | WARN_STRONG   |
| H-A19 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| H-A20 | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L01 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L02 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L03 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L04 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L05 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-L06 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-L07 | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L08 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX |
| H-L09 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-L10 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L11 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| H-L12 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L13 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L14 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L15 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L16 | BLOCK         | BLOCK         | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L17 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L18 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| H-L19 | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX | WARN_CHECKBOX |
| H-L20 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |

## Dev set (SYNTHETIC)

30 attack cases, 30 legitimate sends. Rates show raw counts and Wilson 95% intervals.

### Attacks

| Rule | Blocked                | Strong friction (BLOCK or middle-char WARN) | Flagged at all           | Caught by lookalike/provenance signal | Strong friction from amount rule only |
| ---- | ---------------------- | ------------------------------------------- | ------------------------ | ------------------------------------- | ------------------------------------- |
| 3/3  | 12/30 (40%, CI 25–58%) | 26/30 (87%, CI 70–95%)                      | 30/30 (100%, CI 89–100%) | 19/30 (63%, CI 46–78%)                | 7                                     |
| 3/4  | 9/30 (30%, CI 17–48%)  | 26/30 (87%, CI 70–95%)                      | 30/30 (100%, CI 89–100%) | 14/30 (47%, CI 30–64%)                | 12                                    |
| 4/4  | 8/30 (27%, CI 14–44%)  | 26/30 (87%, CI 70–95%)                      | 30/30 (100%, CI 89–100%) | 12/30 (40%, CI 25–58%)                | 14                                    |
| 4/5  | 5/30 (17%, CI 7–34%)   | 22/30 (73%, CI 56–86%)                      | 30/30 (100%, CI 89–100%) | 6/30 (20%, CI 10–37%)                 | 16                                    |

### Legitimate sends by friction

| Rule | ALLOW | Checkbox WARN         | Middle-char WARN       | BLOCK               |
| ---- | ----- | --------------------- | ---------------------- | ------------------- |
| 3/3  | 13    | 7/30 (23%, CI 12–41%) | 10/30 (33%, CI 19–51%) | 0/30 (0%, CI 0–11%) |
| 3/4  | 13    | 7/30 (23%, CI 12–41%) | 10/30 (33%, CI 19–51%) | 0/30 (0%, CI 0–11%) |
| 4/4  | 13    | 7/30 (23%, CI 12–41%) | 10/30 (33%, CI 19–51%) | 0/30 (0%, CI 0–11%) |
| 4/5  | 13    | 7/30 (23%, CI 12–41%) | 10/30 (33%, CI 19–51%) | 0/30 (0%, CI 0–11%) |

### Confusion matrix per level

| Rule | Level   | TP  | FN  | FP  | TN  | Precision | Recall |
| ---- | ------- | --- | --- | --- | --- | --------- | ------ |
| 3/3  | blocked | 12  | 18  | 0   | 30  | 1.00      | 0.40   |
| 3/3  | strong  | 26  | 4   | 10  | 20  | 0.72      | 0.87   |
| 3/3  | flagged | 30  | 0   | 17  | 13  | 0.64      | 1.00   |
| 3/4  | blocked | 9   | 21  | 0   | 30  | 1.00      | 0.30   |
| 3/4  | strong  | 26  | 4   | 10  | 20  | 0.72      | 0.87   |
| 3/4  | flagged | 30  | 0   | 17  | 13  | 0.64      | 1.00   |
| 4/4  | blocked | 8   | 22  | 0   | 30  | 1.00      | 0.27   |
| 4/4  | strong  | 26  | 4   | 10  | 20  | 0.72      | 0.87   |
| 4/4  | flagged | 30  | 0   | 17  | 13  | 0.64      | 1.00   |
| 4/5  | blocked | 5   | 25  | 0   | 30  | 1.00      | 0.17   |
| 4/5  | strong  | 22  | 8   | 10  | 20  | 0.69      | 0.73   |
| 4/5  | flagged | 30  | 0   | 17  | 13  | 0.64      | 1.00   |

### Misses (attack reached ALLOW or only a checkbox WARN)

- **3/3**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **3/4**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **4/4**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)
- **4/5**: D-A02 (WARN_CHECKBOX), D-A05 (WARN_CHECKBOX), D-A08 (WARN_CHECKBOX), D-A12 (WARN_CHECKBOX), D-A16 (WARN_CHECKBOX), D-A17 (WARN_CHECKBOX), D-A22 (WARN_CHECKBOX), D-A30 (WARN_CHECKBOX)

### Outcome per case

| Case  | 3/3           | 3/4           | 4/4           | 4/5           |
| ----- | ------------- | ------------- | ------------- | ------------- |
| D-A01 | BLOCK         | BLOCK         | BLOCK         | WARN_STRONG   |
| D-A02 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-A03 | BLOCK         | BLOCK         | WARN_STRONG   | WARN_STRONG   |
| D-A04 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A05 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-A06 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A07 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A08 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX |
| D-A09 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A10 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| D-A11 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A12 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-A13 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A14 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| D-A15 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A16 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_CHECKBOX |
| D-A17 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX |
| D-A18 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A19 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A20 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A21 | BLOCK         | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A22 | BLOCK         | BLOCK         | BLOCK         | WARN_CHECKBOX |
| D-A23 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| D-A24 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A25 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A26 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| D-A27 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A28 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-A29 | BLOCK         | BLOCK         | BLOCK         | BLOCK         |
| D-A30 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L01 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L02 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L03 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L04 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L05 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L06 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L07 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L08 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L09 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L10 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L11 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L12 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L13 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L14 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L15 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L16 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L17 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L18 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L19 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L20 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L21 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L22 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L23 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L24 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L25 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L26 | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX | WARN_CHECKBOX |
| D-L27 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L28 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
| D-L29 | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   | WARN_STRONG   |
| D-L30 | ALLOW         | ALLOW         | ALLOW         | ALLOW         |
