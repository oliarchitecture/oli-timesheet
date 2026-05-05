import { LeaveType } from "@prisma/client";

const LEAVE_TYPE_TO_ABSENCE_CODE: Record<LeaveType, string> = {
  VACATION: "V",
  SICK: "S",
  COMP_DAY: "C",
  PERSONAL: "V", // no dedicated code; treat as Vacation
  OTHER: "V",    // fallback
};

/** Returns "H/D" for half-day entries, otherwise the leave-type absence code. */
export function absenceCodeForDay(type: LeaveType, halfDay: boolean): string {
  return halfDay ? "H/D" : LEAVE_TYPE_TO_ABSENCE_CODE[type];
}

/** Hours for a timesheet entry: 4 for half-day, 8 for full day. */
export function hoursForDay(halfDay: boolean): number {
  return halfDay ? 4 : 8;
}
