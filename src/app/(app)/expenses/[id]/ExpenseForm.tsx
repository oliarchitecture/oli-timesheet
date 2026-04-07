"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Upload, FileText, Download, Loader2 } from "lucide-react";
import type { ExpenseCategory } from "@prisma/client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRANSPORTATION: "Transportation",
  MEALS: "Meals",
  ACCOMMODATION: "Accommodation",
  OTHER: "Other",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

interface Project {
  id: string;
  name: string;
}

interface LineItem {
  _key: string;
  projectId: string;
  date: string;
  category: ExpenseCategory;
  otherDescription: string;
  description: string;
  amount: string;
}

interface Document {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
}

interface ExpenseFormProps {
  reportId: string;
  month: number;
  year: number;
  status: string;
  advanceAmount: number;
  notes: string | null;
  reviewComment: string | null;
  initialItems: Array<{
    id: string;
    projectId: string;
    date: string | Date;
    category: ExpenseCategory;
    otherDescription: string | null;
    description: string;
    amount: number;
  }>;
  initialDocuments: Document[];
  projects: Project[];
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExpenseForm({
  reportId,
  month,
  year,
  status,
  advanceAmount: initialAdvance,
  notes: initialNotes,
  reviewComment,
  initialItems,
  initialDocuments,
  projects,
}: ExpenseFormProps) {
  const router = useRouter();
  const isDraft = status === "DRAFT";

  const [items, setItems] = useState<LineItem[]>(() =>
    initialItems.map((item) => ({
      _key: makeKey(),
      projectId: item.projectId,
      date: typeof item.date === "string"
        ? item.date.slice(0, 10)
        : new Date(item.date).toISOString().slice(0, 10),
      category: item.category,
      otherDescription: item.otherDescription ?? "",
      description: item.description,
      amount: String(item.amount),
    }))
  );

  const [advance, setAdvance] = useState(String(initialAdvance || "0"));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const amountDue = total - (parseFloat(advance) || 0);

  function addItem() {
    const today = new Date().toISOString().slice(0, 10);
    setItems((prev) => [
      ...prev,
      { _key: makeKey(), projectId: projects[0]?.id ?? "", date: today, category: "TRANSPORTATION", otherDescription: "", description: "", amount: "" },
    ]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i._key !== key));
  }

  function updateItem(key: string, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: value } : i))
    );
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceAmount: parseFloat(advance) || 0,
          notes: notes || null,
          items: items.map((i) => ({
            projectId: i.projectId,
            date: i.date,
            category: i.category,
            otherDescription: i.category === "OTHER" ? i.otherDescription : null,
            description: i.description,
            amount: parseFloat(i.amount) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      // Save first
      const saveRes = await fetch(`/api/expenses/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceAmount: parseFloat(advance) || 0,
          notes: notes || null,
          items: items.map((i) => ({
            projectId: i.projectId,
            date: i.date,
            category: i.category,
            otherDescription: i.category === "OTHER" ? i.otherDescription : null,
            description: i.description,
            amount: parseFloat(i.amount) || 0,
          })),
        }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        setError(data.error ?? "Failed to save");
        return;
      }

      const res = await fetch(`/api/expenses/${reportId}/submit`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/expenses/${reportId}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Upload failed");
        return;
      }
      const doc = await res.json();
      setDocuments((prev) => [...prev, doc]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteDoc(docId: string) {
    const res = await fetch(`/api/expenses/${reportId}/documents/${docId}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  }

  async function handleDownloadDoc(docId: string, fileName: string) {
    const res = await fetch(`/api/expenses/${reportId}/documents/${docId}/url`);
    if (!res.ok) return;
    const { url } = await res.json();
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  }

  const canSubmit = isDraft && items.length > 0 && items.every((i) => i.projectId && i.date && i.description && parseFloat(i.amount) > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">
            Expense Report — {MONTH_NAMES[month - 1]} {year}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isDraft ? "Fill in your expenses and upload receipts." : "View your submitted expense report."}
          </p>
        </div>
        <Badge variant={statusVariant[status] ?? "secondary"}>{status}</Badge>
      </div>

      {reviewComment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Review comment: </span>{reviewComment}
        </div>
      )}

      {/* Line Items */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">Expense Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-32">Date</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-44">Project</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-36">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Description</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-600 w-28">Amount ($)</th>
                {isDraft && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={isDraft ? 6 : 5} className="px-4 py-8 text-center text-neutral-400">
                    No items yet. Click &ldquo;Add Item&rdquo; below.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item._key}>
                  <td className="px-4 py-2">
                    {isDraft ? (
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateItem(item._key, "date", e.target.value)}
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    ) : (
                      new Date(item.date).toLocaleDateString("en-US")
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isDraft ? (
                      <select
                        value={item.projectId}
                        onChange={(e) => updateItem(item._key, "projectId", e.target.value)}
                        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      projects.find((p) => p.id === item.projectId)?.name ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isDraft ? (
                      <div className="space-y-1">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item._key, "category", e.target.value as ExpenseCategory)}
                          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                          ))}
                        </select>
                        {item.category === "OTHER" && (
                          <input
                            type="text"
                            placeholder="Please specify…"
                            value={item.otherDescription}
                            onChange={(e) => updateItem(item._key, "otherDescription", e.target.value)}
                            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        )}
                      </div>
                    ) : (
                      item.category === "OTHER"
                        ? `Other: ${item.otherDescription}`
                        : CATEGORY_LABELS[item.category]
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isDraft ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item._key, "description", e.target.value)}
                        placeholder="e.g. Uber to JFK"
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    ) : (
                      item.description
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isDraft ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(item._key, "amount", e.target.value)}
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    ) : (
                      <span className="block text-right">${parseFloat(item.amount).toFixed(2)}</span>
                    )}
                  </td>
                  {isDraft && (
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeItem(item._key)}
                        className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-neutral-100 px-6 py-4 space-y-2">
          {isDraft && (
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          )}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-neutral-500">Total</span>
              <span className="font-semibold w-24 text-right">${total.toFixed(2)}</span>
            </div>
            <div className="flex gap-8 items-center">
              <span className="text-neutral-500">Less Advance</span>
              {isDraft ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  className="w-24 rounded border border-neutral-300 px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              ) : (
                <span className="w-24 text-right">${(parseFloat(advance) || 0).toFixed(2)}</span>
              )}
            </div>
            <div className="flex gap-8 border-t border-neutral-200 pt-1">
              <span className="text-neutral-800 font-medium">Amount Due</span>
              <span className="font-bold w-24 text-right text-primary-600">${amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        {isDraft ? (
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context for your expense report…"
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        ) : (
          <p className="text-sm text-neutral-700">{notes || <span className="text-neutral-400">No notes.</span>}</p>
        )}
      </div>

      {/* Receipts */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">Supporting Documents</h3>
          {isDraft && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload Receipt"}
              </Button>
            </div>
          )}
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">No documents uploaded.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-sm text-neutral-800">{doc.fileName}</p>
                    {doc.fileSize && (
                      <p className="text-xs text-neutral-400">{fmtSize(doc.fileSize)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadDoc(doc.id, doc.fileName)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {isDraft && (
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      {isDraft && (
        <div className="flex gap-3">
          <Button onClick={handleSave} variant="outline" disabled={saving || submitting}>
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving || submitting}>
            {submitting ? "Submitting…" : "Submit for Approval"}
          </Button>
        </div>
      )}
    </div>
  );
}
