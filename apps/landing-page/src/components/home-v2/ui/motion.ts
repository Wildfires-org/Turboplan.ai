// Framer Motion mirrors of the easing tokens in src/globals.css. Keep the two
// in sync — CSS uses the custom properties, framer needs the raw arrays.

// Strong ease-out for entrances/exits (`--ease-out-expo`).
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Strong ease-in-out for elements moving on screen (`--ease-in-out-strong`).
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
