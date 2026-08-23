# data/leetcode — LeetCode Practice Judge

Data and problem bank backing the LeetCode-style practice/judge feature
exposed by the core API.

## Contents

- `level_problems.py` — the problem bank (prompts, starter code, test cases),
  organized by difficulty level
- `Blind_75_Company_Tags.xlsx` — the Blind 75 tracker spreadsheet, with
  company-tag breakdowns, served as a download

## Related code

- `src/services/leetcode_service.py` — problem bank access, sandboxed code
  execution, and judging logic
- `src/schemas/leetcode.py` — request/response models
- `src/routes/leetcode.py` — FastAPI routes (`/api/leetcode/...`)

## Endpoints

- `GET /api/leetcode/problems` — list all problems
- `GET /api/leetcode/problems/{slug}` — problem detail + starter code
- `POST /api/leetcode/problems/{slug}/submit` — run submitted code against
  test cases
- `GET /api/leetcode/levels` / `GET /api/leetcode/levels/{level_key}` —
  level summaries and detail
- `GET /api/leetcode/companies` — list of companies with tagged problems
- `GET /api/leetcode/blind75/sheet` — download the Blind 75 tracker
