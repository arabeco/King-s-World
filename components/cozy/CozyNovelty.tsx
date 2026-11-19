"use client";

import {useEffect,useState} from "react";
import type {CozyCommand} from "./useCozyWorld";
import styles from "./cozy-novelty.module.css";

export function CozyNovelty({corner = false}: {corner?: boolean}) {
  return <span role="img" aria-label="Novidade" className={styles.dot} data-novelty="" data-corner={corner || undefined}/>;
}

export function useNoticeVisible(id: string | undefined, act: (action:CozyCommand)=>Promise<boolean>) {
  const [element,setElement] = useState<HTMLElement|null>(null);
  useEffect(() => {
    if (!id || !element) return;
    let active = true;
    let visible = false;
    let sending = false;
    let attempt = 0;
    let timer: number | undefined;
    const acknowledge = async () => {
      if (!visible || document.hidden || !active || sending) return;
      sending = true;
      const ok = await act({type:"notice_seen",id});
      sending = false;
      if (!active) return;
      if (ok) observer.disconnect();
      else if (++attempt < 3) timer = window.setTimeout(acknowledge,1200 * attempt);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      if (visible) void acknowledge();
    },{threshold:0.5});
    const resume = () => { attempt = 0; void acknowledge(); };
    observer.observe(element);
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("online",resume);
    return () => {
      active = false;
      observer.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("online",resume);
    };
  },[element,id,act]);
  return setElement;
}

export function VisibleNotice({id,act,quiet = false}: {id:string|undefined;act:(action:CozyCommand)=>Promise<boolean>;quiet?:boolean}) {
  const ref = useNoticeVisible(id,act);
  if (!id) return null;
  if (quiet) return <span ref={ref} className={styles.anchor} aria-hidden="true"/>;
  return <span ref={ref} className={styles.visible}><CozyNovelty/></span>;
}
