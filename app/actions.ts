"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth.ts";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const ok = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return "Wrong email or password.";
  redirect("/");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
