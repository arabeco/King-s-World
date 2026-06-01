import { NextResponse } from "next/server";

/**
 * Migrado para Supabase Edge Function.
 * O cliente chama via supabase.functions.invoke("delete-account").
 */
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint migrado. Use a Edge Function delete-account via Supabase client." },
    { status: 410 },
  );
}
