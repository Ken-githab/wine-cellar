import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  if (!request.body) {
    return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
  }

  const blob = await put(`photos/${user.id}/${crypto.randomUUID()}.jpg`, request.body, {
    access: "public",
    contentType: "image/jpeg",
  });
  return NextResponse.json({ url: blob.url });
}
