declare module "opentype.js" {
  interface FontPath {
    toPathData(decimalPlaces?: number): string;
  }

  interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): FontPath;
    getAdvanceWidth(text: string, fontSize: number): number;
  }

  export function parse(buffer: ArrayBuffer | Buffer): Font;
}
