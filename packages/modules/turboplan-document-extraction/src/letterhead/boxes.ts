import type { Box } from "./types";

export const unionBox = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const centreOf = (box: Box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

export const clipBox = (box: Box, to: Box): Box | null => {
  const x = Math.max(box.x, to.x);
  const y = Math.max(box.y, to.y);
  const width = Math.min(box.x + box.width, to.x + to.width) - x;
  const height = Math.min(box.y + box.height, to.y + to.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
};
