import type { DbId } from "../orca.d.ts";

export type PersistLane = "card" | "edge" | "area";

type LaneGen = { issued: number; applied: number };

const writeGens = new Map<DbId, Record<PersistLane, LaneGen>>();

function emptyGen(): LaneGen {
  return { issued: 0, applied: 0 };
}

export function laneGen(id: DbId, lane: PersistLane): LaneGen {
  let gen = writeGens.get(id);
  if (gen == null) {
    gen = {
      card: emptyGen(),
      edge: emptyGen(),
      area: emptyGen(),
    };
    writeGens.set(id, gen);
  }
  return gen[lane];
}

export function takeLaneSeq(id: DbId, lane: PersistLane): number {
  const gen = laneGen(id, lane);
  gen.issued += 1;
  return gen.issued;
}

/** Apply a write result only when its seq is strictly newer than the last applied. */
export function shouldApplyPersistSeq(
  appliedSeq: number,
  incomingSeq: number,
): boolean {
  return incomingSeq > appliedSeq;
}

export function shouldSendPersistSeq(
  issuedSeq: number,
  writeSeq: number,
): boolean {
  return writeSeq === issuedSeq;
}

export function resetPersistSeq(): void {
  writeGens.clear();
}
