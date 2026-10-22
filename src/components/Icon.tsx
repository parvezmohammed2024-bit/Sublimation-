const PATHS = {
  dashboard: "M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z",
  plus: "M12 5v14|M5 12h14",
  minus: "M5 12h14",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M22 21v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.3-4.3",
  check: "M20 6 9 17l-5-5",
  close: "M18 6 6 18|M6 6l12 12",
  warning: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01",
  calendar: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M16 2v4|M8 2v4|M3 10h18",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4",
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 15l-5-5L5 21",
  trash: "M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  arrowRight: "M5 12h14|M13 6l6 6-6 6",
  edit: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  key: "M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z|M12 11v10|M12 17h3|M12 20h2",
  phone: "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z|M11 18h2",
  copy: "M9 9h11v11H9z|M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  chat: "M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5z",
  money: "M2 6h20v12H2z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M6 12h.01|M18 12h.01",
  list: "M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01",
  undo: "M3 7v6h6|M21 17a9 9 0 0 0-15-6.7L3 13",
  refresh: "M21 12a9 9 0 1 1-2.6-6.4|M21 3v6h-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2",
  lock: "M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4",
  // sublimation stages
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z|M7.5 11.5h.01|M10 7.5h.01|M14.5 7.5h.01|M17 11h.01",
  print: "M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z",
  press: "M4 4h16v4H4z|M12 8v3|M3 13h18l-1 4H4z|M6 20h12|M8 2v2|M16 2v2",
  flame: "M12 22c4 0 7-2.7 7-6.8 0-3.5-2.5-6-4-8.2-.5 2-1.6 3-3 3.3.5-3-1-6-3.5-8.3C8.7 5.6 5 8.6 5 14.6 5 19.2 8 22 12 22z",
  shield: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z|M8.5 12l2.5 2.5 4.5-5",
  box: "M21 8 12 3 3 8v8l9 5 9-5z|M3 8l9 5 9-5|M12 13v8",
  truck: "M1 5h13v11H1z|M14 9h4.5l3.5 3.5V16h-8z|M5.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z|M17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  shirt: "M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z",
  drop: "M12 2.7 6.3 9a7.6 7.6 0 1 0 11.4 0z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].split("|").map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
