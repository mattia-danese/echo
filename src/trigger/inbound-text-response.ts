import { logger, task } from "@trigger.dev/sdk/v3";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");
import { createClient } from '@supabase/supabase-js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,    
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export const inboundTextResponseTask = task({
  id: "inbound-text-response",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {inbound_message: string, phone_number: string}, { ctx }) => {
    logger.log("inbound text response task starting", { payload, ctx });

    if (payload.inbound_message.trim().toLowerCase() === "help") {
        const message = await client.messages.create({
            body: `
            HELP
            `,
            from: fromNumber,
            to: payload.phone_number,
          });

        return {
            message: `responded to help message from ${payload.phone_number}: ${message}`,
        }
    }

    // check if we already sent no text alert to user
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, received_no_text_alert')
        .eq('phone_number', payload.phone_number)
        .single();
    
    if (userError) {
        logger.error("error checking if user received the no text alert", { userError });
        throw userError;
    }

    if (user!.received_no_text_alert) {
        return {
            message: `already sent no text alert to ${payload.phone_number} - skipping`,
        }
    }
    
    const message = await client.messages.create({
        body: `
        thanks for the message - we don’t respond to texts, but text "help" if you need support
        `,
        from: fromNumber,
        to: payload.phone_number,
    });

    const { error: updateUserError } = await supabase
        .from('users')
        .update({ received_no_text_alert: true })
        .eq('id', user!.id);

    if (updateUserError) {
        logger.error(`error updating user ${user!.id} 'received_no_text_alert' to true`, { updateUserError });
        throw updateUserError;
    }

    return {
      message: `no text alert sent to ${payload.phone_number}: ${message}`,
    }
  },
});