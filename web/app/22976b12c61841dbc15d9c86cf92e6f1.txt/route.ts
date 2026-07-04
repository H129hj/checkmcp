// IndexNow verification key — lets Bing, Yandex (and other IndexNow engines) confirm we
// own this domain when we ping them about new/changed URLs. Served at the host root.
export const dynamic = "force-static";

export function GET() {
  return new Response("22976b12c61841dbc15d9c86cf92e6f1", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
