# LeetCode Solving System

Self-contained judge feature added under `services/api/src`.

## Endpoints
- `GET /api/leetcode/problems` — list all problems
- `GET /api/leetcode/problems/{slug}` — problem detail + starter code
- `POST /api/leetcode/problems/{slug}/submit` — run submitted code against test cases
- `GET /api/leetcode/blind75/sheet` — download the Blind 75 + company tags Excel tracker

## Files
- `src/services/leetcode_service.py` — problem bank, sandboxed executor, judge engine
- `src/schemas/leetcode.py` — request/response models
- `src/routes/leetcode.py` — FastAPI routes
- `src/data/leetcode/Blind_75_Company_Tags.xlsx` — the tracker sheet
