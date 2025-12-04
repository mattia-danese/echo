import { db } from "@/db";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { sendMessagesTask } from "@/trigger/send-messages";

/**
 * Send a manual text blast to specific users
 *
 * Usage:
 * 1. Update the USER_IDS array with the user IDs you want to message
 * 2. Update the MESSAGE with your text
 * 3. Run: npx tsx scripts/send-manual-blast.ts
 */

// ======== CONFIGURATION ========
const USER_IDS = [76, 41, 58, 59, 60, 61, 62, 63, 65, 66, 68, 75, 81, 82]; // From session 19
const MESSAGE = "Your message here!"; // Customize this
// ================================

async function sendBlast() {
  console.log(`Fetching phone numbers for ${USER_IDS.length} users...`);

  const userRecords = await db
    .select({
      id: users.id,
      phoneNumber: users.phoneNumber,
      firstName: users.firstName,
    })
    .from(users)
    .where(inArray(users.id, USER_IDS));

  console.log(`Found ${userRecords.length} users with phone numbers`);

  const data: Record<string, string[]> = {};

  for (const user of userRecords) {
    if (user.phoneNumber) {
      data[user.phoneNumber] = [MESSAGE];
      console.log(`- ${user.firstName} (${user.phoneNumber})`);
    }
  }

  console.log(`\nSending messages to ${Object.keys(data).length} users...`);

  const result = await sendMessagesTask.trigger({ data });

  console.log("✓ Messages queued successfully!");
  console.log("Task ID:", result.id);
}

sendBlast().catch(console.error);
