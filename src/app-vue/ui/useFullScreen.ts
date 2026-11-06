/** Le plein écran, celui du navigateur (F11 y mène aussi) : son état, que la coche du menu suit, et la bascule. */
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";

export function useFullScreen(onError: (message: string) => void) {
  const fullScreen = ref(!!document.fullscreenElement);
  useEventListener(document, "fullscreenchange", () => (fullScreen.value = !!document.fullscreenElement));
  const toggle = () => {
    const done = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    done.catch(() => onError("Plein écran impossible : essayez F11"));
  };
  return { fullScreen, toggle };
}
