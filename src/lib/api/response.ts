import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 500, error?: unknown) {
  if (error) logger.error(message, error);
  else logger.error(message);
  return NextResponse.json({ error: message }, { status });
}
