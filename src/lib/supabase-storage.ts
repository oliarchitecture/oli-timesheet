import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const BUCKET = "expense-receipts";

export async function uploadReceipt(
  path: string,
  file: Buffer,
  contentType: string
) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function deleteReceipt(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function downloadReceipt(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Download failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedUrl(path: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
