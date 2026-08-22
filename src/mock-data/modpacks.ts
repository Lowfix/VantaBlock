export interface Modpack {
  id: string;
  name: string;
  modCount: number;
  version: string;
  description: string;
}

export const modpacks: Modpack[] = [
  {
    id: "mp-atm9",
    name: "All the Mods 9",
    modCount: 421,
    version: "1.20.1",
    description: "A kitchen-sink pack covering tech, magic, and exploration with nearly every popular mod included.",
  },
  {
    id: "mp-create-aab",
    name: "Create: Above and Beyond",
    modCount: 187,
    version: "1.18.2",
    description: "A Create-focused questing pack built around automating contraptions to climb the tech tree.",
  },
  {
    id: "mp-vault-hunters",
    name: "Vault Hunters",
    modCount: 264,
    version: "1.18.2",
    description: "Dive into procedurally generated dungeon vaults to gear up and level a custom skill tree.",
  },
  {
    id: "mp-rlcraft",
    name: "RLCraft",
    modCount: 118,
    version: "1.12.2",
    description: "A brutally difficult survival overhaul with reworked combat, hunger, and hostile mobs.",
  },
  {
    id: "mp-prominence-2",
    name: "Prominence II",
    modCount: 356,
    version: "1.20.1",
    description: "A long-form RPG-style progression pack with custom questlines and hundreds of hours of content.",
  },
  {
    id: "mp-skyfactory-5",
    name: "SkyFactory 5",
    modCount: 203,
    version: "1.18.2",
    description: "A skyblock pack where every resource must be automated and generated from nothing.",
  },
];
