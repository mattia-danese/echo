declare module "twilio" {
  export function validateRequest(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, unknown>,
  ): boolean;

  export function validateRequestWithBody(
    authToken: string,
    signature: string,
    url: string,
    body: string | Buffer,
  ): boolean;
}
