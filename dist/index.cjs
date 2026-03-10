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
let util = require("util");
util = __toESM(util);
let url = require("url");
let fs = require("fs");
fs = __toESM(fs);
//#region src/index.ts
const installPrettyErrorTree = () => {
	const h = (err) => {
		console.error(prettyErrorTree(err));
		process.exit(1);
	};
	process.on("uncaughtException", h);
	process.on("unhandledRejection", h);
};
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
const parseStack = (stack) => {
	const fileCache = /* @__PURE__ */ new Map();
	function getSourceLine(file, line) {
		let lines = fileCache.get(file);
		if (!lines) {
			try {
				lines = fs.default.readFileSync(file, "utf8").split("\n");
			} catch {
				lines = [];
			}
			fileCache.set(file, lines);
		}
		return lines[line - 1];
	}
	return stack.split("\n").flatMap((stackLine) => {
		const match1 = stackLine.match(/^\s*at\s+(.+?)\s+\(([^\s]+):(\d+):(\d+)\)$/);
		const match2 = stackLine.match(/^\s*at\s+(.+?)\s+([^\s]+):(\d+):(\d+)$/);
		const match = match1 ?? match2;
		if (!match) return [];
		const [, callee, fileMaybeUrl, lineStr, columnStr] = match;
		const line = parseInt(lineStr, 10);
		const column = parseInt(columnStr, 10);
		const file = fileMaybeUrl.startsWith("file://") ? (0, url.fileURLToPath)(fileMaybeUrl) : fileMaybeUrl;
		return [{
			file,
			line,
			column,
			sourceLine: getSourceLine(file, line),
			callee
		}];
	});
};
const prettyErrorTree = (err) => {
	return prettyErrorTreeLines(err).join("\n");
};
const prettyErrorTreeLines = (err) => {
	const frames = err.parsedStack ?? (err.stack ? parseStack(err.stack) : []);
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
	const loc = (item) => `${path.relative(process.cwd(), item.file)}:${item.line}:${item.column}`;
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
exports.parseStack = parseStack;
exports.prettyErrorTree = prettyErrorTree;

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguY2pzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdXRpbCBmcm9tICd1dGlsJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCBnZXRTb3VyY2UgZnJvbSAnZ2V0LXNvdXJjZSdcbmltcG9ydCBmcyBmcm9tICdmcydcblxuZXhwb3J0IGNvbnN0IGluc3RhbGxQcmV0dHlFcnJvclRyZWUgPSAoKSA9PiB7XG4gIGNvbnN0IGggPSAoZXJyOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKHByZXR0eUVycm9yVHJlZShlcnIpKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBoKVxuICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBoKVxufVxuXG50eXBlIEJyYWNrZXRTdHlsZSA9IHsgb25lOiBzdHJpbmc7IHRvcDogc3RyaW5nOyBtaWQ6IHN0cmluZzsgYm90OiBzdHJpbmcgfVxuXG5jb25zdCBicmFja2V0ID0gKG91dDogc3RyaW5nW10sIHN0eWxlOiBCcmFja2V0U3R5bGUsIGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGkgPT09IDAgJiYgaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLm9uZSkgKyBvdXRbaV1cbiAgICBlbHNlIGlmIChpID09PSAwKSBvdXRbaV0gPSBjb2xvcihzdHlsZS50b3ApICsgb3V0W2ldXG4gICAgZWxzZSBpZiAoaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLmJvdCkgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9IGNvbG9yKHN0eWxlLm1pZCkgKyBvdXRbaV1cbiAgfVxuXG4gIHJldHVybiBvdXRcbn1cblxuY29uc3QgZ3JheSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYls5MG0ke3N9XFx4MWJbMG1gXG5jb25zdCByZWQgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzFtJHtzfVxceDFiWzBtYFxuY29uc3QgeWVsbG93ID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMzbSR7c31cXHgxYlswbWBcbmNvbnN0IGJsdWUgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzRtJHtzfVxceDFiWzBtYFxuY29uc3QgbWFnZW50YSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYlszNW0ke3N9XFx4MWJbMG1gXG5jb25zdCBjeWFuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzM2bSR7c31cXHgxYlswbWBcbmNvbnN0IGdyZWVuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMybSR7c31cXHgxYlswbWBcblxuZXhwb3J0IHR5cGUgRnJhbWUgPSB7XG4gIGZpbGU6IHN0cmluZ1xuICBsaW5lOiBudW1iZXJcbiAgY29sdW1uOiBudW1iZXJcbiAgc291cmNlTGluZT86IHN0cmluZ1xuICBjYWxsZWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2VTdGFjayA9IChzdGFjazogc3RyaW5nKTogRnJhbWVbXSA9PiB7XG4gIGNvbnN0IGZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKVxuXG4gIGZ1bmN0aW9uIGdldFNvdXJjZUxpbmUoZmlsZTogc3RyaW5nLCBsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGxldCBsaW5lcyA9IGZpbGVDYWNoZS5nZXQoZmlsZSlcblxuICAgIGlmICghbGluZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbGluZXMgPSBbXVxuICAgICAgfVxuICAgICAgZmlsZUNhY2hlLnNldChmaWxlLCBsaW5lcylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXNbbGluZSAtIDFdXG4gIH1cblxuICByZXR1cm4gc3RhY2suc3BsaXQoJ1xcbicpLmZsYXRNYXAoKHN0YWNrTGluZSk6IEZyYW1lW10gPT4ge1xuICAgIGNvbnN0IG1hdGNoMSA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccytcXCgoW15cXHNdKyk6KFxcZCspOihcXGQrKVxcKSQvKVxuICAgIGNvbnN0IG1hdGNoMiA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccysoW15cXHNdKyk6KFxcZCspOihcXGQrKSQvKVxuICAgIGNvbnN0IG1hdGNoID0gbWF0Y2gxID8/IG1hdGNoMlxuICAgIGlmICghbWF0Y2gpIHJldHVybiBbXVxuXG4gICAgY29uc3QgWywgY2FsbGVlLCBmaWxlTWF5YmVVcmwsIGxpbmVTdHIsIGNvbHVtblN0cl0gPSBtYXRjaFxuICAgIGNvbnN0IGxpbmUgPSBwYXJzZUludChsaW5lU3RyLCAxMClcbiAgICBjb25zdCBjb2x1bW4gPSBwYXJzZUludChjb2x1bW5TdHIsIDEwKVxuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVNYXliZVVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykgPyBmaWxlVVJMVG9QYXRoKGZpbGVNYXliZVVybCkgOiBmaWxlTWF5YmVVcmxcblxuICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBnZXRTb3VyY2VMaW5lKGZpbGUsIGxpbmUpXG5cbiAgICByZXR1cm4gW3sgZmlsZSwgbGluZSwgY29sdW1uLCBzb3VyY2VMaW5lLCBjYWxsZWUgfV1cbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXJyb3JFeHRyYSA9IEVycm9yICYgeyBwYXJzZWRTdGFjaz86IEZyYW1lW107IHByZWZpeD86IHN0cmluZyB9XG5cbmV4cG9ydCBjb25zdCBwcmV0dHlFcnJvclRyZWUgPSAoZXJyOiBFcnJvckV4dHJhKTogc3RyaW5nID0+IHtcbiAgY29uc3QgbGluZXMgPSBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIpXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxufVxuXG5jb25zdCBwcmV0dHlFcnJvclRyZWVMaW5lcyA9IChlcnI6IEVycm9yRXh0cmEpOiBzdHJpbmdbXSA9PiB7XG4gIGNvbnN0IHN0YWNrID0gZXJyLnBhcnNlZFN0YWNrID8/IChlcnIuc3RhY2sgPyBwYXJzZVN0YWNrKGVyci5zdGFjaykgOiBbXSlcbiAgY29uc3QgZnJhbWVzID0gc3RhY2tcblxuICAvLyBuYW1lIGFuZCBtZXNzYWdlXG4gIGNvbnN0IGhlYWRlckxpbmVzID0gW2Ake2Vyci5wcmVmaXggPz8gJyd9JHtncmF5KCdbJyl9JHtyZWQoZXJyLm5hbWUpfSR7Z3JheSgnXScpfSAke2Vyci5tZXNzYWdlLnRyaW0oKX1gXVxuXG4gIC8vIHByb3BzXG4gIGNvbnN0IGtub3duID0gbmV3IFNldChbJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycsICdjYXVzZScsICdlcnJvcnMnLCAncGFyc2VkU3RhY2snLCAncHJlZml4JywgJ2Vycm9yJywgJ3N1cHByZXNzZWQnXSlcbiAgY29uc3QgcHJvcHNPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge31cbiAgY29uc3QgZXJyT2JqID0gZXJyIGFzIEVycm9yICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgbGV0IGhhc1Byb3BzID0gZmFsc2VcbiAgY29uc3QgcHJvcExpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGVycikpIHtcbiAgICBpZiAoa25vd24uaGFzKGtleSkpIGNvbnRpbnVlXG4gICAgcHJvcHNPYmpba2V5XSA9IGVyck9ialtrZXldXG4gICAgaGFzUHJvcHMgPSB0cnVlXG4gIH1cbiAgaWYgKGhhc1Byb3BzKSB7XG4gICAgY29uc3QgaW5zcGVjdExpbmVzID0gdXRpbC5pbnNwZWN0KHByb3BzT2JqLCB7IGNvbG9yczogdHJ1ZSwgZGVwdGg6IG51bGwsIGNvbXBhY3Q6IDEwIH0pLnNwbGl0KCdcXG4nKVxuICAgIHByb3BMaW5lcy5wdXNoKGdyYXkoJ1Byb3BlcnRpZXM6ICcpICsgaW5zcGVjdExpbmVzWzBdKVxuICAgIHByb3BMaW5lcy5wdXNoKC4uLmluc3BlY3RMaW5lcy5zbGljZSgxKSlcbiAgfVxuXG4gIC8vIHN0YWNrIHRyYWNlXG4gIGNvbnN0IGxvYyA9IChpdGVtOiBGcmFtZSkgPT4gYCR7cGF0aC5yZWxhdGl2ZShwcm9jZXNzLmN3ZCgpLCBpdGVtLmZpbGUpfToke2l0ZW0ubGluZX06JHtpdGVtLmNvbHVtbn1gXG4gIGNvbnN0IGxvY1dpZHRoID0gTWF0aC5tYXgoLi4uZnJhbWVzLm1hcChmID0+IGxvYyhmKS5sZW5ndGgpLCAwKVxuICBjb25zdCBjYWxsZWVXaWR0aCA9IE1hdGgubWF4KC4uLmZyYW1lcy5tYXAoZiA9PiBmLmNhbGxlZS5sZW5ndGgpLCAwKVxuICBjb25zdCBzdHlsZTogQnJhY2tldFN0eWxlID0geyBvbmU6ICcnLCB0b3A6ICcnLCBtaWQ6ICcnLCBib3Q6ICcnIH1cbiAgc3R5bGUudG9wID0gJ+KVreKUgOKWtiAnXG4gIHN0eWxlLm1pZCA9ICfilJzilIDilIAgJ1xuICBzdHlsZS5ib3QgPSAn4pWw4pSA4pSAICdcbiAgc3R5bGUub25lID0gJyAg4pa2ICdcbiAgY29uc3Qgc3RhY2tMaW5lczogc3RyaW5nW10gPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZyYW1lID0gZnJhbWVzW2ldXG4gICAgY29uc3QgcGFkZGVkTG9jID0gYCR7Z3JheShsb2MoZnJhbWUpLnBhZEVuZChsb2NXaWR0aCkpfTpgXG4gICAgY29uc3QgcGFkZGVkQ2FsbGVlID0gYCR7Z3JheShmcmFtZS5jYWxsZWUucGFkRW5kKGNhbGxlZVdpZHRoKSl9YFxuICAgIGlmIChmcmFtZS5zb3VyY2VMaW5lKSB7XG4gICAgICBjb25zdCBsaW5lID0gZnJhbWUuc291cmNlTGluZS50cmltKClcbiAgICAgIGNvbnN0IGNvbCA9IGZyYW1lLmNvbHVtbiAtIChmcmFtZS5zb3VyY2VMaW5lLmxlbmd0aCAtIGZyYW1lLnNvdXJjZUxpbmUudHJpbVN0YXJ0KCkubGVuZ3RoKVxuICAgICAgY29uc3QgYmVmb3JlID0gbGluZS5zbGljZSgwLCBjb2wgLSAxKVxuICAgICAgY29uc3Qgd29yZCA9IGxpbmUuc2xpY2UoY29sIC0gMSkubWF0Y2goL14oXFx3K3xcXCgpLyk/LlswXSA/PyAnJ1xuICAgICAgY29uc3QgYWZ0ZXIgPSBsaW5lLnNsaWNlKGNvbCAtIDEgKyB3b3JkLmxlbmd0aClcbiAgICAgIGNvbnN0IGxpbmVDb2xvcmVkID0gYCR7Z3JheShiZWZvcmUpfSR7eWVsbG93KHdvcmQpfSR7Z3JheShhZnRlcil9YFxuICAgICAgc3RhY2tMaW5lcy5wdXNoKGAke2dyYXkoJ2F0Jyl9ICR7cGFkZGVkQ2FsbGVlfSAke3BhZGRlZExvY30gJHtsaW5lQ29sb3JlZH1gKVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGFja0xpbmVzLnB1c2goYCR7Z3JheSgnYXQnKX0gJHtwYWRkZWRDYWxsZWV9ICR7cGFkZGVkTG9jfSAke2dyYXkoJy8vIHNvdXJjZSBub3QgYXZhaWxhYmxlJyl9YClcbiAgICB9XG4gIH1cbiAgYnJhY2tldChzdGFja0xpbmVzLCBzdHlsZSwgZ3JheSlcblxuICBjb25zdCBwcmludElubmVyID0gKGVycm9yczogRXJyb3JbXSk6IHN0cmluZ1tdID0+IHtcbiAgICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW11cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5uZXJFcnIgPSBlcnJvcnNbaV1cbiAgICAgIG91dC5wdXNoKHJlZCgn4pSCJykpXG4gICAgICBjb25zdCBpbm5lciA9IHByZXR0eUVycm9yVHJlZUxpbmVzKGlubmVyRXJyKVxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpbm5lci5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoZmFsc2UpIGNvbnRpbnVlXG4gICAgICAgIGVsc2UgaWYgKGkgPCBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID09PSAwKSBpbm5lcltqXSA9IHJlZChg4pSc4pSAYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpIDwgZXJyb3JzLmxlbmd0aCAtIDEgJiYgaiA+IDApIGlubmVyW2pdID0gcmVkKGDilIIgYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpID09PSBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID09PSAwKSBpbm5lcltqXSA9IHJlZChg4pWw4pSAYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpID09PSBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID4gMCkgaW5uZXJbal0gPSByZWQoYCAgYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBvdXQucHVzaCguLi5pbm5lcilcbiAgICB9XG4gICAgcmV0dXJuIG91dFxuICB9XG5cbiAgY29uc3QgaW5uZXJFcnJvckxpbmVzOiBzdHJpbmdbXSA9IFtdXG5cbiAgLy8gQWdncmVnYXRlRXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEFnZ3JlZ2F0ZUVycm9yICYmIEFycmF5LmlzQXJyYXkoZXJyLmVycm9ycykpIHtcbiAgICBpbm5lckVycm9yTGluZXMucHVzaCguLi5wcmludElubmVyKGVyci5lcnJvcnMpKVxuICB9XG5cbiAgLy8gU3VwcHJlc3NlZEVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBTdXBwcmVzc2VkRXJyb3IpIHtcbiAgICA7KGVyci5lcnJvciBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnU3VwcHJlc3NlZCBieSAnXG4gICAgOyhlcnIuc3VwcHJlc3NlZCBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnU3VwcHJlc3NlZCAnXG4gICAgaW5uZXJFcnJvckxpbmVzLnB1c2goLi4ucHJpbnRJbm5lcihbZXJyLmVycm9yLCBlcnIuc3VwcHJlc3NlZF0pKVxuICB9XG5cbiAgLy8gY2F1c2VcbiAgY29uc3QgY2F1c2VMaW5lczogc3RyaW5nW10gPSBbXVxuICBpZiAoZXJyLmNhdXNlKSB7XG4gICAgY2F1c2VMaW5lcy5wdXNoKG1hZ2VudGEoJ+KUgicpKVxuICAgIGNvbnN0IGNhdXNlOiBzdHJpbmdbXSA9ICgoKSA9PiB7XG4gICAgICBpZiAoZXJyLmNhdXNlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgOyhlcnIuY2F1c2UgYXMgRXJyb3JFeHRyYSkucHJlZml4ID0gJ0NhdXNlZCBieTogJ1xuICAgICAgICByZXR1cm4gcHJldHR5RXJyb3JUcmVlTGluZXMoZXJyLmNhdXNlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtgQ2F1c2VkIGJ5OiAke1N0cmluZyhlcnIuY2F1c2UpfWBdXG4gICAgICB9XG4gICAgfSkoKVxuICAgIGNhdXNlTGluZXMucHVzaCguLi5jYXVzZSlcbiAgfVxuXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXVxuICBvdXQucHVzaCguLi5oZWFkZXJMaW5lcylcbiAgaWYgKHByb3BMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4ucHJvcExpbmVzKVxuICBpZiAoc3RhY2tMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4uc3RhY2tMaW5lcylcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBvdXQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoaW5uZXJFcnJvckxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IHJlZCgn4pSCICcpICsgb3V0W2ldXG4gICAgZWxzZSBvdXRbaV0gPSAnICAnICsgb3V0W2ldXG4gIH1cbiAgb3V0LnB1c2goLi4uaW5uZXJFcnJvckxpbmVzKVxuICBmb3IgKGxldCBpID0gMTsgaSA8IG91dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChjYXVzZUxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IG1hZ2VudGEoJ+KUgiAnKSArIG91dFtpXVxuICAgIGVsc2Ugb3V0W2ldID0gJyAgJyArIG91dFtpXVxuICB9XG4gIG91dC5wdXNoKC4uLmNhdXNlTGluZXMpXG4gIHJldHVybiBvdXRcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQU1BLE1BQWEsK0JBQStCO0NBQzFDLE1BQU0sS0FBSyxRQUFhO0FBQ3RCLFVBQVEsTUFBTSxnQkFBZ0IsSUFBSSxDQUFDO0FBQ25DLFVBQVEsS0FBSyxFQUFFOztBQUdqQixTQUFRLEdBQUcscUJBQXFCLEVBQUU7QUFDbEMsU0FBUSxHQUFHLHNCQUFzQixFQUFFOztBQUtyQyxNQUFNLFdBQVcsS0FBZSxPQUFxQixVQUEyQztBQUM5RixNQUFLLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxRQUFRLElBQzlCLEtBQUksTUFBTSxLQUFLLE1BQU0sSUFBSSxTQUFTLEVBQUcsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtVQUM1RCxNQUFNLEVBQUcsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtVQUN6QyxNQUFNLElBQUksU0FBUyxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7S0FDMUQsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtBQUd2QyxRQUFPOztBQUdULE1BQU0sUUFBUSxNQUFjLFdBQVcsRUFBRTtBQUN6QyxNQUFNLE9BQU8sTUFBYyxXQUFXLEVBQUU7QUFDeEMsTUFBTSxVQUFVLE1BQWMsV0FBVyxFQUFFO0FBRTNDLE1BQU0sV0FBVyxNQUFjLFdBQVcsRUFBRTtBQVk1QyxNQUFhLGNBQWMsVUFBMkI7Q0FDcEQsTUFBTSw0QkFBWSxJQUFJLEtBQXVCO0NBRTdDLFNBQVMsY0FBYyxNQUFjLE1BQWtDO0VBQ3JFLElBQUksUUFBUSxVQUFVLElBQUksS0FBSztBQUUvQixNQUFJLENBQUMsT0FBTztBQUNWLE9BQUk7QUFDRixZQUFRLEdBQUEsUUFBRyxhQUFhLE1BQU0sT0FBTyxDQUFDLE1BQU0sS0FBSztXQUMzQztBQUNOLFlBQVEsRUFBRTs7QUFFWixhQUFVLElBQUksTUFBTSxNQUFNOztBQUc1QixTQUFPLE1BQU0sT0FBTzs7QUFHdEIsUUFBTyxNQUFNLE1BQU0sS0FBSyxDQUFDLFNBQVMsY0FBdUI7RUFDdkQsTUFBTSxTQUFTLFVBQVUsTUFBTSw2Q0FBNkM7RUFDNUUsTUFBTSxTQUFTLFVBQVUsTUFBTSx5Q0FBeUM7RUFDeEUsTUFBTSxRQUFRLFVBQVU7QUFDeEIsTUFBSSxDQUFDLE1BQU8sUUFBTyxFQUFFO0VBRXJCLE1BQU0sR0FBRyxRQUFRLGNBQWMsU0FBUyxhQUFhO0VBQ3JELE1BQU0sT0FBTyxTQUFTLFNBQVMsR0FBRztFQUNsQyxNQUFNLFNBQVMsU0FBUyxXQUFXLEdBQUc7RUFFdEMsTUFBTSxPQUFPLGFBQWEsV0FBVyxVQUFVLElBQUEsR0FBQSxJQUFBLGVBQWlCLGFBQWEsR0FBRztBQUloRixTQUFPLENBQUM7R0FBRTtHQUFNO0dBQU07R0FBUSxZQUZYLGNBQWMsTUFBTSxLQUFLO0dBRUY7R0FBUSxDQUFDO0dBQ25EOztBQUtKLE1BQWEsbUJBQW1CLFFBQTRCO0FBRTFELFFBRGMscUJBQXFCLElBQUksQ0FDMUIsS0FBSyxLQUFLOztBQUd6QixNQUFNLHdCQUF3QixRQUE4QjtDQUUxRCxNQUFNLFNBRFEsSUFBSSxnQkFBZ0IsSUFBSSxRQUFRLFdBQVcsSUFBSSxNQUFNLEdBQUcsRUFBRTtDQUl4RSxNQUFNLGNBQWMsQ0FBQyxHQUFHLElBQUksVUFBVSxLQUFLLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSSxLQUFLLEdBQUcsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLFFBQVEsTUFBTSxHQUFHO0NBR3pHLE1BQU0sUUFBUSxJQUFJLElBQUk7RUFBQztFQUFRO0VBQVc7RUFBUztFQUFTO0VBQVU7RUFBZTtFQUFVO0VBQVM7RUFBYSxDQUFDO0NBQ3RILE1BQU0sV0FBb0MsRUFBRTtDQUM1QyxNQUFNLFNBQVM7Q0FDZixJQUFJLFdBQVc7Q0FDZixNQUFNLFlBQXNCLEVBQUU7QUFDOUIsTUFBSyxNQUFNLE9BQU8sT0FBTyxvQkFBb0IsSUFBSSxFQUFFO0FBQ2pELE1BQUksTUFBTSxJQUFJLElBQUksQ0FBRTtBQUNwQixXQUFTLE9BQU8sT0FBTztBQUN2QixhQUFXOztBQUViLEtBQUksVUFBVTtFQUNaLE1BQU0sZUFBZSxLQUFBLFFBQUssUUFBUSxVQUFVO0dBQUUsUUFBUTtHQUFNLE9BQU87R0FBTSxTQUFTO0dBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSztBQUNuRyxZQUFVLEtBQUssS0FBSyxlQUFlLEdBQUcsYUFBYSxHQUFHO0FBQ3RELFlBQVUsS0FBSyxHQUFHLGFBQWEsTUFBTSxFQUFFLENBQUM7O0NBSTFDLE1BQU0sT0FBTyxTQUFnQixHQUFHLEtBQUssU0FBUyxRQUFRLEtBQUssRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHLEtBQUssS0FBSyxHQUFHLEtBQUs7Q0FDN0YsTUFBTSxXQUFXLEtBQUssSUFBSSxHQUFHLE9BQU8sS0FBSSxNQUFLLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO0NBQy9ELE1BQU0sY0FBYyxLQUFLLElBQUksR0FBRyxPQUFPLEtBQUksTUFBSyxFQUFFLE9BQU8sT0FBTyxFQUFFLEVBQUU7Q0FDcEUsTUFBTSxRQUFzQjtFQUFFLEtBQUs7RUFBSSxLQUFLO0VBQUksS0FBSztFQUFJLEtBQUs7RUFBSTtBQUNsRSxPQUFNLE1BQU07QUFDWixPQUFNLE1BQU07QUFDWixPQUFNLE1BQU07QUFDWixPQUFNLE1BQU07Q0FDWixNQUFNLGFBQXVCLEVBQUU7QUFDL0IsTUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU8sUUFBUSxLQUFLO0VBQ3RDLE1BQU0sUUFBUSxPQUFPO0VBQ3JCLE1BQU0sWUFBWSxHQUFHLEtBQUssSUFBSSxNQUFNLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQztFQUN2RCxNQUFNLGVBQWUsR0FBRyxLQUFLLE1BQU0sT0FBTyxPQUFPLFlBQVksQ0FBQztBQUM5RCxNQUFJLE1BQU0sWUFBWTtHQUNwQixNQUFNLE9BQU8sTUFBTSxXQUFXLE1BQU07R0FDcEMsTUFBTSxNQUFNLE1BQU0sVUFBVSxNQUFNLFdBQVcsU0FBUyxNQUFNLFdBQVcsV0FBVyxDQUFDO0dBQ25GLE1BQU0sU0FBUyxLQUFLLE1BQU0sR0FBRyxNQUFNLEVBQUU7R0FDckMsTUFBTSxPQUFPLEtBQUssTUFBTSxNQUFNLEVBQUUsQ0FBQyxNQUFNLFlBQVksR0FBRyxNQUFNO0dBQzVELE1BQU0sUUFBUSxLQUFLLE1BQU0sTUFBTSxJQUFJLEtBQUssT0FBTztHQUMvQyxNQUFNLGNBQWMsR0FBRyxLQUFLLE9BQU8sR0FBRyxPQUFPLEtBQUssR0FBRyxLQUFLLE1BQU07QUFDaEUsY0FBVyxLQUFLLEdBQUcsS0FBSyxLQUFLLENBQUMsR0FBRyxhQUFhLEdBQUcsVUFBVSxHQUFHLGNBQWM7UUFFNUUsWUFBVyxLQUFLLEdBQUcsS0FBSyxLQUFLLENBQUMsR0FBRyxhQUFhLEdBQUcsVUFBVSxHQUFHLEtBQUssMEJBQTBCLEdBQUc7O0FBR3BHLFNBQVEsWUFBWSxPQUFPLEtBQUs7Q0FFaEMsTUFBTSxjQUFjLFdBQThCO0VBQ2hELE1BQU0sTUFBZ0IsRUFBRTtBQUN4QixPQUFLLElBQUksSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7R0FDdEMsTUFBTSxXQUFXLE9BQU87QUFDeEIsT0FBSSxLQUFLLElBQUksSUFBSSxDQUFDO0dBQ2xCLE1BQU0sUUFBUSxxQkFBcUIsU0FBUztBQUM1QyxRQUFLLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLElBRTNCLEtBQUksSUFBSSxPQUFPLFNBQVMsS0FBSyxNQUFNLEVBQUcsT0FBTSxLQUFLLElBQUksS0FBSyxHQUFHLE1BQU07WUFDL0QsSUFBSSxPQUFPLFNBQVMsS0FBSyxJQUFJLEVBQUcsT0FBTSxLQUFLLElBQUksS0FBSyxHQUFHLE1BQU07WUFDN0QsTUFBTSxPQUFPLFNBQVMsS0FBSyxNQUFNLEVBQUcsT0FBTSxLQUFLLElBQUksS0FBSyxHQUFHLE1BQU07WUFDakUsTUFBTSxPQUFPLFNBQVMsS0FBSyxJQUFJLEVBQUcsT0FBTSxLQUFLLElBQUksS0FBSyxHQUFHLE1BQU07T0FDbkU7QUFFUCxPQUFJLEtBQUssR0FBRyxNQUFNOztBQUVwQixTQUFPOztDQUdULE1BQU0sa0JBQTRCLEVBQUU7QUFHcEMsS0FBSSxlQUFlLGtCQUFrQixNQUFNLFFBQVEsSUFBSSxPQUFPLENBQzVELGlCQUFnQixLQUFLLEdBQUcsV0FBVyxJQUFJLE9BQU8sQ0FBQztBQUlqRCxLQUFJLGVBQWUsaUJBQWlCO0FBQ2hDLE1BQUksTUFBcUIsU0FBUztBQUNsQyxNQUFJLFdBQTBCLFNBQVM7QUFDekMsa0JBQWdCLEtBQUssR0FBRyxXQUFXLENBQUMsSUFBSSxPQUFPLElBQUksV0FBVyxDQUFDLENBQUM7O0NBSWxFLE1BQU0sYUFBdUIsRUFBRTtBQUMvQixLQUFJLElBQUksT0FBTztBQUNiLGFBQVcsS0FBSyxRQUFRLElBQUksQ0FBQztFQUM3QixNQUFNLGVBQXlCO0FBQzdCLE9BQUksSUFBSSxpQkFBaUIsT0FBTztBQUM1QixRQUFJLE1BQXFCLFNBQVM7QUFDcEMsV0FBTyxxQkFBcUIsSUFBSSxNQUFNO1NBRXRDLFFBQU8sQ0FBQyxjQUFjLE9BQU8sSUFBSSxNQUFNLEdBQUc7TUFFMUM7QUFDSixhQUFXLEtBQUssR0FBRyxNQUFNOztDQUczQixNQUFNLE1BQWdCLEVBQUU7QUFDeEIsS0FBSSxLQUFLLEdBQUcsWUFBWTtBQUN4QixLQUFJLFVBQVUsU0FBUyxFQUFHLEtBQUksS0FBSyxHQUFHO0FBQ3RDLEtBQUksS0FBSyxHQUFHLFVBQVU7QUFDdEIsS0FBSSxXQUFXLFNBQVMsRUFBRyxLQUFJLEtBQUssR0FBRztBQUN2QyxLQUFJLEtBQUssR0FBRyxXQUFXO0FBQ3ZCLE1BQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsSUFDOUIsS0FBSSxnQkFBZ0IsU0FBUyxFQUFHLEtBQUksS0FBSyxJQUFJLEtBQUssR0FBRyxJQUFJO0tBQ3BELEtBQUksS0FBSyxPQUFPLElBQUk7QUFFM0IsS0FBSSxLQUFLLEdBQUcsZ0JBQWdCO0FBQzVCLE1BQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsSUFDOUIsS0FBSSxXQUFXLFNBQVMsRUFBRyxLQUFJLEtBQUssUUFBUSxLQUFLLEdBQUcsSUFBSTtLQUNuRCxLQUFJLEtBQUssT0FBTyxJQUFJO0FBRTNCLEtBQUksS0FBSyxHQUFHLFdBQVc7QUFDdkIsUUFBTyJ9