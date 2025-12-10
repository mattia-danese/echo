import { env } from "./env";

export const twilioAdmin = {
  accountSid: env.TWILIO_ACCOUNT_SID,
  authToken: env.TWILIO_AUTH_TOKEN,
  phoneNumber: env.TWILIO_PHONE_NUMBER,
  verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID,
  alphanumericSenderId: env.TWILIO_ALPHANUMERIC_SENDER_ID || null,
  alphanumericEnabledCountries: env.TWILIO_ALPHANUMERIC_ENABLED_COUNTRIES
    ? env.TWILIO_ALPHANUMERIC_ENABLED_COUNTRIES.split(",").map((c) => c.trim())
    : [],
};
