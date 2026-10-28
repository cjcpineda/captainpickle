"use client";

import { useState, useTransition } from "react";
import { previewPractice, savePracticeGames, type Preview } from "@/app/(app)/practice/actions.ts";
import { leagueToday } from "@/lib/deadline.ts";

export function PracticeUpload() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fallbackDate, setFallbackDate] = useState(() => leagueToday());
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const read = (form: FormData) =>
    startTransition(async () => {
      setMessage(null);
      const result = await previewPractice(form);
      if ("error" in result) setMessage({ error: result.error });
      else setPreview(result);
    });

  const save = () =>
    startTransition(async () => {
      if (!preview) return;
      const result = await savePracticeGames({ fileName: preview.fileName, fallbackDate, games: preview.games });
      if ("error" in result) return setMessage({ error: result.error });
      setMessage({ ok: `Saved ${preview.games.length} games from ${preview.fileName}.` });
      setPreview(null);
    });

  if (preview) {
    const undated = preview.games.some((g) => !g.playedOn);
    return (
      <div className="preview">
        <p>
          Found <b>{preview.games.length} games</b> in {preview.fileName}. Check them before saving.
        </p>
        {preview.newPlayers.length > 0 && (
          <p className="notice">
            Not on your roster, so they&apos;ll be added as new players: {preview.newPlayers.join(", ")}. If any of these
            are typos, fix the file and upload again.
          </p>
        )}
        {undated && (
          <div className="field">
            <label htmlFor="fallbackDate">Date for games without one</label>
            <input id="fallbackDate" type="date" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} />
          </div>
        )}
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Side A</th>
                <th>Side B</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {preview.games.map((g, i) => (
                <tr key={i}>
                  <td className="sub">{g.playedOn ?? "–"}</td>
                  <td>{g.a.join(" & ")}</td>
                  <td>{g.b.join(" & ")}</td>
                  <td className="num">
                    {g.scoreA}–{g.scoreB}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message?.error && <p className="error">{message.error}</p>}
        <div className="actions">
          <button className="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : `Save ${preview.games.length} games`}
          </button>
          <button className="button secondary" onClick={() => setPreview(null)} disabled={pending}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={read}>
      {message?.ok && <p className="success">{message.ok}</p>}
      {message?.error && <p className="error">{message.error}</p>}
      <div className="field">
        <label htmlFor="file">Practice file</label>
        <input id="file" name="file" type="file" accept=".csv,.txt,.pdf,image/*" required />
      </div>
      <p className="sub">
        Fastest: the <a href="/practice-template.csv">CSV template</a>, one row per game. Any other layout, a PDF, or a
        photo of your scoresheet works too: the AI reads it, and you check the result before anything is saved.
      </p>
      <button className="button" disabled={pending}>
        {pending ? "Reading…" : "Read file"}
      </button>
    </form>
  );
}
