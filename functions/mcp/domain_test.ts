import {
  calculateMcpHabitStatistics,
  DomainOperationError,
  toPublicHabitScheduleVersion,
  validateHabitStatisticsRange,
} from "./domain.ts";
import type { Habit, HabitLog, HabitScheduleVersion } from "../../src/types/domain.ts";

const schedule: Habit["schedule"] = {
  unit: "day",
  interval: 1,
  weekdays: [],
  dayOfMonth: null,
  anchorDate: null,
};

const habit: Habit = {
  id: "habit-a",
  ownerId: "owner-a",
  name: "Leer",
  description: null,
  color: null,
  subjectId: null,
  personalGroupId: null,
  trackingType: "boolean",
  unit: null,
  goalValue: 1,
  evaluationMode: "scheduled_occurrence",
  quotaPeriod: null,
  missPolicy: "mark_missed",
  schedule,
  startDate: "2026-06-01",
  endDate: null,
  lifecycleStatus: "active",
  statsEnabled: true,
  notePolicy: "none",
  calendarEnabled: false,
  calendarSchedule: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const version: HabitScheduleVersion = {
  id: "version-a",
  ownerId: "owner-a",
  habitId: "habit-a",
  schedule,
  evaluationMode: "scheduled_occurrence",
  goalValue: 1,
  quotaPeriod: null,
  missPolicy: "mark_missed",
  effectiveFrom: "2026-06-01",
  effectiveTo: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const log: HabitLog = {
  id: "log-a",
  ownerId: "owner-a",
  habitId: "habit-a",
  localDate: "2026-06-01",
  value: 1,
  status: "completed",
  source: "manual",
  externalId: null,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

Deno.test("MCP habit statistics reuse Karenda's schedule, completion, and miss calculations", () => {
  const result = calculateMcpHabitStatistics(
    habit,
    [version],
    [log],
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
    "America/Santiago",
  ) as Record<string, unknown>;

  if (result.completedCount !== 1 || result.missedCount !== 1 || result.completionPercentage !== 50) {
    throw new Error("MCP statistics diverged from the web habit evaluation rules.");
  }
  if (result.timeZone !== "America/Santiago" || result.today !== "2026-06-03") {
    throw new Error("Statistics omitted their date interpretation context.");
  }
});

Deno.test("public habit schedule versions omit the internal owner identifier", () => {
  const publicVersion = toPublicHabitScheduleVersion(version);
  if ("ownerId" in publicVersion) throw new Error("A schedule version exposed its owner identifier.");
  if (publicVersion.id !== version.id || publicVersion.habitId !== version.habitId) {
    throw new Error("A public schedule version omitted its resource identifiers.");
  }
});

Deno.test("habit statistics accept at most 366 inclusive calendar days", () => {
  validateHabitStatisticsRange("2026-01-01", "2027-01-01");
  try {
    validateHabitStatisticsRange("2026-01-01", "2027-01-02");
  } catch (error) {
    if (error instanceof DomainOperationError && error.code === "invalid_argument") return;
    throw error;
  }
  throw new Error("A 367-day inclusive statistics range was accepted.");
});
