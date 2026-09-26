import { randomInt } from "node:crypto";
import { SHOWCASE_PRIZES } from "./labels";
import type { ShowcaseCandidateGroup, ShowcasePublicWinner } from "./types";

/** Returns an integer in [0, maxExclusive). Injected in tests; CSPRNG in production. */
export type ShowcaseRandomInt = (maxExclusive: number) => number;

export const secureRandomInt: ShowcaseRandomInt = (maxExclusive) => randomInt(maxExclusive);

/** Uniform sample without replacement (partial Fisher–Yates). */
export function sampleShowcaseUniform<T>(items: readonly T[], count: number, random: ShowcaseRandomInt = secureRandomInt) {
  const pool = [...items];
  const take = Math.max(0, Math.min(count, pool.length));
  for (let index = 0; index < take; index += 1) {
    const target = index + random(pool.length - index);
    [pool[index], pool[target]] = [pool[target]!, pool[index]!];
  }
  return pool.slice(0, take);
}

/**
 * Weighted sample without replacement: each draw picks one ticket among all
 * remaining tickets, then removes that person so nobody is selected twice.
 */
export function sampleShowcaseWeighted<T extends { weight: number }>(
  items: readonly T[],
  count: number,
  random: ShowcaseRandomInt = secureRandomInt,
) {
  const pool = items.filter((item) => Number.isInteger(item.weight) && item.weight > 0);
  const selected: T[] = [];
  while (selected.length < count && pool.length > 0) {
    const totalTickets = pool.reduce((total, item) => total + item.weight, 0);
    let ticket = random(totalTickets);
    const index = pool.findIndex((item) => {
      if (ticket < item.weight) return true;
      ticket -= item.weight;
      return false;
    });
    selected.push(pool.splice(index, 1)[0]!);
  }
  return selected;
}

const GROUP_ORDER: readonly ShowcaseCandidateGroup[] = ["submitter", "experiencer"];

/** Plain text the operator pastes into the Mattermost announcement. */
export function buildShowcaseAnnouncement(eventTitle: string, winners: readonly ShowcasePublicWinner[]) {
  const lines = [`[${eventTitle}] 당첨자 안내`, ""];
  for (const group of GROUP_ORDER) {
    const groupWinners = winners
      .filter((winner) => winner.candidateGroup === group)
      .sort((left, right) => left.position - right.position);
    const prize = SHOWCASE_PRIZES[group];
    lines.push(`■ ${prize.title} · ${prize.prize} (${groupWinners.length}${prize.unit})`);
    if (groupWinners.length === 0) lines.push("- 당첨자 없음");
    groupWinners.forEach((winner, index) => {
      const person = `${winner.maskedName} (${winner.maskedStudentNumber})`;
      lines.push(`${index + 1}. ${group === "submitter" && winner.projectTitle ? `${winner.projectTitle} · ${person}` : person}`);
    });
    lines.push("");
  }
  lines.push("경품은 당첨자 Mattermost로 보내 드려요. 참여해 주셔서 감사합니다!");
  return lines.join("\n");
}
