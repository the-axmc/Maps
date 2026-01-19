import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAY_BASE = "https://crimson-peaceful-impala-136.mypinata.cloud/ipfs";

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return new NextResponse("Missing PINATA_JWT", { status: 500 });
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

  const url = `${GATEWAY_BASE}/${cid}`;
  return NextResponse.json({ cid, url });
}
