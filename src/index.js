/**
 * DSH Remote — Cloudflare Worker
 *
 * 职责：
 *   1. /a/* /b/* /c/* /d/*  → 反向代理到各自的 Cloudflare Tunnel
 *   2. 其余路径            → 交给静态资源（public/）
 *
 * 为什么要代理：插件的 cross-site 防护会拦跨站请求（403），
 * 而 Worker 的 fetch 是服务端请求（无 Origin/Sec-Fetch-*）→ 放行。
 */

const UPSTREAMS = {
  a: 'https://dsh-a.example.com',
  b: 'https://dsh-b.example.com',
  c: 'https://dsh-c.example.com',
  d: 'https://dsh-d.example.com',
};

// 这些头会暴露「来自浏览器」，必须剥离
const STRIP_REQ_HEADERS = [
  'host', 'origin', 'referer',
  'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user',
  'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
  'x-forwarded-proto', 'x-real-ip', 'x-forwarded-for',
];

const STRIP_RES_HEADERS = [
  'content-encoding', 'content-length', 'transfer-encoding',
  'connection', 'keep-alive',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/([a-z])(\/.*)?$/);

    // 不是代理路径 → 走静态资源
    if (!m || !UPSTREAMS[m[1]]) {
      return env.ASSETS.fetch(request);
    }

    const prefix = m[1];
    const rest = m[2] || '/';
    const target = UPSTREAMS[prefix] + rest + url.search;

    const headers = new Headers(request.headers);
    for (const h of STRIP_REQ_HEADERS) headers.delete(h);

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    let up;
    try {
      up = await fetch(target, init);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: 'upstream-unreachable',
          detail: `无法连接实例 ${prefix.toUpperCase()}（${UPSTREAMS[prefix]}）：${e.message}`,
        }),
        { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } }
      );
    }

    const outHeaders = new Headers(up.headers);
    for (const h of STRIP_RES_HEADERS) outHeaders.delete(h);

    const ct = up.headers.get('content-type') || '';
    if (ct.includes('text/event-stream')) {
      outHeaders.set('cache-control', 'no-cache');
      outHeaders.set('x-accel-buffering', 'no');
    }

    return new Response(up.body, {
      status: up.status,
      statusText: up.statusText,
      headers: outHeaders,
    });
  },
};
