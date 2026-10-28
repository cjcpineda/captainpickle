"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCaptain, signIn, signOut } from "@/lib/auth.ts";
import { addFixture, deleteFixture } from "@/lib/repo.ts";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const ok = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return "Wrong email or password.";
  redirect("/");
}

export async function logout() {
  await signOut();
  redirect("/login");
}

export async function scheduleMatch(_: string | null, form: FormData): Promise<string | null> {
  const captain = await requireCaptain();
  const opponent = String(form.get("opponent") ?? "").trim();
  const playOn = String(form.get("playOn") ?? "");
  const location = String(form.get("location") ?? "").trim() || null;
  if (!opponent || !/^\d{4}-\d{2}-\d{2}$/.test(playOn)) return "Add an opponent and a date.";
  addFixture(captain.teamId, opponent, playOn, location);
  revalidatePath("/");
  return null;
}

export async function removeMatch(fixtureId: number) {
  const captain = await requireCaptain();
  deleteFixture(captain.teamId, fixtureId);
  revalidatePath("/");
}
