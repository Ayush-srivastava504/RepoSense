#!/usr/bin/env bash
# End-to-end check: real Next dev server + mock backend (healthy + rate-limited).
# Usage (from apps/web):  bash tests/e2e/run_e2e.sh
set -u
cd "$(dirname "$0")/../.."
E=tests/e2e; LOG=$(mktemp -d); FAIL=0
pass(){ echo "  PASS  $1"; }; fail(){ echo "  FAIL  $1"; FAIL=1; }
cleanup(){ pkill -P $$ 2>/dev/null; kill $(jobs -p) 2>/dev/null; }; trap cleanup EXIT

python3 $E/mock_api.py >$LOG/m1 2>&1 & python3 $E/mock_api.py flaky >$LOG/m2 2>&1 &
API_BASE_URL=http://127.0.0.1:8099 NEXT_TELEMETRY_DISABLED=1 npx next dev -p 3111 >$LOG/n1 2>&1 &
API_BASE_URL=http://127.0.0.1:8098 NEXT_TELEMETRY_DISABLED=1 npx next dev -p 3112 -H 127.0.0.1 >$LOG/n2 2>&1 &
sleep 9
H=http://localhost:3111

echo "== /sitemap-jobs.xml (healthy API)"
curl -s -m 120 -D $LOG/h -o $LOG/jobs.xml $H/sitemap-jobs.xml
grep -q "^HTTP.* 200" $LOG/h && pass "HTTP 200" || fail "HTTP status: $(head -1 $LOG/h)"
grep -qi "s-maxage=3600" $LOG/h && pass "edge Cache-Control set" || fail "no s-maxage"
python3 - "$LOG/jobs.xml" <<'PY' && pass "content assertions" || fail "content assertions (see above)"
import re,sys,json,datetime as dt,importlib.util
xml=open(sys.argv[1]).read()
locs=re.findall(r"<loc>(.*?)</loc>",xml)
spec=importlib.util.spec_from_file_location("m","tests/e2e/mock_api.py")
src=open("tests/e2e/mock_api.py").read().split("FLAKY =")[0]; ns={}; exec(src,ns)
jobs,NOW=ns["jobs"],ns["NOW"]; real=dt.datetime.now(dt.timezone.utc)
def ok(j):
    if j.get("deadline") and dt.datetime.fromisoformat(j["deadline"])<real: return False
    if not j.get("deadline") and j.get("posted_at") and dt.datetime.fromisoformat(j["posted_at"])+dt.timedelta(days=45)<real: return False
    if j.get("is_thin") and not j.get("enriched_overview"): return False
    return True
exp=[j for j in jobs if ok(j)]
print(f"     API jobs={len(jobs)}  expected in sitemap={len(exp)}  actual <loc>={len(locs)}")
assert len(locs)==len(exp),"count mismatch"
assert len(set(locs))==len(locs),"duplicate <loc>"
assert all(l.startswith("https://intern-flow.in/") for l in locs),"non-canonical host"
assert "www.intern-flow" not in xml,"www present"
n_lm=len(re.findall("<lastmod>",xml)); exp_lm=sum(1 for j in exp if j.get("posted_at") and dt.datetime.fromisoformat(j["posted_at"])<=real)  # future-dated posted_at must also be omitted
print(f"     <lastmod> present={n_lm}  (jobs with real posted_at={exp_lm})")
assert n_lm==exp_lm,"lastmod fabricated"
assert xml.rstrip().endswith("</urlset>"),"truncated xml"
assert not re.search(r"<(changefreq|priority)>",xml),"changefreq/priority still emitted"
PY

echo "== /sitemap-jobs.xml (API rate-limits page 3 -> must NOT serve a partial sitemap)"
curl -s -m 120 -D $LOG/h2 -o $LOG/jobs2.xml http://127.0.0.1:3112/sitemap-jobs.xml
grep -q "^HTTP.* 503" $LOG/h2 && pass "503 returned" || fail "expected 503, got: $(head -1 $LOG/h2)"
grep -qi "retry-after" $LOG/h2 && pass "Retry-After header" || fail "no Retry-After"
grep -q "<loc>" $LOG/jobs2.xml && fail "partial URLs leaked" || pass "no partial URL list served"

echo "== sitemap index + other sitemaps"
curl -s $H/sitemap.xml -o $LOG/idx.xml
python3 - $LOG/idx.xml <<'PY' && pass "index: non-www, no fake lastmod" || fail "index"
import re,sys; x=open(sys.argv[1]).read(); l=re.findall(r"<loc>(.*?)</loc>",x)
assert len(l)==11 and all(u.startswith("https://intern-flow.in/") for u in l) and "<lastmod>" not in x and "www.intern-flow" not in x
PY
for s in static tools; do curl -s $H/sitemap-$s.xml -o $LOG/s.xml; python3 - $LOG/s.xml $s <<'PY' && pass "sitemap-$s: non-www, no fake lastmod" || fail "sitemap-$s"
import re,sys; x=open(sys.argv[1]).read(); l=re.findall(r"<loc>(.*?)</loc>",x)
assert l and all(u=="https://intern-flow.in" or u.startswith("https://intern-flow.in/") for u in l) and "<lastmod>" not in x and "www.intern-flow" not in x, x[:300]
PY
done

echo "== robots.txt"
curl -s $H/robots.txt | grep -q "^Sitemap: https://intern-flow.in/sitemap.xml$" && pass "Sitemap line non-www" || fail "robots Sitemap line"

echo "== job detail pages (canonical / og:url / JSON-LD)"
LIVE=$(python3 -c "import re;print(re.findall(r'<loc>(.*?)</loc>',open('$LOG/jobs.xml').read())[0].replace('https://intern-flow.in',''))")
curl -s -m 60 "$H$LIVE" -o $LOG/page.html -w "     live page $LIVE -> HTTP %{http_code}\n"
python3 - $LOG/page.html "$LIVE" <<'PY' && pass "live page: canonical, og:url, JSON-LD all https://intern-flow.in" || fail "live page host tags"
import re,sys; h=open(sys.argv[1]).read(); p=sys.argv[2]
want="https://intern-flow.in"+p
can=re.findall(r'<link rel="canonical" href="([^"]+)"',h); og=re.findall(r'property="og:url" content="([^"]+)"',h)
print("     canonical:",can,"\n     og:url   :",og)
assert can==[want] and og==[want],"canonical/og mismatch"
ld=re.findall(r'<script id="job-posting-schema"[^>]*>(.*?)</script>',h,re.S); assert ld and "www.intern-flow" not in h
PY
# a thin+unenriched job (id 2) must be noindex on its own page AND absent from the sitemap
THIN=$(python3 - <<'PY'
import re,sys
sys.argv=["x"]; src=open("tests/e2e/mock_api.py").read().split("FLAKY =")[0]; ns={}; exec(src,ns)
print(f"{2:016x}")
PY
)
grep -q "$THIN" $LOG/jobs.xml && fail "thin job $THIN leaked into sitemap" || pass "thin job absent from sitemap"
curl -s -m 60 -L "$H/jobs/x-$THIN" -o $LOG/thin.html -w "     thin page -> HTTP %{http_code}\n"
grep -qi 'name="robots" content="noindex' $LOG/thin.html && pass "thin page emits robots noindex (matches sitemap exclusion)" || fail "thin page not noindex"

echo; [ $FAIL = 0 ] && echo "ALL E2E CHECKS PASSED" || echo "E2E FAILURES"; exit $FAIL
