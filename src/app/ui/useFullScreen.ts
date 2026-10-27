/** Le plein écran, celui du navigateur (F11 y mène aussi) : son état, que la coche du menu suit, et la bascule. */
import { useEffect, useState } from "react";

export function useFullScreen(onError: (message: string) => void) {
  const [fullScreen, setFullScreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const follow = () => setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  const toggle = () => {
    const done = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    done.catch(() => onError("Plein écran impossible : essayez F11"));
  };
  return [fullScreen, toggle] as const;
}
