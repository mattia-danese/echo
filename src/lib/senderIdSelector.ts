import { parsePhoneNumber } from "libphonenumber-js";
import { twilioAdmin } from "./twilioAdmin";

export type SenderIdResult = {
  senderId: string;
  isAlphanumeric: boolean;
  country: string | null;
};

/**
 * Selects the appropriate sender ID for a recipient based on their country
 * and the configured alphanumeric sender ID settings.
 *
 * @param toPhoneNumber - Recipient phone number in E.164 format (e.g., +447123456789)
 * @returns Sender ID to use (alphanumeric or phone number), whether it's alphanumeric, and the country code
 */
export function selectSenderId(toPhoneNumber: string): SenderIdResult {
  try {
    // Parse phone number to extract country
    const phoneNumber = parsePhoneNumber(toPhoneNumber);

    if (!phoneNumber) {
      return {
        senderId: twilioAdmin.phoneNumber,
        isAlphanumeric: false,
        country: null,
      };
    }

    const country = phoneNumber.country; // ISO 3166-1 alpha-2 code (e.g., "GB", "DE")

    // Check if alphanumeric sender ID is configured
    if (!twilioAdmin.alphanumericSenderId) {
      return {
        senderId: twilioAdmin.phoneNumber,
        isAlphanumeric: false,
        country: country || null,
      };
    }

    // Check if country is in the enabled list
    if (!twilioAdmin.alphanumericEnabledCountries.includes(country || "")) {
      return {
        senderId: twilioAdmin.phoneNumber,
        isAlphanumeric: false,
        country: country || null,
      };
    }

    // Use alphanumeric sender ID
    return {
      senderId: twilioAdmin.alphanumericSenderId,
      isAlphanumeric: true,
      country: country || null,
    };
  } catch (error) {
    // Fallback to phone number on any error
    return {
      senderId: twilioAdmin.phoneNumber,
      isAlphanumeric: false,
      country: null,
    };
  }
}

/**
 * Checks if a country supports alphanumeric sender IDs (is registered)
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "GB", "DE")
 * @returns Whether the country is enabled for alphanumeric sender IDs
 */
export function isAlphanumericSupportedForCountry(
  countryCode: string,
): boolean {
  return twilioAdmin.alphanumericEnabledCountries.includes(countryCode);
}
