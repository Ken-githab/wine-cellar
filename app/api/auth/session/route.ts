import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/lib/api-auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: getRequestUser(request) });
}
