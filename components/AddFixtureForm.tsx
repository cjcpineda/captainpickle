"use client";

import { useActionState, useEffect, useRef } from "react";
import { scheduleMatch } from "@/app/actions.ts";

export function AddFixtureForm() {
  const [error, action, pending] = useActionState(scheduleMatch, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !error) form.current?.reset();
  }, [pending, error]);

  return (
    <form ref={form} action={action}>
      {error && <p className="error">{error}</p>}
      <div className="field">
        <label htmlFor="opponent">Opponent</label>
        <input id="opponent" name="opponent" placeholder="Bounce Philly" required />
      </div>
      <div className="field">
        <label htmlFor="playOn">Date</label>
        <input id="playOn" name="playOn" type="date" required />
      </div>
      <div className="field">
        <label htmlFor="location">Location</label>
        <input id="location" name="location" placeholder="Optional" />
      </div>
      <button className="button" disabled={pending}>
        {pending ? "Adding…" : "Add to schedule"}
      </button>
    </form>
  );
}
