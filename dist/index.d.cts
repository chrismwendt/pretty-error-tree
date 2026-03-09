//#region src/index.d.ts
declare const installPrettyErrorTree: () => void;
type Frame = {
  file: string;
  line: number;
  column: number;
  sourceLine?: string;
  callee: string;
};
declare const parseStack: (stack: string) => Frame[];
type ErrorExtra = Error & {
  parsedStack?: Frame[];
  prefix?: string;
};
declare const prettyErrorTree: (err: ErrorExtra) => string;
//#endregion
export { Frame, installPrettyErrorTree, parseStack, prettyErrorTree };