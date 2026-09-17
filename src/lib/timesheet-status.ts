export type TimesheetStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED";

/**
 * A week that belongs to a reporting period inherits that period's status for the
 * purposes of locking. The period is the unit an admin approves or returns, so it is
 * the single source of truth — week rows can lag behind (e.g. a week shared between two
 * periods keeps its old status when it is re-parented).
 */
export function effectiveStatus(
  weekStatus: TimesheetStatus,
  periodStatus?: TimesheetStatus | null
): TimesheetStatus {
  return periodStatus ?? weekStatus;
}

/**
 * Statuses an employee is expected to be able to work on.
 *
 * REJECTED is included deliberately: there is no "discard and start over" in this app, so
 * a rejected timesheet still has to be corrected and sent back. Treating it as final left
 * employees with read-only hours and no way forward.
 */
const EMPLOYEE_EDITABLE: readonly TimesheetStatus[] = ["DRAFT", "REVISION_REQUESTED", "REJECTED"];

/** Whether the hour cells of a week may be edited. Admins only touch drafts. */
export function canEditTimesheet({
  weekStatus,
  periodStatus,
  isAdmin = false,
}: {
  weekStatus: TimesheetStatus;
  periodStatus?: TimesheetStatus | null;
  isAdmin?: boolean;
}): boolean {
  const status = effectiveStatus(weekStatus, periodStatus);
  if (isAdmin) return status === "DRAFT";
  return EMPLOYEE_EDITABLE.includes(status);
}

/** Whether an employee may (re)submit a period in this status. */
export function canSubmitTimesheet(status: TimesheetStatus): boolean {
  return EMPLOYEE_EDITABLE.includes(status);
}

export const statusVariant: Record<
  string,
  "success" | "warning" | "secondary" | "destructive"
> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  REVISION_REQUESTED: "warning",
};

export const statusLabel: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "Revision Requested",
};
