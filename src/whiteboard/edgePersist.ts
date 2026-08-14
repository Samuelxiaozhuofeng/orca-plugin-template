import { flushAllSessionWrites } from "./useBoardPersist";

export async function flushAllEdgeWrites(): Promise<void> {
  await flushAllSessionWrites();
}
