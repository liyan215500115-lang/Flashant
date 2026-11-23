declare module "opentype.js" {
  interface FontPath {
    toPathData(decimalPlaces?: number): string;
  }

  interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): FontPath;
    getAdvanceWidth(text: string, fontSize: number): number;
  }

  interface OpenType {
    parse(buffer: ArrayBuffer | Buffer): Font;
  }

  const opentype: OpenType;
  export default opentype;
}
