// From wedgie-dev src/ui/device.ts; see WEDGIE-LICENSE.txt.
export function dir8(dx: number, dy: number) {
  const s = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  return ["right", "down right", "down", "down left", "left", "up left", "up", "up right"][s];
}
