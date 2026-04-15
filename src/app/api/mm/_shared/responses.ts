import { NextResponse } from "next/server.js";

export function mmErrorResponse(
  error: string,
  status: number,
  message?: string,
) {
  return NextResponse.json(
    message ? { error, message } : { error },
    { status },
  );
}

export function mmOkResponse(payload: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(payload);
}
