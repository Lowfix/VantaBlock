import { status } from "minecraft-server-util";

export interface MinecraftPlayerStatus {
  online: number;
  max: number;
  names: string[];
}

export async function getMinecraftPlayerStatus(host: string, port: number): Promise<MinecraftPlayerStatus> {
  const result = await status(host, port, { timeout: 3000 });
  const sample = result.players.sample ?? [];
  return {
    online: result.players.online,
    max: result.players.max,
    names: sample.map((p) => p.name),
  };
}
