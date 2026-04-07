"use client";

import { FileText, Download } from "lucide-react";

interface Doc {
  id: string;
  fileName: string;
  fileSize: number | null;
  uploadedAt: string;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminDocumentList({
  reportId,
  documents,
}: {
  reportId: string;
  documents: Doc[];
}) {
  async function handleDownload(docId: string, fileName: string) {
    const res = await fetch(`/api/expenses/${reportId}/documents/${docId}/url`);
    if (!res.ok) return;
    const { url } = await res.json();
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-800">
          Supporting Documents ({documents.length})
        </h3>
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
              <button
                onClick={() => handleDownload(doc.id, doc.fileName)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
