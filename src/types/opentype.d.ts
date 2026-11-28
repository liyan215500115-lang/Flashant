declare module "opentype.js" {
  interface FontPath {
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }

  interface Glyph {
    index: number;
    unicode?: number;
  }

  interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): FontPath;
    getAdvanceWidth(text: string, fontSize: number): number;
    charToGlyph(text: string): Glyph;
  }

  export function parse(buffer: ArrayBuffer | Buffer): Font;
}
