/**
 * Determines if a phone number is a US phone number.
 * US and Canada phone numbers use the +1 country code.
 */
export const isUSPhoneNumber = (phoneNumber: string): boolean => {
  // Remove any spaces, dashes, or parentheses
  const cleaned = phoneNumber.replace(/[\s\-()]/g, "");

  // Check if it starts with +1 or just 1 (for 11-digit US numbers)
  return cleaned.startsWith("+1") || /^1\d{10}$/.test(cleaned);
};

/**
 * For international (non-US) phone numbers, embeds links directly into the
 * preceding text message instead of sending them as separate messages.
 * This is necessary because some international carriers don't support
 * link previews for standalone URL messages.
 *
 * @param phoneNumber - The recipient's phone number
 * @param texts - Array of message texts to send
 * @returns Modified array of texts with links embedded for international numbers
 *
 * @example
 * // US number - no change
 * embedLinksForInternational('+15551234567', ['hello', 'https://example.com'])
 * // Returns: ['hello', 'https://example.com']
 *
 * // International number - links embedded
 * embedLinksForInternational('+445551234567', ['hello', 'https://example.com'])
 * // Returns: ['hello https://example.com']
 */
export const embedLinksForInternational = (
  phoneNumber: string,
  texts: string[],
): string[] => {
  // If US number, return texts unchanged
  if (isUSPhoneNumber(phoneNumber)) {
    return texts;
  }

  // For international numbers, embed links into preceding messages
  const modifiedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const currentText = texts[i];

    // Check if current text is a standalone URL
    const isStandaloneUrl =
      currentText &&
      currentText.trim().match(/^https?:\/\/[^\s]+$/);

    if (isStandaloneUrl && modifiedTexts.length > 0) {
      // Embed the link into the previous message
      const previousIndex = modifiedTexts.length - 1;
      modifiedTexts[previousIndex] = `${modifiedTexts[previousIndex]} ${currentText}`;
    } else {
      // Add the text as-is
      modifiedTexts.push(currentText);
    }
  }

  return modifiedTexts;
};
