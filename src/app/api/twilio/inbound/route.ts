import crypto from "node:crypto";
import { env } from "@/lib/env";
import { inboundTextResponseTask } from "@/trigger/inbound-text-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFormUrlEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

async function verifyTwilioSignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  // Only enforce signature verification in production
  if (env.NODE_ENV !== "production") return true;

  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) return false;

  const url = request.url; // Absolute URL in Next.js route handlers
  const params = parseFormUrlEncoded(rawBody);

  // Build the signed payload: URL + concatenated sorted POST params (key + value)
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto
    .createHmac("sha1", env.TWILIO_AUTH_TOKEN)
    .update(data)
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return (
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  );
}

export async function POST(request: Request) {
  // Twilio sends application/x-www-form-urlencoded by default for Messaging webhooks
  const rawBody = await request.text();

  const isValid = await verifyTwilioSignature(request, rawBody);
  if (!isValid) {
    return new Response("invalid signature", { status: 401 });
  }

  const params = parseFormUrlEncoded(rawBody);

  const inboundMessage = (params["Body"] || "").toString();
  const fromPhoneNumber = (params["From"] || "").toString();

  if (!fromPhoneNumber) {
    return new Response("missing sender", { status: 400 });
  }

  // Fire-and-forget task trigger; Twilio only needs a timely 200 OK response
  void inboundTextResponseTask.trigger({
    inboundMessage: inboundMessage,
    phoneNumber: fromPhoneNumber,
  });

  const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return new Response(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export function GET() {
  return new Response("method not allowed", { status: 405 });
}
