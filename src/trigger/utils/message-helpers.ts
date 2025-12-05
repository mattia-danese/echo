/**
 * Utility functions for message formatting and link embedding
 */

/**
 * Checks if a phone number is from the US or Canada (country code +1)
 * @param phoneNumber - The phone number to check (in E.164 format)
 * @returns true if the number is US/Canada, false otherwise
 */
export function isUSPhoneNumber(phoneNumber: string): boolean {
  // E.164 format starts with + followed by country code
  // US and Canada both use country code 1
  return phoneNumber.startsWith("+1");
}

/**
 * Checks if a string is a standalone URL
 * @param text - The text to check
 * @returns true if the text is a URL, false otherwise
 */
function isStandaloneLink(text: string): boolean {
  const urlPattern = /^https?:\/\/.+/i;
  return urlPattern.test(text.trim());
}

/**
 * Embeds links into preceding messages for international phone numbers.
 * For non-US numbers, this function finds standalone link messages and appends
 * them to the end of the previous message. This is needed because international
 * carriers don't properly support link previews for standalone URL messages.
 *
 * For US numbers, messages are returned unchanged.
 *
 * @param phoneNumber - The recipient's phone number in E.164 format
 * @param messages - Array of message strings to process
 * @returns Array of messages with links embedded (if applicable)
 *
 * @example
 * // For international numbers:
 * embedLinksForInternational("+447123456789", [
 *   "Check out this song",
 *   "https://open.spotify.com/track/123"
 * ])
 * // Returns: ["Check out this song https://open.spotify.com/track/123"]
 *
 * @example
 * // For US numbers:
 * embedLinksForInternational("+12125551234", [
 *   "Check out this song",
 *   "https://open.spotify.com/track/123"
 * ])
 * // Returns: ["Check out this song", "https://open.spotify.com/track/123"]
 */
export function embedLinksForInternational(
  phoneNumber: string,
  messages: string[]
): string[] {
  // If it's a US number, return messages unchanged
  if (isUSPhoneNumber(phoneNumber)) {
    return messages;
  }

  // For international numbers, embed links into previous messages
  const processedMessages: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const currentMessage = messages[i];
    const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;

    // Check if the next message is a standalone link
    if (nextMessage && isStandaloneLink(nextMessage)) {
      // Embed the link at the end of the current message
      processedMessages.push(`${currentMessage} ${nextMessage}`);
      // Skip the next message since we've already embedded it
      i++;
    } else {
      // Keep the message as is
      processedMessages.push(currentMessage);
    }
  }

  return processedMessages;
}
