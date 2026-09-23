import { isLocal } from "./isLocal";
import { createServiceClient } from "./supabase/service";

export async function put(path: string, blob: Blob): Promise<string> {
  if (isLocal()) {
    // Production runs in local mode too (see CLAUDE.md), where this branch
    // would write into the container with no size limit and hand back a
    // localhost URL no visitor can load. It is for `npm run dev` only.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Icon storage is not configured in production");
    }
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
