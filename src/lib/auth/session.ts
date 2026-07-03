import "server-only";

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { ProfileRow } from "@/lib/database.types";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ClerkSessionUser = {
  id: string;
  email?: string;
  fullName?: string;
};

export type SessionProfileState =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "profile_missing"; user: ClerkSessionUser }
  | { status: "authenticated"; user: ClerkSessionUser; profile: ProfileRow };

export async function getSessionProfile(): Promise<SessionProfileState> {
  if (!hasSupabaseServerConfig() || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return { status: "not_configured" };
  }

  const { userId } = await auth();

  if (!userId) {
    return { status: "unauthenticated" };
  }

  const clerkUser = await currentUser();
  const user: ClerkSessionUser = {
    id: userId,
    email: clerkUser?.primaryEmailAddress?.emailAddress,
    fullName: clerkUser?.fullName ?? undefined,
  };

  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { status: "profile_missing", user };
  }

  return { status: "authenticated", user, profile };
}

export async function requireSessionProfile() {
  const state = await getSessionProfile();

  if (state.status === "unauthenticated") {
    redirect("/sign-in");
  }

  return state;
}
