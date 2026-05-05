import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "APPROVED", label: "Approved" },
] as const;

type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

interface StatusProgressProps {
  status: TimesheetStatus;
}

const statusIndex: Record<TimesheetStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 1,
  REVISION_REQUESTED: 1,
};

export function StatusProgress({ status }: StatusProgressProps) {
  const currentIndex = statusIndex[status];
  const isRejected = status === "REJECTED";
  const isRevision = status === "REVISION_REQUESTED";

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIndex || (i === currentIndex && !isRejected && !isRevision && status !== "DRAFT");
        const isCurrent = i === currentIndex;
        const isRejectedStep = isRejected && i === 1;
        const isRevisionStep = isRevision && i === 1;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold transition-colors",
                  isComplete && "border-primary-500 bg-primary-500 text-white",
                  isCurrent && !isComplete && !isRejectedStep && !isRevisionStep && "border-primary-500 bg-white text-primary-600",
                  isRejectedStep && "border-red-500 bg-red-500 text-white",
                  isRevisionStep && "border-amber-500 bg-amber-500 text-white",
                  !isComplete && !isCurrent && "border-neutral-300 bg-white text-neutral-400"
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 font-medium",
                  isComplete && "text-primary-600",
                  isCurrent && !isComplete && !isRejectedStep && !isRevisionStep && "text-primary-600",
                  isRejectedStep && "text-red-600",
                  isRevisionStep && "text-amber-600",
                  !isComplete && !isCurrent && "text-neutral-400"
                )}
              >
                {isRejectedStep ? "Rejected" : isRevisionStep ? "Revision" : step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mx-1 -mt-4",
                  i < currentIndex ? "bg-primary-500" : "bg-neutral-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
