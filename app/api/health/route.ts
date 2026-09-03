export const runtime = "edge";

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "bsori-resource-platform",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
