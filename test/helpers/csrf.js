export async function getCsrfToken(agent, path = "/") {
  const res = await agent.get(path);
  const match = res.text.match(/name="CSRFToken" value="([^"]*)"/);
  let token = match ? match[1] : "";
  // anonimnim posetiocima server ne upisuje token u stranicu dok ne zatreba (podnožje i meta tag su prazni);
  // JavaScript ga tada traži sa /csrf-token, pa isto radi i test
  if (!token) {
    const fetched = await agent.get("/csrf-token");
    token = fetched.body?.token || "";
  }
  return { token, response: res };
}

export default { getCsrfToken };