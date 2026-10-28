import Link from "next/link";
import { requireCaptain } from "@/lib/auth.ts";
import { logout } from "../actions.ts";
import { NavLinks } from "@/components/NavLinks.tsx";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const captain = await requireCaptain();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            League <span>Captain</span>
          </Link>
          <NavLinks />
          <form action={logout} className="who">
            <span>{captain.teamName}</span>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
