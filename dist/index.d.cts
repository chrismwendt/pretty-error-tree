//#region src/index.d.ts
declare const installPrettyErrorTree: () => void;
type Frame = {
  file: string;
  line: number;
  column: number;
  sourceLine?: string;
  dbg: any;
};
declare const prettyErrorTree: (err: Error & {
  parsedStack?: Frame[];
}, prefix?: string) => Promise<string>;
//#endregion
export { installPrettyErrorTree, prettyErrorTree };