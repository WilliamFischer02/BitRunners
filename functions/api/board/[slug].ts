interface Env {
  BOARD?: KVNamespace;
}

const MIN_SLUG_LENGTH = 16;
const MAX_BODY_BYTES = 512 * 1024;

function badSlug(slug: unknown): boolean {
  return (
    typeof slug !== 'string' || slug.length < MIN_SLUG_LENGTH || !/^[A-Za-z0-9_-]+$/.test(slug)
  );
}

function noStore(): Headers {
  const h = new Headers();
  h.set('cache-control', 'no-store');
  return h;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  if (!env.BOARD) {
    return new Response(
      'KV binding "BOARD" missing — see Cloudflare Pages dashboard → Settings → Functions → KV namespace bindings.',
      { status: 503 },
    );
  }
  const slug = params.slug;
  if (badSlug(slug)) return new Response('Not found', { status: 404 });
  const content = await env.BOARD.get(slug as string);
  const headers = noStore();
  headers.set('content-type', 'text/markdown; charset=utf-8');
  return new Response(content ?? '', { status: 200, headers });
};

export const onRequestPut: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!env.BOARD) {
    return new Response('KV binding "BOARD" missing', { status: 503 });
  }
  const slug = params.slug;
  if (badSlug(slug)) return new Response('Not found', { status: 404 });
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_BODY_BYTES) {
    return new Response('Too large', { status: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response('Too large', { status: 413 });
  }
  await env.BOARD.put(slug as string, text);
  const headers = noStore();
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ ok: true, savedAt: Date.now(), bytes: text.length }), {
    status: 200,
    headers,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  const h = new Headers();
  h.set('allow', 'GET, PUT, OPTIONS');
  return new Response(null, { status: 204, headers: h });
};
