import { getFsManager } from "@/state/fsManager";

// My Pictures is not empty on a first look: there is a photo of the person
// whose computer this is. Seeded when Explorer first opens, not at boot, so
// the 88 KB is only fetched by visitors who go looking. Once per browser:
// deleting it keeps it gone.
const SEEDED_FLAG = "danoh_pictures_seeded_v1";
export const PICTURES_DIR = "/user/My Pictures";
export const AT_HOME_PATH = `${PICTURES_DIR}/Me at home.jpg`;
const AT_HOME_URL = "/pictures/me-at-home.jpg";

/** Files Explorer opens in the Picture Viewer. */
export const PICTURE_FILE = /\.(png|jpe?g|gif|webp|bmp)$/i;

// Pictures that came with the site, described for screen readers. Anything
// else is named by its file.
export const DESCRIBED_PICTURES: Record<string, string> = {
  [AT_HOME_PATH]:
    "Daniel Oh sitting on a stool in his kitchen at night, in a black T-shirt and jeans, looking at the camera.",
};

let seeding: Promise<void> | null = null;

export function seedPictures(): Promise<void> {
  seeding ??= (async () => {
    try {
      if (localStorage.getItem(SEEDED_FLAG)) return;
      const fs = await getFsManager();
      if (!(await fs.getFolder(PICTURES_DIR, "shallow"))) await fs.createFolder(PICTURES_DIR);
      if (!(await fs.getItem(AT_HOME_PATH, "shallow"))) {
        const res = await fetch(AT_HOME_URL);
        if (!res.ok) return;
        await fs.writeFile(AT_HOME_PATH, await res.arrayBuffer());
      }
      localStorage.setItem(SEEDED_FLAG, "1");
    } catch {
      // Blocked storage or offline: My Pictures just has no photo in it.
    }
  })();
  return seeding;
}
