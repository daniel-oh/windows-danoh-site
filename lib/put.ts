import { isLocal } from "./isLocal";
import { createServiceClient } from "./supabase/service";

export async function put(path: string, blob: Blob): Promise<string> {
  if (isLocal()) {
    const fs = await import("fs-extra");

    const buffer = await blob.arrayBuffer();
    const data = Buffer.from(buffer);
    await fs.outputFile(`${process.cwd()}/public/blob/${path}`, data);

    return `http://localhost:3000/blob/${path}`;
  }
  // Uploads to the public icons bucket on behalf of the app, not the
  // visitor, so the service client is the right identity here.
  const supabase = createServiceClient();

  const { error } = await supabase.storage.from("icons").upload(path, blob);

  if (error) {
    throw error;
  }

  return (await supabase.storage.from("icons").getPublicUrl(path)).data
    .publicUrl;
}
