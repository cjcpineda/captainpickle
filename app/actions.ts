"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCaptain, signIn, signOut } from "@/lib/auth.ts";
import { DEFAULT_DIVISION_ID, syncFromCpl } from "@/lib/cpl.ts";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const ok = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return "Wrong email or password.";
  redirect("/");
}

export async function logout() {
  await signOut();
  redirect("/login");
}

/** Pulls the captain's schedule and results from CPL now, into whichever database this server uses. */
export async function syncNow(): Promise<string | null> {
  const captain = await requireCaptain();
  try {
    await syncFromCpl(captain.teamName, process.env.CPL_DIVISION_ID || DEFAULT_DIVISION_ID);
  } catch (err) {
    console.error("CPL sync failed:", err);
    return "Couldn't reach CPL. Try again in a minute.";
  }
  revalidatePath("/", "layout");
  return null;
}
