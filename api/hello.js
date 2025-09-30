export default async function handler() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
export default async function handler(req, res) {
  res.status(200).json({ ok: true, runtime: 'node' });
}

