Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let path = require("path");
path = __toESM(path);
let stacktracey = require("stacktracey");
stacktracey = __toESM(stacktracey);
let util = require("util");
util = __toESM(util);
let url = require("url");
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
	file = file.startsWith("file://") ? (0, url.fileURLToPath)(file) : file;
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
const parseStack = (err) => {
	return new stacktracey.default(err).withSources().items.map((entry) => ({
		file: entry.file,
		line: entry.line ?? 0,
		column: entry.column ?? 0,
		sourceLine: entry.sourceLine,
		callee: entry.callee ?? "<unknown>"
	}));
};
const prettyErrorTree = (err) => {
	return prettyErrorTreeLines(err).join("\n");
};
const prettyErrorTreeLines = (err) => {
	const frames = err.parsedStack ?? parseStack(err);
	const headerLines = [`${err.prefix ?? ""}${gray("[")}${red(err.name)}${gray("]")} ${err.message.trim()}`];
	const known = new Set([
		"name",
		"message",
		"stack",
		"cause",
		"errors",
		"parsedStack",
		"prefix",
		"error",
		"suppressed"
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
		const inspectLines = util.default.inspect(propsObj, {
			colors: true,
			depth: null,
			compact: 10
		}).split("\n");
		propLines.push(gray("Properties: ") + inspectLines[0]);
		propLines.push(...inspectLines.slice(1));
	}
	const loc = (item) => `${shortPath(item.file)}:${item.line}:${item.column}`;
	const locWidth = Math.max(...frames.map((f) => loc(f).length), 0);
	const calleeWidth = Math.max(...frames.map((f) => f.callee.length), 0);
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
		const paddedLoc = `${gray(loc(frame).padEnd(locWidth))}:`;
		const paddedCallee = `${gray(frame.callee.padEnd(calleeWidth))}`;
		if (frame.sourceLine) {
			const line = frame.sourceLine.trim();
			const col = frame.column - (frame.sourceLine.length - frame.sourceLine.trimStart().length);
			const before = line.slice(0, col - 1);
			const word = line.slice(col - 1).match(/^(\w+|\()/)?.[0] ?? "";
			const after = line.slice(col - 1 + word.length);
			const lineColored = `${gray(before)}${yellow(word)}${gray(after)}`;
			stackLines.push(`${gray("at")} ${paddedCallee} ${paddedLoc} ${lineColored}`);
		} else stackLines.push(`${gray("at")} ${paddedCallee} ${paddedLoc} ${gray("// source not available")}`);
	}
	bracket(stackLines, style, gray);
	const printInner = (errors) => {
		const out = [];
		for (let i = 0; i < errors.length; i++) {
			const innerErr = errors[i];
			out.push(red("│"));
			const inner = prettyErrorTreeLines(innerErr);
			for (let j = 0; j < inner.length; j++) if (i < errors.length - 1 && j === 0) inner[j] = red(`├─`) + inner[j];
			else if (i < errors.length - 1 && j > 0) inner[j] = red(`│ `) + inner[j];
			else if (i === errors.length - 1 && j === 0) inner[j] = red(`╰─`) + inner[j];
			else if (i === errors.length - 1 && j > 0) inner[j] = red(`  `) + inner[j];
			else continue;
			out.push(...inner);
		}
		return out;
	};
	const innerErrorLines = [];
	if (err instanceof AggregateError && Array.isArray(err.errors)) innerErrorLines.push(...printInner(err.errors));
	if (err instanceof SuppressedError) {
		err.error.prefix = "Suppressed by ";
		err.suppressed.prefix = "Suppressed ";
		innerErrorLines.push(...printInner([err.error, err.suppressed]));
	}
	const causeLines = [];
	if (err.cause) {
		causeLines.push(magenta("│"));
		const cause = (() => {
			if (err.cause instanceof Error) {
				err.cause.prefix = "Caused by: ";
				return prettyErrorTreeLines(err.cause);
			} else return [`Caused by: ${String(err.cause)}`];
		})();
		causeLines.push(...cause);
	}
	const out = [];
	out.push(...headerLines);
	if (propLines.length > 0) out.push("");
	out.push(...propLines);
	if (stackLines.length > 0) out.push("");
	out.push(...stackLines);
	for (let i = 1; i < out.length; i++) if (innerErrorLines.length > 0) out[i] = red("│ ") + out[i];
	else out[i] = "  " + out[i];
	out.push(...innerErrorLines);
	for (let i = 1; i < out.length; i++) if (causeLines.length > 0) out[i] = magenta("│ ") + out[i];
	else out[i] = "  " + out[i];
	out.push(...causeLines);
	return out;
};
//#endregion
exports.installPrettyErrorTree = installPrettyErrorTree;
exports.prettyErrorTree = prettyErrorTree;
