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

// Rename: PATCH /api/board/<oldSlug> with { "rename_to": "<newSlug>" }.
// KV has no transactions, so this is best-effort:
//   1. validate the new slug.
//   2. refuse if the destination slug already exists (no clobber).
//   3. write the old content to the new slug.
//   4. delete the old slug.
// If step 4 fails the board ends up at both slugs — no data loss, just a
// duplicate. Caller can retry the rename to clean up.
interface RenameBody {
  rename_to?: unknown;
}
export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!env.BOARD) {
    return new Response('KV binding "BOARD" missing', { status: 503 });
  }
  const oldSlug = params.slug;
  if (badSlug(oldSlug)) return new Response('Not found', { status: 404 });
  let body: RenameBody;
  try {
    body = (await request.json()) as RenameBody;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const newSlug = body.rename_to;
  if (badSlug(newSlug)) {
    return new Response('Invalid destination slug', { status: 400 });
  }
  if (newSlug === oldSlug) {
    return new Response('Source and destination match', { status: 400 });
  }
  const content = await env.BOARD.get(oldSlug as string);
  if (content == null) {
    return new Response('Source not found', { status: 404 });
  }
  const existing = await env.BOARD.get(newSlug as string);
  if (existing != null) {
    return new Response('Destination already exists', { status: 409 });
  }
  await env.BOARD.put(newSlug as string, content);
  await env.BOARD.delete(oldSlug as string);
  const headers = noStore();
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ ok: true, from: oldSlug, to: newSlug }), {
    status: 200,
    headers,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  const h = new Headers();
  h.set('allow', 'GET, PUT, PATCH, OPTIONS');
  return new Response(null, { status: 204, headers: h });
};
