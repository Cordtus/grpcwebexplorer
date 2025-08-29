export const runtime = 'nodejs';
// app/api/grpc/stream/[endpoint]/[service]/[method]/route.ts
import { callStream } from 'lib/grpc/client';


export async function GET(
  req: Request,
  { params }: { params: { endpoint: string; service: string; method: string } }
) {
  const { endpoint, service, method } = params;
  const url = new URL(req.url);
  const msgParam = url.searchParams.get('message');
  const message = msgParam ? JSON.parse(msgParam) : {};
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    start(controller) {
      callStream(
        endpoint,
        service,
        method,
        message,
        data => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        },
        () => controller.close(),
        err => {
          controller.enqueue(encoder.encode(`event: error\ndata: ${err.message}\n\n`));
          controller.close();
        }
      );
    }
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
