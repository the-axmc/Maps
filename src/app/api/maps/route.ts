import { getSessionFromCookies } from "@/lib/auth";
import { ensureCollections, getSavedMapsCollection } from "@/lib/db-init";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const unauthorized = () => new NextResponse("Unauthorized", { status: 401 });

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export async function GET() {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  if (!session) return unauthorized();

  let userId: ObjectId;
  try {
    userId = new ObjectId(session.userId);
  } catch {
    return unauthorized();
  }

  await ensureCollections();
  const savedMaps = await getSavedMapsCollection();

  const maps = await savedMaps
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    maps: maps.map((map) => ({
      id: map._id.toHexString(),
      cid: map.cid,
      url: map.url,
      description: map.description,
      createdAt: map.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  if (!session) return unauthorized();

  let userId: ObjectId;
  try {
    userId = new ObjectId(session.userId);
  } catch {
    return unauthorized();
  }

  let payload: { cid?: string; url?: string; description?: string };
  try {
    payload = (await request.json()) as {
      cid?: string;
      url?: string;
      description?: string;
    };
  } catch {
    return new NextResponse("Invalid request body", { status: 400 });
  }

  const cid = (payload.cid ?? "").trim();
  const url = (payload.url ?? "").trim();
  const description = (payload.description ?? "").trim();

  if (!cid) {
    return new NextResponse("Missing CID", { status: 400 });
  }
  if (!isValidHttpUrl(url)) {
    return new NextResponse("Invalid map URL", { status: 400 });
  }
  if (description.length > 500) {
    return new NextResponse("Description must be 500 chars or fewer", {
      status: 400,
    });
  }

  await ensureCollections();
  const savedMaps = await getSavedMapsCollection();
  const now = new Date();

  const insertResult = await savedMaps.insertOne({
    userId,
    cid,
    url,
    description,
    createdAt: now,
  });

  return NextResponse.json(
    {
      map: {
        id: insertResult.insertedId.toHexString(),
        cid,
        url,
        description,
        createdAt: now.toISOString(),
      },
    },
    { status: 201 }
  );
}
