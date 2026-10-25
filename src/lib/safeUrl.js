// 仅放行 http(s) 协议的外链，防止 javascript:/data: 等危险协议造成存储型 XSS
export function safeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}