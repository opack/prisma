/** L'état du lecteur et du suivi de la lecture, suivis par Vue. */
import { player } from "./player.ts";
import { follow } from "../score/follow.ts";
import { useExternal } from "../useExternal.ts";

/** Ce que joue le lecteur : son état, l'instant joué, la section, les mesures… */
export const usePlayer = () => useExternal(player.subscribe, player.getSnapshot);

/** Le suivi : voulu (le bouton), ou en ce moment (voulu, et sans promenade à la main). */
export const useFollowing = (now = false) => useExternal(follow.subscribe, now ? follow.active : follow.enabled);
