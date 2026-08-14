import type { CardBoxPatch } from "./boardSession";
import { flushAllSessionWrites } from "./useBoardPersist";

export type { CardBoxPatch };

export async function flushAllCardWrites(): Promise<void> {
  await flushAllSessionWrites();
}
