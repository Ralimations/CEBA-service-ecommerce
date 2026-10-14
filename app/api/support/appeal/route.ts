import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, errorResponse } from '@/server/http';
import { submitPublicAppeal } from '@/server/public-support';
import { assert } from '@/lib/domain';

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const announcedLength = Number(request.headers.get('content-length') || 0);
    assert(!announcedLength || announcedLength <= 16_000, 'Request is too large.', 413);
    const reader = request.body?.getReader();
    assert(reader, 'A request body is required.');
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > 16_000) {
        await reader.cancel();
        assert(false, 'Request is too large.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const raw = new TextDecoder().decode(bytes);
    const result = await submitPublicAppeal(JSON.parse(raw));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
