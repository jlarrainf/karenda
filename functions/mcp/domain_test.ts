import {
  calculateMcpHabitStatistics,
  createPersonalGroup,
  mapHabitLog,
  DomainOperationError,
  toPublicHabitScheduleVersion,
  updatePersonalGroup,
  validateHabitStatisticsRange,
  type KarendaClient,
} from "./domain.ts";
import type { Habit, HabitLog, HabitScheduleVersion } from "../../src/types/domain.ts";
import type { McpPrincipal } from "./oauth.ts";

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
  koreaderLinkId: null,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

type MockDatabaseResult = {
  data: Record<string, unknown> | null;
  error: null;
};

type MockQuery = {
  insert: (rows: Record<string, unknown>[]) => MockQuery;
  update: (row: Record<string, unknown>) => MockQuery;
  select: (columns: string) => MockQuery;
  eq: (column: string, value: string) => MockQuery;
  single: () => Promise<MockDatabaseResult>;
  maybeSingle: () => Promise<MockDatabaseResult>;
};

function createMockCatalogClient(rows: Record<string, unknown>[]) {
  const selectedColumns: string[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];
  const responses = [...rows];
  const query: MockQuery = {
    insert: (input) => {
      insertedRows.push(...input);
      return query;
    },
    update: (input) => {
      updatedRows.push(input);
      return query;
    },
    select: (columns) => {
      selectedColumns.push(columns);
      return query;
    },
    eq: () => query,
    single: async () => ({ data: responses.shift() ?? null, error: null }),
    maybeSingle: async () => ({ data: responses.shift() ?? null, error: null }),
  };
  const client = {
    database: {
      from: () => query,
    },
  } as unknown as KarendaClient;
  return { client, selectedColumns, insertedRows, updatedRows };
}

const personalGroupColumns = "id, name, color, created_at, updated_at";
const ownerId = "10000000-0000-4000-8000-000000000001";
const personalGroupId = "20000000-0000-4000-8000-000000000002";
const personalGroupPrincipal = { ownerId } as McpPrincipal;

Deno.test("MCP personal group creation selects only columns available in its table", async () => {
  const row = {
    id: personalGroupId,
    name: "Freestyle",
    color: "#6D28D9",
    created_at: "2026-10-02T12:00:00.000Z",
    updated_at: "2026-10-02T12:00:00.000Z",
  };
  const mock = createMockCatalogClient([row]);

  const result = await createPersonalGroup(mock.client, personalGroupPrincipal, {
    name: row.name,
    color: row.color,
  });

  if (mock.selectedColumns.at(-1) !== personalGroupColumns) {
    throw new Error("Creating a personal group requested columns that the table does not have.");
  }
  if (result.id !== personalGroupId || mock.insertedRows[0]?.owner_id !== ownerId) {
    throw new Error("Creating a personal group did not return the persisted owned row.");
  }
});

Deno.test("MCP personal group updates select only columns available in its table", async () => {
  const currentRow = {
    id: personalGroupId,
    updated_at: "2026-10-02T12:00:00.000Z",
  };
  const updatedRow = {
    id: personalGroupId,
    name: "Freestyle FMS",
    color: null,
    created_at: "2026-10-02T12:00:00.000Z",
    updated_at: "2026-10-02T12:05:00.000Z",
  };
  const mock = createMockCatalogClient([currentRow, updatedRow]);

  const result = await updatePersonalGroup(
    mock.client,
    personalGroupPrincipal,
    personalGroupId,
    { name: updatedRow.name },
  );

  if (mock.selectedColumns.at(-1) !== personalGroupColumns) {
    throw new Error("Updating a personal group requested columns that the table does not have.");
  }
  if (result.name !== updatedRow.name || mock.updatedRows.length !== 1) {
    throw new Error("Updating a personal group did not return the persisted row.");
  }
});

Deno.test("MCP habit log mapping preserves KOReader provenance", () => {
  const linkedLog = mapHabitLog({
    id: "log-a",
    habit_id: "habit-a",
    local_date: "2026-06-01",
    value: 12,
    status: "completed",
    source: "koreader",
    external_id: "link-a:2026-06-01",
    koreader_link_id: "link-a",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  }, ownerId);

  if (linkedLog.koreaderLinkId !== "link-a") {
    throw new Error("MCP mapping dropped the KOReader habit link.");
  }
  if (mapHabitLog({ koreader_link_id: null }, ownerId).koreaderLinkId !== null) {
    throw new Error("Manual habit logs should have no KOReader link.");
  }
});
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
