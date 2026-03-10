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
	if (!err || typeof err !== "object") return [`${String(err)}`];
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguY2pzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdXRpbCBmcm9tICd1dGlsJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCBnZXRTb3VyY2UgZnJvbSAnZ2V0LXNvdXJjZSdcbmltcG9ydCBmcyBmcm9tICdmcydcblxuZXhwb3J0IGNvbnN0IGluc3RhbGxQcmV0dHlFcnJvclRyZWUgPSAoKSA9PiB7XG4gIGNvbnN0IGggPSAoZXJyOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKHByZXR0eUVycm9yVHJlZShlcnIpKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBoKVxuICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBoKVxufVxuXG50eXBlIEJyYWNrZXRTdHlsZSA9IHsgb25lOiBzdHJpbmc7IHRvcDogc3RyaW5nOyBtaWQ6IHN0cmluZzsgYm90OiBzdHJpbmcgfVxuXG5jb25zdCBicmFja2V0ID0gKG91dDogc3RyaW5nW10sIHN0eWxlOiBCcmFja2V0U3R5bGUsIGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGkgPT09IDAgJiYgaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLm9uZSkgKyBvdXRbaV1cbiAgICBlbHNlIGlmIChpID09PSAwKSBvdXRbaV0gPSBjb2xvcihzdHlsZS50b3ApICsgb3V0W2ldXG4gICAgZWxzZSBpZiAoaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLmJvdCkgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9IGNvbG9yKHN0eWxlLm1pZCkgKyBvdXRbaV1cbiAgfVxuXG4gIHJldHVybiBvdXRcbn1cblxuY29uc3QgZ3JheSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYls5MG0ke3N9XFx4MWJbMG1gXG5jb25zdCByZWQgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzFtJHtzfVxceDFiWzBtYFxuY29uc3QgeWVsbG93ID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMzbSR7c31cXHgxYlswbWBcbmNvbnN0IGJsdWUgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzRtJHtzfVxceDFiWzBtYFxuY29uc3QgbWFnZW50YSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYlszNW0ke3N9XFx4MWJbMG1gXG5jb25zdCBjeWFuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzM2bSR7c31cXHgxYlswbWBcbmNvbnN0IGdyZWVuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMybSR7c31cXHgxYlswbWBcblxuZXhwb3J0IHR5cGUgRnJhbWUgPSB7XG4gIGZpbGU6IHN0cmluZ1xuICBsaW5lOiBudW1iZXJcbiAgY29sdW1uOiBudW1iZXJcbiAgc291cmNlTGluZT86IHN0cmluZ1xuICBjYWxsZWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2VTdGFjayA9IChzdGFjazogc3RyaW5nKTogRnJhbWVbXSA9PiB7XG4gIGNvbnN0IGZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKVxuXG4gIGZ1bmN0aW9uIGdldFNvdXJjZUxpbmUoZmlsZTogc3RyaW5nLCBsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGxldCBsaW5lcyA9IGZpbGVDYWNoZS5nZXQoZmlsZSlcblxuICAgIGlmICghbGluZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbGluZXMgPSBbXVxuICAgICAgfVxuICAgICAgZmlsZUNhY2hlLnNldChmaWxlLCBsaW5lcylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXNbbGluZSAtIDFdXG4gIH1cblxuICByZXR1cm4gc3RhY2suc3BsaXQoJ1xcbicpLmZsYXRNYXAoKHN0YWNrTGluZSk6IEZyYW1lW10gPT4ge1xuICAgIGNvbnN0IG1hdGNoMSA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccytcXCgoW15cXHNdKyk6KFxcZCspOihcXGQrKVxcKSQvKVxuICAgIGNvbnN0IG1hdGNoMiA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccysoW15cXHNdKyk6KFxcZCspOihcXGQrKSQvKVxuICAgIGNvbnN0IG1hdGNoID0gbWF0Y2gxID8/IG1hdGNoMlxuICAgIGlmICghbWF0Y2gpIHJldHVybiBbXVxuXG4gICAgY29uc3QgWywgY2FsbGVlLCBmaWxlTWF5YmVVcmwsIGxpbmVTdHIsIGNvbHVtblN0cl0gPSBtYXRjaFxuICAgIGNvbnN0IGxpbmUgPSBwYXJzZUludChsaW5lU3RyLCAxMClcbiAgICBjb25zdCBjb2x1bW4gPSBwYXJzZUludChjb2x1bW5TdHIsIDEwKVxuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVNYXliZVVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykgPyBmaWxlVVJMVG9QYXRoKGZpbGVNYXliZVVybCkgOiBmaWxlTWF5YmVVcmxcblxuICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBnZXRTb3VyY2VMaW5lKGZpbGUsIGxpbmUpXG5cbiAgICByZXR1cm4gW3sgZmlsZSwgbGluZSwgY29sdW1uLCBzb3VyY2VMaW5lLCBjYWxsZWUgfV1cbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXJyb3JFeHRyYSA9IEVycm9yICYgeyBwYXJzZWRTdGFjaz86IEZyYW1lW107IHByZWZpeD86IHN0cmluZyB9XG5cbmV4cG9ydCBjb25zdCBwcmV0dHlFcnJvclRyZWUgPSAoZXJyOiBFcnJvckV4dHJhKTogc3RyaW5nID0+IHtcbiAgY29uc3QgbGluZXMgPSBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIpXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxufVxuXG5jb25zdCBwcmV0dHlFcnJvclRyZWVMaW5lcyA9IChlcnI6IEVycm9yRXh0cmEpOiBzdHJpbmdbXSA9PiB7XG4gIGlmICghZXJyIHx8IHR5cGVvZiBlcnIgIT09ICdvYmplY3QnKSByZXR1cm4gW2Ake1N0cmluZyhlcnIpfWBdXG5cbiAgY29uc3Qgc3RhY2sgPSBlcnIucGFyc2VkU3RhY2sgPz8gKGVyci5zdGFjayA/IHBhcnNlU3RhY2soZXJyLnN0YWNrKSA6IFtdKVxuICBjb25zdCBmcmFtZXMgPSBzdGFja1xuXG4gIC8vIG5hbWUgYW5kIG1lc3NhZ2VcbiAgY29uc3QgaGVhZGVyTGluZXMgPSBbYCR7ZXJyLnByZWZpeCA/PyAnJ30ke2dyYXkoJ1snKX0ke3JlZChlcnIubmFtZSl9JHtncmF5KCddJyl9ICR7ZXJyLm1lc3NhZ2UudHJpbSgpfWBdXG5cbiAgLy8gcHJvcHNcbiAgY29uc3Qga25vd24gPSBuZXcgU2V0KFsnbmFtZScsICdtZXNzYWdlJywgJ3N0YWNrJywgJ2NhdXNlJywgJ2Vycm9ycycsICdwYXJzZWRTdGFjaycsICdwcmVmaXgnLCAnZXJyb3InLCAnc3VwcHJlc3NlZCddKVxuICBjb25zdCBwcm9wc09iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fVxuICBjb25zdCBlcnJPYmogPSBlcnIgYXMgRXJyb3IgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICBsZXQgaGFzUHJvcHMgPSBmYWxzZVxuICBjb25zdCBwcm9wTGluZXM6IHN0cmluZ1tdID0gW11cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZXJyKSkge1xuICAgIGlmIChrbm93bi5oYXMoa2V5KSkgY29udGludWVcbiAgICBwcm9wc09ialtrZXldID0gZXJyT2JqW2tleV1cbiAgICBoYXNQcm9wcyA9IHRydWVcbiAgfVxuICBpZiAoaGFzUHJvcHMpIHtcbiAgICBjb25zdCBpbnNwZWN0TGluZXMgPSB1dGlsLmluc3BlY3QocHJvcHNPYmosIHsgY29sb3JzOiB0cnVlLCBkZXB0aDogbnVsbCwgY29tcGFjdDogMTAgfSkuc3BsaXQoJ1xcbicpXG4gICAgcHJvcExpbmVzLnB1c2goZ3JheSgnUHJvcGVydGllczogJykgKyBpbnNwZWN0TGluZXNbMF0pXG4gICAgcHJvcExpbmVzLnB1c2goLi4uaW5zcGVjdExpbmVzLnNsaWNlKDEpKVxuICB9XG5cbiAgLy8gc3RhY2sgdHJhY2VcbiAgY29uc3QgbG9jID0gKGl0ZW06IEZyYW1lKSA9PiBgJHtwYXRoLnJlbGF0aXZlKHByb2Nlc3MuY3dkKCksIGl0ZW0uZmlsZSl9OiR7aXRlbS5saW5lfToke2l0ZW0uY29sdW1ufWBcbiAgY29uc3QgbG9jV2lkdGggPSBNYXRoLm1heCguLi5mcmFtZXMubWFwKGYgPT4gbG9jKGYpLmxlbmd0aCksIDApXG4gIGNvbnN0IGNhbGxlZVdpZHRoID0gTWF0aC5tYXgoLi4uZnJhbWVzLm1hcChmID0+IGYuY2FsbGVlLmxlbmd0aCksIDApXG4gIGNvbnN0IHN0eWxlOiBCcmFja2V0U3R5bGUgPSB7IG9uZTogJycsIHRvcDogJycsIG1pZDogJycsIGJvdDogJycgfVxuICBzdHlsZS50b3AgPSAn4pWt4pSA4pa2ICdcbiAgc3R5bGUubWlkID0gJ+KUnOKUgOKUgCAnXG4gIHN0eWxlLmJvdCA9ICfilbDilIDilIAgJ1xuICBzdHlsZS5vbmUgPSAnICDilrYgJ1xuICBjb25zdCBzdGFja0xpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZnJhbWUgPSBmcmFtZXNbaV1cbiAgICBjb25zdCBwYWRkZWRMb2MgPSBgJHtncmF5KGxvYyhmcmFtZSkucGFkRW5kKGxvY1dpZHRoKSl9OmBcbiAgICBjb25zdCBwYWRkZWRDYWxsZWUgPSBgJHtncmF5KGZyYW1lLmNhbGxlZS5wYWRFbmQoY2FsbGVlV2lkdGgpKX1gXG4gICAgaWYgKGZyYW1lLnNvdXJjZUxpbmUpIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBmcmFtZS5zb3VyY2VMaW5lLnRyaW0oKVxuICAgICAgY29uc3QgY29sID0gZnJhbWUuY29sdW1uIC0gKGZyYW1lLnNvdXJjZUxpbmUubGVuZ3RoIC0gZnJhbWUuc291cmNlTGluZS50cmltU3RhcnQoKS5sZW5ndGgpXG4gICAgICBjb25zdCBiZWZvcmUgPSBsaW5lLnNsaWNlKDAsIGNvbCAtIDEpXG4gICAgICBjb25zdCB3b3JkID0gbGluZS5zbGljZShjb2wgLSAxKS5tYXRjaCgvXihcXHcrfFxcKCkvKT8uWzBdID8/ICcnXG4gICAgICBjb25zdCBhZnRlciA9IGxpbmUuc2xpY2UoY29sIC0gMSArIHdvcmQubGVuZ3RoKVxuICAgICAgY29uc3QgbGluZUNvbG9yZWQgPSBgJHtncmF5KGJlZm9yZSl9JHt5ZWxsb3cod29yZCl9JHtncmF5KGFmdGVyKX1gXG4gICAgICBzdGFja0xpbmVzLnB1c2goYCR7Z3JheSgnYXQnKX0gJHtwYWRkZWRDYWxsZWV9ICR7cGFkZGVkTG9jfSAke2xpbmVDb2xvcmVkfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YWNrTGluZXMucHVzaChgJHtncmF5KCdhdCcpfSAke3BhZGRlZENhbGxlZX0gJHtwYWRkZWRMb2N9ICR7Z3JheSgnLy8gc291cmNlIG5vdCBhdmFpbGFibGUnKX1gKVxuICAgIH1cbiAgfVxuICBicmFja2V0KHN0YWNrTGluZXMsIHN0eWxlLCBncmF5KVxuXG4gIGNvbnN0IHByaW50SW5uZXIgPSAoZXJyb3JzOiBFcnJvcltdKTogc3RyaW5nW10gPT4ge1xuICAgIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbm5lckVyciA9IGVycm9yc1tpXVxuICAgICAgb3V0LnB1c2gocmVkKCfilIInKSlcbiAgICAgIGNvbnN0IGlubmVyID0gcHJldHR5RXJyb3JUcmVlTGluZXMoaW5uZXJFcnIpXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGlubmVyLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChmYWxzZSkgY29udGludWVcbiAgICAgICAgZWxzZSBpZiAoaSA8IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilJzilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPCBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID4gMCkgaW5uZXJbal0gPSByZWQoYOKUgiBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilbDilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPiAwKSBpbm5lcltqXSA9IHJlZChgICBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgY29udGludWVcbiAgICAgIH1cbiAgICAgIG91dC5wdXNoKC4uLmlubmVyKVxuICAgIH1cbiAgICByZXR1cm4gb3V0XG4gIH1cblxuICBjb25zdCBpbm5lckVycm9yTGluZXM6IHN0cmluZ1tdID0gW11cblxuICAvLyBBZ2dyZWdhdGVFcnJvclxuICBpZiAoZXJyIGluc3RhbmNlb2YgQWdncmVnYXRlRXJyb3IgJiYgQXJyYXkuaXNBcnJheShlcnIuZXJyb3JzKSkge1xuICAgIGlubmVyRXJyb3JMaW5lcy5wdXNoKC4uLnByaW50SW5uZXIoZXJyLmVycm9ycykpXG4gIH1cblxuICAvLyBTdXBwcmVzc2VkRXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFN1cHByZXNzZWRFcnJvcikge1xuICAgIDsoZXJyLmVycm9yIGFzIEVycm9yRXh0cmEpLnByZWZpeCA9ICdTdXBwcmVzc2VkIGJ5ICdcbiAgICA7KGVyci5zdXBwcmVzc2VkIGFzIEVycm9yRXh0cmEpLnByZWZpeCA9ICdTdXBwcmVzc2VkICdcbiAgICBpbm5lckVycm9yTGluZXMucHVzaCguLi5wcmludElubmVyKFtlcnIuZXJyb3IsIGVyci5zdXBwcmVzc2VkXSkpXG4gIH1cblxuICAvLyBjYXVzZVxuICBjb25zdCBjYXVzZUxpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGlmIChlcnIuY2F1c2UpIHtcbiAgICBjYXVzZUxpbmVzLnB1c2gobWFnZW50YSgn4pSCJykpXG4gICAgY29uc3QgY2F1c2U6IHN0cmluZ1tdID0gKCgpID0+IHtcbiAgICAgIGlmIChlcnIuY2F1c2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICA7KGVyci5jYXVzZSBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnQ2F1c2VkIGJ5OiAnXG4gICAgICAgIHJldHVybiBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIuY2F1c2UpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW2BDYXVzZWQgYnk6ICR7U3RyaW5nKGVyci5jYXVzZSl9YF1cbiAgICAgIH1cbiAgICB9KSgpXG4gICAgY2F1c2VMaW5lcy5wdXNoKC4uLmNhdXNlKVxuICB9XG5cbiAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdXG4gIG91dC5wdXNoKC4uLmhlYWRlckxpbmVzKVxuICBpZiAocHJvcExpbmVzLmxlbmd0aCA+IDApIG91dC5wdXNoKCcnKVxuICBvdXQucHVzaCguLi5wcm9wTGluZXMpXG4gIGlmIChzdGFja0xpbmVzLmxlbmd0aCA+IDApIG91dC5wdXNoKCcnKVxuICBvdXQucHVzaCguLi5zdGFja0xpbmVzKVxuICBmb3IgKGxldCBpID0gMTsgaSA8IG91dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChpbm5lckVycm9yTGluZXMubGVuZ3RoID4gMCkgb3V0W2ldID0gcmVkKCfilIIgJykgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9ICcgICcgKyBvdXRbaV1cbiAgfVxuICBvdXQucHVzaCguLi5pbm5lckVycm9yTGluZXMpXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNhdXNlTGluZXMubGVuZ3RoID4gMCkgb3V0W2ldID0gbWFnZW50YSgn4pSCICcpICsgb3V0W2ldXG4gICAgZWxzZSBvdXRbaV0gPSAnICAnICsgb3V0W2ldXG4gIH1cbiAgb3V0LnB1c2goLi4uY2F1c2VMaW5lcylcbiAgcmV0dXJuIG91dFxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBTUEsTUFBYSwrQkFBK0I7Q0FDMUMsTUFBTSxLQUFLLFFBQWE7QUFDdEIsVUFBUSxNQUFNLGdCQUFnQixJQUFJLENBQUM7QUFDbkMsVUFBUSxLQUFLLEVBQUU7O0FBR2pCLFNBQVEsR0FBRyxxQkFBcUIsRUFBRTtBQUNsQyxTQUFRLEdBQUcsc0JBQXNCLEVBQUU7O0FBS3JDLE1BQU0sV0FBVyxLQUFlLE9BQXFCLFVBQTJDO0FBQzlGLE1BQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsSUFDOUIsS0FBSSxNQUFNLEtBQUssTUFBTSxJQUFJLFNBQVMsRUFBRyxLQUFJLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJO1VBQzVELE1BQU0sRUFBRyxLQUFJLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJO1VBQ3pDLE1BQU0sSUFBSSxTQUFTLEVBQUcsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtLQUMxRCxLQUFJLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJO0FBR3ZDLFFBQU87O0FBR1QsTUFBTSxRQUFRLE1BQWMsV0FBVyxFQUFFO0FBQ3pDLE1BQU0sT0FBTyxNQUFjLFdBQVcsRUFBRTtBQUN4QyxNQUFNLFVBQVUsTUFBYyxXQUFXLEVBQUU7QUFFM0MsTUFBTSxXQUFXLE1BQWMsV0FBVyxFQUFFO0FBWTVDLE1BQWEsY0FBYyxVQUEyQjtDQUNwRCxNQUFNLDRCQUFZLElBQUksS0FBdUI7Q0FFN0MsU0FBUyxjQUFjLE1BQWMsTUFBa0M7RUFDckUsSUFB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