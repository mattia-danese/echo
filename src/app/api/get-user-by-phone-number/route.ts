import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Supabase client with the service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Check if user exists with this phone number
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Handle unexpected errors (PGRST116 is "no rows returned" which is expected)
      throw error;
    }

    const userExists = !!existingUser;

    return NextResponse.json({ exists: userExists, id: existingUser?.id });

  } catch (error) {
    console.error('Error checking user existence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
