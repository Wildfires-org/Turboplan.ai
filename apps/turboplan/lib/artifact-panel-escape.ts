// Whether an Escape keydown that reached `window` closes the artifact panel.
// An Escape a dialog or menu in the panel already handled does not: Radix
// prevents its default before dismissing — also when the dialog unmounts on
// close, which a React `stopPropagation` in it could not cover any more.
export const shouldCloseOnEscape = (
  event: Pick<KeyboardEvent, "key" | "defaultPrevented">,
) => event.key === "Escape" && !event.defaultPrevented;
