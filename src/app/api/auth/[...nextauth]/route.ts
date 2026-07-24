import { handlers } from '@/auth';
import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  return handlers.GET(request);
}

export function POST(request: NextRequest) {
  return handlers.POST(request);
}
