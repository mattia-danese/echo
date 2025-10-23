import { and, eq } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const f = createUploadthing();

// const auth = (req: Request) => ({ id: "fakeId" }); // Fake auth function

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .input(z.object({ userId: z.number() }))
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req, input }) => {
      // // This code runs on your server before upload
      // const user = await auth(req);

      // // If you throw, the user will not be able to upload
      // if (!user) throw new UploadThingError("Unauthorized");

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.isDeleted, false)))
        .limit(1);

      if (!user) {
        console.log(
          `user with ID ${input.userId} not found but tried to upload profile picture`,
        );
        throw new UploadThingError("User not found");
      }

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: input.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // // This code RUNS ON YOUR SERVER after upload

      // console.log("Upload complete for userId:", metadata.userId);

      // console.log("file url", file.ufsUrl);

      // // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      // return { uploadedBy: metadata.userId };

      await db
        .update(users)
        .set({
          profilePictureUrl: file.ufsUrl,
        })
        .where(eq(users.id, metadata.userId));

      return { profilePictureUrl: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
