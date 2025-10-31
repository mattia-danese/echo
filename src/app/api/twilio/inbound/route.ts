import { validateRequest } from "twilio";
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

function getFullUrl(request: Request): string {
  // Vercel uses SSL termination, so we need to check X-Forwarded-Proto
  // to get the actual protocol used by the client (https)
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const url = new URL(request.url);

  // If behind a proxy/load balancer, use the forwarded protocol
  if (forwardedProto) {
    url.protocol = forwardedProto;
  }

  return url.toString();
}

async function verifyTwilioSignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  // Only enforce signature verification in production
  if (env.NODE_ENV !== "production") {
    console.log(
      "[Twilio Webhook] Skipping signature verification (not production)",
    );
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    console.error("[Twilio Webhook] Missing X-Twilio-Signature header");
    return false;
  }

  const url = getFullUrl(request);
  const params = parseFormUrlEncoded(rawBody);

  console.log("[Twilio Webhook] Validating signature for URL:", url);

  // Use Twilio's official validateRequest function
  const isValid = validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );

  if (!isValid) {
    console.error("[Twilio Webhook] Signature validation failed", {
      url,
      signature: signature.substring(0, 10) + "...", // Log partial signature for debugging
      paramsKeys: Object.keys(params),
    });
  }

  return isValid;
}

export async function POST(request: Request) {
  console.log("[Twilio Webhook] Received POST request");

  try {
    // Twilio sends application/x-www-form-urlencoded by default for Messaging webhooks
    const rawBody = await request.text();
    console.log("[Twilio Webhook] Raw body received, length:", rawBody.length);

    const isValid = await verifyTwilioSignature(request, rawBody);
    if (!isValid) {
      console.error(
        "[Twilio Webhook] Signature validation failed - returning 401",
      );
      return new Response("invalid signature", { status: 401 });
    }

    console.log("[Twilio Webhook] Signature validation passed");

    const params = parseFormUrlEncoded(rawBody);

    const inboundMessage = (params.Body || "").toString();
    const fromPhoneNumber = (params.From || "").toString();

    console.log("[Twilio Webhook] Parsed message", {
      from: fromPhoneNumber,
      messageLength: inboundMessage.length,
    });

    if (!fromPhoneNumber) {
      console.error("[Twilio Webhook] Missing sender phone number");
      return new Response("missing sender", { status: 400 });
    }

    // Fire-and-forget task trigger; Twilio only needs a timely 200 OK response
    console.log("[Twilio Webhook] Triggering inboundTextResponseTask");
    void inboundTextResponseTask.trigger({
      inboundMessage: inboundMessage,
      phoneNumber: fromPhoneNumber,
    });
    console.log("[Twilio Webhook] Task triggered successfully");

    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    return new Response(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("[Twilio Webhook] Error processing request:", error);
    // Still return 200 to Twilio to avoid retries
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    return new Response(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  }
}

export function GET() {
  return new Response("method not allowed", { status: 405 });
}
