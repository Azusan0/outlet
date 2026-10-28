import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type RevalidatePayload = {
  tags?: string[];
  tenant?: string;
};

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { revalidated: false, error: 'REVALIDATE_SECRET not configured' },
      { status: 500 }
    );
  }

  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json(
      { revalidated: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: RevalidatePayload;
  try {
    body = (await request.json()) as RevalidatePayload;
  } catch {
    return NextResponse.json(
      { revalidated: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === 'string' && !!tag)
    : [];

  if (tags.length === 0) {
    return NextResponse.json(
      { revalidated: false, error: 'No tags provided' },
      { status: 400 }
    );
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }
  if (body.tenant && /^[a-z][a-z0-9-]*$/.test(body.tenant)) {
    revalidateTag(`tenant-${body.tenant}`);
  }

  return NextResponse.json({ revalidated: true, tags });
}
