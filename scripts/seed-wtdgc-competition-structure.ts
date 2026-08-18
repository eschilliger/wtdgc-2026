import {
  WTDGC_ROUNDS,
  type WtdgcDivision,
} from "../src/domain/wtdgc/competition";
import {
  WTDGC_EVENT_ID,
  competitionRoundId,
  competitionRoundRef,
  defaultMatchRosterRef,
} from "../src/server/repositories/competition.repository";

const DIVISIONS: readonly WtdgcDivision[] = ["open", "masters"];

function pairingMode(roundNumber: number) {
  if (roundNumber === 1) return "initial-seeding" as const;
  if (roundNumber <= 6) return "swiss-results" as const;
  return "post-swiss" as const;
}

async function seedRound(division: WtdgcDivision, round: (typeof WTDGC_ROUNDS)[number]) {
  const now = new Date().toISOString();
  await competitionRoundRef(division, round.roundNumber).set(
    {
      id: competitionRoundId(division, round.roundNumber),
      eventId: WTDGC_EVENT_ID,
      division,
      roundNumber: round.roundNumber,
      stage: round.stage,
      pairingMode: pairingMode(round.roundNumber),
      gameAssignmentsKnown: round.gameAssignmentsKnown,
      opponentTeamId: null,
      scheduledStart: null,
      course: null,
      startingHole: null,
      roster: null,
      rosterSubmissionLeadMinutes: 60,
      gameFormat: {
        totalGames: 4,
        singlesGames: 2,
        doublesGames: 2,
        doublesFormat: "modified-alternate-shot",
      },
      scoring: {
        gameWinPoints: 2,
        gameDrawPoints: 1,
        gameLossPoints: 0,
        matchWinPoints: 2,
        matchDrawPoints: 1,
        matchLossPoints: 0,
      },
      updatedAt: now,
    },
    { merge: true },
  );
}

async function ensureDefaultRoster(division: WtdgcDivision) {
  const ref = defaultMatchRosterRef(division);
  const snapshot = await ref.get();
  if (snapshot.exists) {
    console.log(`Default roster ${division}: already exists, preserved.`);
    return false;
  }

  const now = new Date().toISOString();
  await ref.set({
    id: division,
    eventId: WTDGC_EVENT_ID,
    division,
    roundNumber: null,
    kind: "default",
    selectedPlayerIds: [],
    slotAssignments: {},
    submittedAt: null,
    submissionDeadline: null,
    confirmed: false,
    status: "draft",
    eligibilityValidated: false,
    updatedAt: now,
  });

  console.log(`Default roster ${division}: draft placeholder created.`);
  return true;
}

async function main() {
  let roundCount = 0;
  let createdDefaultRosters = 0;

  for (const division of DIVISIONS) {
    for (const round of WTDGC_ROUNDS) {
      await seedRound(division, round);
      roundCount += 1;
    }
    if (await ensureDefaultRoster(division)) createdDefaultRosters += 1;
  }

  console.log(
    `WTDGC competition structure ready: ${roundCount} round documents synchronized, ` +
      `${createdDefaultRosters} default roster placeholder(s) created. Existing roster selections were never overwritten.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
