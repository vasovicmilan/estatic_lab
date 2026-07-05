export async function getCsrfToken(agent, path = "/") {
  const res = await agent.get(path);
  const match = res.text.match(/name="CSRFToken" value="([^"]*)"/);
  return { token: match ? match[1] : "", response: res };
}

export default { getCsrfToken };