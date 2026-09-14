"use client";

import { useEffect, useRef, useState } from "react";

const TYPING_SPEED = 60;
const ERASING_SPEED = 30;
const PAUSE_AFTER_TYPED = 2200;
const PAUSE_BEFORE_NEXT = 400;

export function useTypewriterHeading(words: string[]) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const wordsRef = useRef(words);
  wordsRef.current = words;

  useEffect(() => {
    let charIdx = 0;
    let wordIdx = 0;
    let erasing = false;
    let timeout: NodeJS.Timeout;

    function tick() {
      const w = wordsRef.current;
      const currentWord = w[wordIdx];

      if (!erasing) {
        if (charIdx < currentWord.length) {
          charIdx++;
          setDisplayText(currentWord.slice(0, charIdx));
          timeout = setTimeout(tick, TYPING_SPEED);
        } else {
          timeout = setTimeout(() => {
            erasing = true;
            tick();
          }, PAUSE_AFTER_TYPED);
        }
      } else {
        if (charIdx > 0) {
          charIdx--;
          setDisplayText(currentWord.slice(0, charIdx));
          timeout = setTimeout(tick, ERASING_SPEED);
        } else {
          erasing = false;
          wordIdx = (wordIdx + 1) % w.length;
          setCurrentIndex(wordIdx);
          timeout = setTimeout(tick, PAUSE_BEFORE_NEXT);
        }
      }
    }

    timeout = setTimeout(tick, PAUSE_BEFORE_NEXT);
    return () => clearTimeout(timeout);
  }, []);

  return { displayText, currentIndex };
}
