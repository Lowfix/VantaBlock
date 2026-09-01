export interface MinecraftVersion {
  id: string;
  label: string;
}

// Curated list, newest first — "latest" always resolves to the newest release at deploy time.
export const minecraftVersions: MinecraftVersion[] = [
  { id: "latest", label: "Latest (recommended)" },
  { id: "1.21.4", label: "1.21.4" },
  { id: "1.21.3", label: "1.21.3" },
  { id: "1.21.1", label: "1.21.1" },
  { id: "1.20.6", label: "1.20.6" },
  { id: "1.20.4", label: "1.20.4" },
  { id: "1.20.1", label: "1.20.1" },
  { id: "1.19.4", label: "1.19.4" },
  { id: "1.19.2", label: "1.19.2" },
  { id: "1.18.2", label: "1.18.2" },
  { id: "1.17.1", label: "1.17.1" },
  { id: "1.16.5", label: "1.16.5" },
  { id: "1.12.2", label: "1.12.2" },
  { id: "1.8.9", label: "1.8.9" },
];
