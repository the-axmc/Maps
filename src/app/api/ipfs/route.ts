import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAY_BASE = "https://crimson-peaceful-impala-136.mypinata.cloud/ipfs";
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png"]);
const lastUploadByIp = new Map<string, number>();

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return new NextResponse("Missing PINATA_JWT", { status: 500 });
  }

  const clientIp = getClientIp(request);
  const now = Date.now();
  const lastUpload = lastUploadByIp.get(clientIp);
  if (lastUpload && now - lastUpload < RATE_LIMIT_WINDOW_MS) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return new NextResponse("Invalid form data", { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return new NextResponse("Missing file", { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return new NextResponse("Only PNG uploads are supported", { status: 415 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return new NextResponse("File too large", { status: 413 });
  }

  const forwardData = new FormData();
  forwardData.append("file", file, file.name || "map.png");

  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: forwardData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new NextResponse(errorText || "Pinata upload failed", {
      status: response.status,
    });
  }

  const data = (await response.json()) as { IpfsHash?: string };
  const cid = data.IpfsHash;
  if (!cid) {
    return new NextResponse("Pinata did not return a CID", { status: 502 });
  }

  lastUploadByIp.set(clientIp, now);
  const url = `${GATEWAY_BASE}/${cid}`;
  return NextResponse.json({ cid, url });
}
