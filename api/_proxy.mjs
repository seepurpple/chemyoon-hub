const ALLOWED = new Set(["/api/hub/auth/login", "/api/hub/auth/logout", "/api/hub/auth/session"]);

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

export async function proxy(req, res, path) {
  const origin = process.env.BACKEND_ORIGIN;
  const token = process.env.BACKEND_PROXY_TOKEN;
  if (!ALLOWED.has(path) || !["GET", "POST"].includes(req.method || "GET")) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (!origin || !token) {
    res.status(503).json({ error: "Mac Studio 서버 연결 설정이 완료되지 않았습니다." });
    return;
  }
  const headers = {
    "X-Mac-App": "hub",
    "X-Mac-Apps-Proxy": token,
    "X-Forwarded-For": String(req.headers["x-forwarded-for"] || ""),
  };
  if (process.env.SSO_COOKIE_DOMAIN) headers["X-Mac-Cookie-Domain"] = process.env.SSO_COOKIE_DOMAIN;
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  try {
    const query = (req.url || "").includes("?") ? (req.url || "").slice((req.url || "").indexOf("?")) : "";
    const init = { method: req.method || "GET", headers, redirect: "manual" };
    if (!['GET', 'HEAD'].includes(init.method)) init.body = await body(req);
    const upstream = await fetch(new URL(path + query, origin), init);
    res.statusCode = upstream.status;
    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const cookies = typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [upstream.headers.get("set-cookie")].filter(Boolean);
    if (cookies.length) res.setHeader("set-cookie", cookies);
    if (!upstream.body) return res.end();
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch {
    res.status(502).json({ error: "Mac Studio 서버에 연결할 수 없습니다." });
  }
}
