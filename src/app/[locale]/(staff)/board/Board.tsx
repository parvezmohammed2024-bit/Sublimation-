"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { moveJob } from "../jobs/transition";

export interface BoardJob {
  id: string;
  jobNo: string;
  customer: string;
  qty: number;
  due: string | null;
  overdue: boolean;
  rush: boolean;
}
export interface BoardColumn {
  key: string;
  label: string;
  side: boolean;
  jobs: BoardJob[];
}

interface Labels {
  rush: string;
  overdue: string;
  reasonPrompt: string;
  errors: Record<string, string>;
  dragHint: string;
  empty: string;
}

export function Board({ columns, locale, labels }: { columns: BoardColumn[]; locale: string; labels: Labels }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const drop = (to: string, jobId: string, from: string) => {
    setOver(null);
    if (to === from) return;
    start(async () => {
      setMessage(null);
      let res = await moveJob({ jobId, to, locale });
      if (!res.ok && res.code === "REASON_REQUIRED") {
        const reason = window.prompt(labels.reasonPrompt);
        if (!reason) return;
        res = await moveJob({ jobId, to, locale, reason });
      }
      if (!res.ok) setMessage(labels.errors[res.code] ?? labels.errors.FAILED);
      router.refresh();
    });
  };

  return (
    <div>
      <p className="mb-2 hidden text-xs text-muted md:block">{labels.dragHint}</p>
      {message && <p role="alert" className="mb-2 rounded-lg bg-bad/10 p-3 text-sm text-bad">{message}</p>}
      <div className={`-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 ${pending ? "opacity-70" : ""}`}>
        {columns.map((col) => (
          <section
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const [jobId, from] = e.dataTransfer.getData("text/plain").split("|");
              if (jobId) drop(col.key, jobId, from);
            }}
            className={`w-64 shrink-0 rounded-xl border p-2 ${over === col.key ? "border-brand bg-brand/5" : "border-line bg-card"} ${col.side ? "border-dashed" : ""}`}
          >
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              <span>{col.label}</span>
              <span className="rounded-full bg-bg px-2 text-xs text-muted">{col.jobs.length}</span>
            </h2>
            <ul className="space-y-2">
              {col.jobs.map((j) => (
                <li
                  key={j.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", `${j.id}|${col.key}`)}
                  className="cursor-grab rounded-lg border border-line bg-bg p-3 text-sm active:cursor-grabbing"
                >
                  <Link href={`/jobs/${j.id}`} className="block">
                    <p className="flex items-center justify-between gap-2 font-semibold">
                      {j.jobNo}
                      {j.rush && <span className="rounded-full bg-bad px-2 text-xs font-medium text-white">{labels.rush}</span>}
                    </p>
                    <p className="truncate text-muted">{j.customer} · {j.qty}</p>
                    {j.due && (
                      <p className={j.overdue ? "font-medium text-bad" : "text-muted"}>
                        {j.overdue ? `${labels.overdue}: ` : ""}{j.due}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
              {col.jobs.length === 0 && <li className="px-1 py-2 text-xs text-muted">{labels.empty}</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
