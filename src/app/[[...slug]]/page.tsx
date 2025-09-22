import { createClient } from "@supabase/supabase-js";
import Home from "./_components/home";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
    params: Promise<{
        slug?: string[];
    }>;
}

export default async function HomePage({ params }: PageProps) {
    const resolvedParams = await params;
    const token = resolvedParams.slug?.[0];

    const inviter = {
        'firstName': null as string | null,
        'link': null as string | null,
    }

  if (token) {
    const { data } = await supabase
      .from("users")
      .select("first_name")
      .eq("friend_link_token", token)
      .single();

    inviter.firstName = data?.first_name ?? null;
    inviter.link = token ?? null;
  }

  return <Home inviter={inviter} />;

}