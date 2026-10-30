/** Le relais de lecture pCloud, en fonction Netlify (voir src/server/pcloudFile.ts). */
import { pcloudFile } from "../../src/server/pcloudFile.ts";

export default (req: Request) => pcloudFile(req);

export const config = { path: "/api/pcloud-file" };
