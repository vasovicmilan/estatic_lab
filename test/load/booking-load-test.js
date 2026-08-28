// k6 load test - prati stvarni booking tok (service-step -> slots-step -> contact-step -> potvrda)
// Pokretanje:  k6 run --env BASE_URL=http://localhost:3000 --env SERVICE_SLUG=neka-usluga booking-load-test.js
//
// VAŽNO: gađa NODE_ENV=production instancu sa trust-proxy=1 i BEZ pravog nginx-a ispred
// (samo za ovaj test) - zato svaki VU šalje svoj X-Forwarded-For, da rate limiter (IP-based)
// tretira VU-ove kao stvarno različite posetioce, baš kao u produkciji sa hiljadama IP-jeva.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SERVICE_SLUG = __ENV.SERVICE_SLUG; // obavezno - slug postojeće usluge u seed bazi

export const options = {
  scenarios: {
    booking_funnel: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },   // zagrevanje
        { duration: "3m", target: 100 },  // realno opterećenje
        { duration: "2m", target: 300 },  // gde počinje da puca?
        { duration: "1m", target: 0 },    // hladi se
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],       // preko 1% grešaka = alarm
    http_req_duration: ["p(95)<800"],     // p95 preko 800ms = alarm
  },
};

function fakeIp(vuId) {
  // svaki VU dobija stabilan lažni IP kroz čitav test, kao stvarni posetilac
  return `10.${(vuId >> 16) & 255}.${(vuId >> 8) & 255}.${vuId & 255}`;
}

function extractHidden(html, name) {
  if (!html) return null;
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
}

export default function () {
  if (!SERVICE_SLUG) {
    throw new Error("Postavi --env SERVICE_SLUG=<pravi-slug-iz-baze>");
  }

  const headers = { "X-Forwarded-For": fakeIp(__VU) };
  const jar = http.cookieJar();

  // 1) Korak 1 - stranica usluge, uzmi prvu varijantu
  let res = http.get(`${BASE_URL}/zakazivanje/${SERVICE_SLUG}`, { headers });
  check(res, { "service-step 200": (r) => r.status === 200 });
  if (res.status !== 200 || !res.body) return; // timeout/greška - odustani od ove iteracije, ne ruši skriptu

  const nextUrlMatch = res.body.match(/href="([^"]*\/termin\?servicePackageId=[^"]*)"/);
  if (!nextUrlMatch) return; // nema varijanti - prekini ovaj iteraciju
  sleep(1); // simulira da korisnik čita stranicu, ne bombarduje odmah

  // 2) Korak 2 - dostupni termini, uzmi prvi slobodan slot
  res = http.get(`${BASE_URL}${nextUrlMatch[1]}`, { headers });
  check(res, { "slots-step 200": (r) => r.status === 200 });
  if (res.status !== 200 || !res.body) return;

  const slotMatch = res.body.match(/href="([^"]*\/podaci\?[^"]*startTime=[^"]*)"/);
  if (!slotMatch) return; // nema slobodnih termina - realan i bitan podatak sam po sebi
  sleep(1);

  // 3) Korak 3 - forma za podatke, pokupi CSRF token + hidden polja
  res = http.get(`${BASE_URL}${slotMatch[1].replace(/&amp;/g, "&")}`, { headers });
  check(res, { "contact-step 200": (r) => r.status === 200 });
  if (res.status !== 200 || !res.body) return;

  const csrfToken = extractHidden(res.body, "CSRFToken");
  const serviceId = extractHidden(res.body, "serviceId");
  const servicePackageId = extractHidden(res.body, "servicePackageId");
  const startTime = extractHidden(res.body, "startTime");
  const employeeId = extractHidden(res.body, "employeeId") || "";

  if (!csrfToken || !serviceId || !servicePackageId || !startTime) return;
  sleep(2); // simulira kucanje imena/telefona/email-a

  // 4) Potvrda rezervacije - pravi POST, isti session/cookie kao koraci 1-3
  const n = `${__VU}-${__ITER}`;
  res = http.post(
    `${BASE_URL}/zakazivanje/potvrda`,
    {
      CSRFToken: csrfToken,
      serviceSlug: SERVICE_SLUG,
      serviceId,
      servicePackageId,
      startTime,
      employeeId,
      firstName: `LoadTest${n}`,
      lastName: "K6",
      email: `loadtest${n}@example.com`,
      phone: "060123" + String(n).padStart(4, "0").slice(-4),
    },
    { headers }
  );
  check(res, {
    "booking POST nije 5xx": (r) => r.status < 500,
    "booking POST nije rate-limited (429)": (r) => r.status !== 429,
  });

  sleep(1);
}