"use client";

import { useActionState } from "react";
import { syncNow } from "@/app/actions.ts";

export function SyncButton() {
  const [error, action, pending] = useActionState(syncNow, null);
  return (
    <form action={action}>
      <button className="button secondary small" disabled={pending}>
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
