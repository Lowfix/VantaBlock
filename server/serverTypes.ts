// Real Pterodactyl eggs (nest 1 "Minecraft") this panel can deploy. Each egg has
// its own startup command and its own name for the "which Minecraft version"
// variable, which is why this isn't just a single docker_image/startup pair.
export interface ServerTypeConfig {
  id: string;
  name: string;
  description: string;
  eggId: number;
  dockerImage: string;
  startup: string;
  environment: (version: string) => Record<string, string>;
}

export const SERVER_TYPES: ServerTypeConfig[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    description: "Official Mojang server — no plugins or mods.",
    eggId: 5,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_25",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
    environment: (version) => ({ SERVER_JARFILE: "server.jar", VANILLA_VERSION: version }),
  },
  {
    id: "paper",
    name: "Paper",
    description: "High-performance server with plugin support. Most popular choice.",
    eggId: 3,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_25",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}",
    environment: (version) => ({
      SERVER_JARFILE: "server.jar",
      MINECRAFT_VERSION: version,
      BUILD_NUMBER: "latest",
      DL_PATH: "",
    }),
  },
  {
    id: "forge",
    name: "Forge",
    description: "The original modding API — the base for most classic modpacks.",
    eggId: 4,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_25",
    startup:
      'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true $( [[  ! -f unix_args.txt ]] && printf %s "-jar {{SERVER_JARFILE}}" || printf %s "@unix_args.txt" )',
    environment: (version) => ({
      SERVER_JARFILE: "server.jar",
      MC_VERSION: version,
      BUILD_TYPE: "recommended",
      FORGE_VERSION: "",
    }),
  },
  {
    id: "neoforge",
    name: "NeoForge",
    description: "Modern fork of Forge — what most new modpacks use today.",
    eggId: 16,
    // NeoForge's bundled ModLauncher/ASM (for the MC versions this egg supports) can't
    // parse class files from newer JVMs — the egg itself only lists up to Java 17.
    dockerImage: "ghcr.io/pterodactyl/yolks:java_17",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true @unix_args.txt",
    environment: (version) => ({
      MC_VERSION: version,
      NEOFORGE_VERSION: "",
    }),
  },
  {
    id: "fabric",
    name: "Fabric",
    description: "Lightweight mod loader — popular for performance mods and tech-focused packs.",
    eggId: 15,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_25",
    startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
    environment: (version) => ({
      SERVER_JARFILE: "server.jar",
      MC_VERSION: version,
      FABRIC_VERSION: "latest",
      LOADER_VERSION: "latest",
    }),
  },
];

export function findServerType(id: string): ServerTypeConfig | undefined {
  return SERVER_TYPES.find((t) => t.id === id);
}
