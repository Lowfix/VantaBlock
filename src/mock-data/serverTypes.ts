export interface ServerType {
  id: string;
  name: string;
  description: string;
}

// Mirrors server/serverTypes.ts — these map to real Pterodactyl eggs.
export const serverTypes: ServerType[] = [
  { id: "vanilla", name: "Vanilla", description: "Official Mojang server — no plugins or mods." },
  { id: "paper", name: "Paper", description: "High-performance server with plugin support. Most popular choice." },
  { id: "fabric", name: "Fabric", description: "Lightweight mod loader — popular for performance mods and tech-focused packs." },
  { id: "forge", name: "Forge", description: "The original modding API — the base for most classic modpacks." },
  { id: "neoforge", name: "NeoForge", description: "Modern fork of Forge — what most new modpacks use today." },
];
