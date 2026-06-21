interface Env {
  BOARD?: KVNamespace;
}

// Listing endpoint at /api/board — returns every slug in the BOARD KV
// namespace. The owner chose a public-listing model (see devlog 0106), so
// this is intentionally unauthenticated; the slug-as-secret gate is relaxed
// in favour of a discoverable writer portal at write.bitrunners.app/.
//
// Capped at 1000 entries per page. If the namespace ever grows beyond that
// we'll need to wire cursor pagination here AND in the landing component.

const LIST_LIMIT = 1000;

function noStore(): Headers {
  const h = new Headers();
  h.set('cache-control', 'no-store');
  h.set('content-type', 'application/json; charset=utf-8');
  return h;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.BOARD) {
    return new Response(JSON.stringify({ error: 'KV binding "BOARD" missing' }), {
      status: 503,
      headers: noStore(),
    });
  }
  const result = await env.BOARD.list({ limit: LIST_LIMIT });
  const slugs = result.keys.map((k) => k.name);
  return new Response(JSON.stringify({ slugs, complete: result.list_complete }), {
    status: 200,
    headers: noStore(),
  });
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  const h = new Headers();
  h.set('allow', 'GET, OPTIONS');
  return new Response(null, { status: 204, headers: h });
};
