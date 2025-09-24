// app/auth/callback/route.ts  (App Router API route)
import { createUser } from "@/app/actions";
import { NextResponse } from "next/server";

type AccountStatus =  "created" | "error";

export async function GET(req: Request) {
    let accountStatus: AccountStatus;

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    const formParams = new URLSearchParams(decodeURIComponent(state));
    
    try {
        const result = await createUser({
          first_name: formParams.get('firstName') || '',
          last_name: formParams.get('lastName') || '',
          phone_number: decodeURIComponent(formParams.get('phoneNumber') || ''),
          spotify_code: code,
          referral_friend_link_token: formParams.get('friendLinkToken') || '',
        });

        if (result.ok) {            
            // TODO: TEST THIS
        //   if (result.created) {
        //     sendOnboardingMessage({ phone_number: userData.phoneNumber });
        //   }

          accountStatus = 'created'
        } else {
          accountStatus = 'error'
        }
      } catch (error) {
        console.error('Error calling createUser server action:', error);
        accountStatus = 'error'
      } 
  
  const friendLinkToken = formParams.get('friendLinkToken');
  const redirectUrl = friendLinkToken 
    ? new URL(`/${friendLinkToken}`, req.url)
    : new URL('/', req.url);
  redirectUrl.searchParams.set('accountStatus', accountStatus);
  
  return NextResponse.redirect(redirectUrl);
}