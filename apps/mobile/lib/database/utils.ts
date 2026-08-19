export const normalizeUnNumber = (unNumber: string): string | null => {
  const trimmed = unNumber.trim();
  if (!trimmed || !/^\d{1,4}$/.test(trimmed)) {
    return null;
  }
  return trimmed.padStart(4, '0');
};
