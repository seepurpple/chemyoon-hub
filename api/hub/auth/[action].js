export default async function handler(req, res) {
  const { proxy } = await import("../../_proxy.mjs");
  const path = new URL(req.url || "/api", "https://proxy.local").pathname;
  return proxy(req, res, path);
}
