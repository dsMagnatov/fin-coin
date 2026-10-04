const clamp = value => Math.max(0, Math.min(1, value));

/** Reading advances while the full paragraph stays in the viewport. */
export function storyProgress(sectionTop, sectionHeight, viewportHeight) {
  const distance = sectionHeight - viewportHeight;
  return distance > 0 ? clamp(-sectionTop / distance) : 0;
}

/** Each word or inline coin occupies one position in the reading sequence. */
export function tokenReveal(progress, index, count) {
  return count > 0 ? clamp(clamp(progress) * count - index) : 0;
}

export function coinIsRevealed(progress, index, count) {
  return count > 0 && clamp(progress) * count >= index + 1;
}
