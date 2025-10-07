import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Check if user exists with this phone number
    const { data: existingUser, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      // Handle unexpected errors (PGRST116 is "no rows returned" which is expected)
      throw error;
    }

    const userExists = !!existingUser;

    return NextResponse.json({ exists: userExists, id: existingUser?.id });
  } catch (error) {
    console.error("Error checking user existence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
