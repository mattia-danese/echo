import { sendMessagesTask } from "@/trigger/send-messages";

// Numbers that didn't receive messages after +16465107923
const remainingNumbers = {
  "+19175356307": [
    "start the echo :) you've got 10 hours left to share what you've been listening to",
    "https://text-echo.com/session/_Ei3HqDmNoxzE8orvwE0JQ",
  ],
  "+14083861790": [
    "hey we noticed you haven't shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
    "https://text-echo.com/session/bwuvZtQBfQi01ujuQND0ng",
  ],
  "+13142613007": [
    "hey we noticed you haven't shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
    "https://text-echo.com/session/8r3_1VFrxPrnIhPWqlSqwA",
  ],
  "+16462326499": [
    "hey we noticed you haven't shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
    "https://text-echo.com/session/IRlDe3E7ZNNAcpOJnprxbg",
  ],
  "+16288000781": [
    "hey we noticed you haven't shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
    "https://text-echo.com/session/lbmMUhS3LRdoDB0TsYK97Q",
  ],
  "+17722333539": [
    "start the echo :) you've got 10 hours left to share what you've been listening to",
    "https://text-echo.com/session/ELDhmPu8INPNhcU0rwYD3g",
  ],
  "+17815186434": [
    "get ready - echo playlists come out tonight",
  ],
  "+19175457215": [
    "get ready - echo playlists come out tonight",
  ],
};

async function retryMessages() {
  console.log("Triggering send-messages task for remaining recipients...");

  const handle = await sendMessagesTask.trigger({
    data: remainingNumbers,
  });

  console.log("Task triggered successfully!");
  console.log("Run ID:", handle.id);
  console.log("Check status at: https://cloud.trigger.dev");
}

retryMessages()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
