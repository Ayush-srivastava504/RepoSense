import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const status200 = new Counter("status_200");
const status429 = new Counter("status_429");
const status500 = new Counter("status_500");
const status502 = new Counter("status_502");
const status503 = new Counter("status_503");
const status504 = new Counter("status_504");
const statusOther = new Counter("status_other");

export const options = {
  vus: 100,
  duration: "30s",

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.get(
    "https://api.intern-flow.in/api/jobs/?limit=20&offset=0"
  );

  if (res.status === 200) {
    status200.add(1);
  } else if (res.status === 429) {
    status429.add(1);
  } else if (res.status === 500) {
    status500.add(1);
  } else if (res.status === 502) {
    status502.add(1);
  } else if (res.status === 503) {
    status503.add(1);
  } else if (res.status === 504) {
    status504.add(1);
  } else {
    statusOther.add(1);
  }

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response below 1 sec": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}