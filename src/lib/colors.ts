import { branding } from "./branding";

/**
 * Z hex barvy vygeneruje paletu odstínů pro Tailwind brand-*.
 * Vrací CSS proměnné jako string připravený k vložení do <style>.
 */
export function brandCssVariables(): string {
  const hex = branding.primaryColor.replace(/^#/, "");
  const { r, g, b } = hexToRgb(hex);

  const palette = {
    50: mix(r, g, b, 255, 0.92),
    100: mix(r, g, b, 255, 0.85),
    500: { r, g, b },
    600: mix(r, g, b, 0, 0.1),
    700: mix(r, g, b, 0, 0.25),
    900: mix(r, g, b, 0, 0.5),
  };

  return `:root {
${Object.entries(palette)
  .map(([k, v]) => `  --brand-${k}: ${v.r} ${v.g} ${v.b};`)
  .join("\n")}
}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function mix(
  r: number,
  g: number,
  b: number,
  target: number,
  amount: number,
): { r: number; g: number; b: number } {
  return {
    r: Math.round(r + (target - r) * amount),
    g: Math.round(g + (target - g) * amount),
    b: Math.round(b + (target - b) * amount),
  };
}
