---
description: Styling with Tailwind CSS and animations with Framer Motion
globs:
  - "**/*.tsx"
alwaysApply: false
---

# Styling

## Tailwind CSS

Use Tailwind CSS for all styling. Avoid inline styles and CSS modules.

## Conditional Classes

Use the `cn()` utility for conditional class names:

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "flex items-center gap-2",
  isActive && "bg-primary text-primary-foreground",
  disabled && "opacity-50 cursor-not-allowed"
)} />
```

## Animations

Use Framer Motion for animations. Wrap animated lists with `AnimatePresence` for exit animations.

```typescript
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence>
  {items.map((item) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {item.name}
    </motion.div>
  ))}
</AnimatePresence>
```

## Images

Always use `next/image` for images. Specify width and height to prevent layout shift. Use `priority` for above-the-fold images, `loading="lazy"` for below-fold.
