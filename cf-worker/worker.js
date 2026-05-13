// Cloudflare Worker 反向代理
// 将请求转发到 Vercel 部署的 deep-observer-agent
const UPSTREAM = "https://deep-observer-agent.vercel.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 构建上游 URL
    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);
    upstreamUrl.hash = url.hash;

    // 复制请求头
    const headers = new Headers(request.headers);
    headers.set("Host", upstreamUrl.host);
    headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") || "");
    headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

    // 转发请求
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    // 复制响应
    const responseHeaders = new Headers(upstreamResponse.headers);
    // 删除可能暴露上游的 header
    responseHeaders.delete("x-vercel-id");
    responseHeaders.delete("x-vercel-cache");
    responseHeaders.delete("server");
    responseHeaders.delete("via");
    // 允许跨域（给小程序调用用）
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
