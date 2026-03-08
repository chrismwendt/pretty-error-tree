import * as path from "path";
import StackTracey from "stacktracey";
import util from "util";
import { fileURLToPath } from "url";
//#region src/index.ts
const installPrettyErrorTree = () => {
	const h = async (err) => {
		console.error(await prettyErrorTree(err));
		process.exit(1);
	};
	process.on("uncaughtException", h);
	process.on("unhandledRejection", h);
};
function shortPath(file) {
	file = file.startsWith("file://") ? fileURLToPath(file) : file;
	return path.relative(process.cwd(), file);
}
const bracket = (out, style, color) => {
	for (let i = 0; i < out.length; i++) if (i === 0 && i === out.length - 1) out[i] = color(style.one) + out[i];
	else if (i === 0) out[i] = color(style.top) + out[i];
	else if (i === out.length - 1) out[i] = color(style.bot) + out[i];
	else out[i] = color(style.mid) + out[i];
	return out;
};
const gray = (s) => `\x1b[90m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const magenta = (s) => `\x1b[35m${s}\x1b[0m`;
const parseStack = async (err) => {
	return (await new StackTracey(err).withSourcesAsync()).items.map((entry) => ({
		file: entry.file,
		line: entry.line ?? 0,
		column: entry.column ?? 0,
		sourceLine: entry.sourceLine,
		dbg: entry
	}));
};
const prettyErrorTree = async (err, prefix) => {
	return (await prettyErrorTreeLines(err, prefix)).join("\n");
};
const prettyErrorTreeLines = async (err, prefix) => {
	const frames = (err.parsedStack ?? await parseStack(err)).filter((f) => !f.file.startsWith("node:"));
	const headerLines = [`${prefix ?? ""}${gray("[")}${red(err.name)}${gray("]")} ${err.message}`];
	const known = new Set([
		"name",
		"message",
		"stack",
		"cause",
		"errors",
		"parsedStack"
	]);
	const propsObj = {};
	const errObj = err;
	let hasProps = false;
	const propLines = [];
	for (const key of Object.getOwnPropertyNames(err)) {
		if (known.has(key)) continue;
		propsObj[key] = errObj[key];
		hasProps = true;
	}
	if (hasProps) {
		propLines.push(gray("Properties:"));
		propLines.push(gray(""));
		const inspectLines = util.inspect(propsObj, {
			colors: true,
			depth: null,
			compact: 10
		}).split("\n");
		propLines.push(...inspectLines.map((line) => "  " + line));
	}
	const loc = (item) => `${shortPath(item.file)}:${item.line}:${item.column}`;
	const width = Math.max(...frames.map((f) => loc(f).length), 0);
	const style = {
		one: "",
		top: "",
		mid: "",
		bot: ""
	};
	style.top = "╭─▶ ";
	style.mid = "├── ";
	style.bot = "╰── ";
	style.one = "  ▶ ";
	const stackLines = [];
	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i];
		const paddedLoc = `${gray(loc(frame).padEnd(width))}:`;
		if (frame.sourceLine) {
			const line = frame.sourceLine.trim();
			const col = frame.column - (frame.sourceLine.length - frame.sourceLine.trimStart().length);
			const before = line.slice(0, col - 1);
			const word = line.slice(col - 1).match(/^(\w+|\()/)?.[0] ?? "";
			const after = line.slice(col - 1 + word.length);
			const lineColored = `${gray(before)}${yellow(word)}${gray(after)}`;
			stackLines.push(`${paddedLoc} ${lineColored}`);
		} else stackLines.push(`${paddedLoc} ${gray("// source not available")}`);
	}
	bracket(stackLines, style, gray);
	const aggregateLines = [];
	if (err instanceof AggregateError && Array.isArray(err.errors)) for (let i = 0; i < err.errors.length; i++) {
		const innerErr = err.errors[i];
		aggregateLines.push(red("│"));
		const inner = await prettyErrorTreeLines(innerErr);
		for (let j = 0; j < inner.length; j++) if (i < err.errors.length - 1 && j === 0) inner[j] = red(`├─`) + inner[j];
		else if (i < err.errors.length - 1 && j > 0) inner[j] = red(`│ `) + inner[j];
		else if (i === err.errors.length - 1 && j === 0) inner[j] = red(`╰─`) + inner[j];
		else if (i === err.errors.length - 1 && j > 0) inner[j] = red(`  `) + inner[j];
		else continue;
		aggregateLines.push(...inner);
	}
	const causeLines = [];
	if (err.cause instanceof Error) {
		causeLines.push(magenta("│"));
		const cause = await prettyErrorTreeLines(err.cause, "Caused by ");
		causeLines.push(...cause);
	}
	const out = [];
	out.push(...headerLines);
	if (propLines.length > 0) out.push("");
	out.push(...propLines);
	if (stackLines.length > 0) out.push("");
	out.push(...stackLines);
	for (let i = 1; i < out.length; i++) if (aggregateLines.length > 0) out[i] = red("│ ") + out[i];
	else out[i] = "  " + out[i];
	out.push(...aggregateLines);
	for (let i = 1; i < out.length; i++) if (causeLines.length > 0) out[i] = magenta("│ ") + out[i];
	else out[i] = "  " + out[i];
	out.push(...causeLines);
	return out;
};
//#endregion
export { installPrettyErrorTree, prettyErrorTree };
