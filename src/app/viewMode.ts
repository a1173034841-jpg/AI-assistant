export type AppViewMode = "workbench" | "portfolio";

export function getAppViewMode(search: string): AppViewMode {
  const view = new URLSearchParams(search).get("view");
  return view === "portfolio" ? "portfolio" : "workbench";
}
