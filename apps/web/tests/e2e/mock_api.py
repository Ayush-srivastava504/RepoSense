# Mock backend: 1,234 jobs incl. expired / thin / NULL posted_at / stale, plus a "flaky" mode.
import json, re, sys, datetime as dt
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
NOW=dt.datetime(2026,9,20,tzinfo=dt.timezone.utc)
jobs=[]
for i in range(1234):
    j={"id":f"{i:016x}","title":f"Software Engineer {i}","company":f"Company{i%50}","description":"x"*300,
       "url":"https://example.com/x","source":"mock","location":"Pune","type":"job",
       "posted_at":(NOW-dt.timedelta(days=i%30)).isoformat()}
    if i%4!=0: j["posted_at"]=None                    # ~75% NULL posted_at like prod
    if i%50==1: j["deadline"]=(NOW-dt.timedelta(days=2)).isoformat()   # expired
    if i%50==2: j["is_thin"]=True                                        # thin + unenriched
    if i%50==3: j["is_thin"]=True; j["enriched_overview"]="Real overview"# thin but enriched
    if i%50==4: j["posted_at"]=(NOW-dt.timedelta(days=80)).isoformat()   # stale (>45d, no deadline)
    if i%50==5: j["type"]="internship"
    jobs.append(j)
FLAKY = len(sys.argv)>1 and sys.argv[1]=="flaky"
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        m=re.match(r"/api/jobs/\?(.*)",self.path)
        if m:
            q=dict(p.split("=",1) for p in m.group(1).split("&") if "=" in p)
            off,lim=int(q.get("offset",0)),int(q.get("limit",200))
            if FLAKY and off==1000: 
                self.send_response(429); self.end_headers(); return
            body=json.dumps({"jobs":jobs[off:off+lim],"total":len(jobs)}).encode()
        else:
            m2=re.match(r"/api/jobs/([0-9a-f]{16})$",self.path)
            if not m2: self.send_response(404); self.end_headers(); return
            body=json.dumps(jobs[int(m2.group(1),16)]).encode()
        self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body)
ThreadingHTTPServer(("127.0.0.1",8099 if not FLAKY else 8098),H).serve_forever()
