import * as path from "path";
import util from "util";
import { fileURLToPath } from "url";
import fs from "fs";
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
				lines = fs.readFileSync(file, "utf8").split("\n");
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
		const file = fileMaybeUrl.startsWith("file://") ? fileURLToPath(fileMaybeUrl) : fileMaybeUrl;
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
const prettyErrorTreeLines = (err, prefix) => {
	if (!err || typeof err !== "object") return [`${String(err)}`];
	const frames = err.parsedStack ?? (err.stack ? parseStack(err.stack) : []);
	const headerLines = [`${prefix ?? ""}${gray("[")}${red(err.name)}${gray("]")} ${err.message.trim()}`];
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
		const inspectLines = util.inspect(propsObj, {
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
			const inner = prettyErrorTreeLines(innerErr.error, innerErr.prefix);
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
	if (err instanceof AggregateError && Array.isArray(err.errors)) innerErrorLines.push(...printInner(err.errors.map((error) => ({ error }))));
	if (err instanceof SuppressedError) innerErrorLines.push(...printInner([{
		error: err.error,
		prefix: "Suppressed by "
	}, {
		error: err.suppressed,
		prefix: "Suppressed "
	}]));
	const causeLines = [];
	if (err.cause) {
		causeLines.push(magenta("│"));
		const cause = (() => {
			if (err.cause instanceof Error) return prettyErrorTreeLines(err.cause, "Caused by: ");
			else return [`Caused by: ${String(err.cause)}`];
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
export { installPrettyErrorTree, parseStack, prettyErrorTree };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdXRpbCBmcm9tICd1dGlsJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCBnZXRTb3VyY2UgZnJvbSAnZ2V0LXNvdXJjZSdcbmltcG9ydCBmcyBmcm9tICdmcydcblxuZXhwb3J0IGNvbnN0IGluc3RhbGxQcmV0dHlFcnJvclRyZWUgPSAoKSA9PiB7XG4gIGNvbnN0IGggPSAoZXJyOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKHByZXR0eUVycm9yVHJlZShlcnIpKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBoKVxuICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBoKVxufVxuXG50eXBlIEJyYWNrZXRTdHlsZSA9IHsgb25lOiBzdHJpbmc7IHRvcDogc3RyaW5nOyBtaWQ6IHN0cmluZzsgYm90OiBzdHJpbmcgfVxuXG5jb25zdCBicmFja2V0ID0gKG91dDogc3RyaW5nW10sIHN0eWxlOiBCcmFja2V0U3R5bGUsIGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGkgPT09IDAgJiYgaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLm9uZSkgKyBvdXRbaV1cbiAgICBlbHNlIGlmIChpID09PSAwKSBvdXRbaV0gPSBjb2xvcihzdHlsZS50b3ApICsgb3V0W2ldXG4gICAgZWxzZSBpZiAoaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLmJvdCkgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9IGNvbG9yKHN0eWxlLm1pZCkgKyBvdXRbaV1cbiAgfVxuXG4gIHJldHVybiBvdXRcbn1cblxuY29uc3QgZ3JheSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYls5MG0ke3N9XFx4MWJbMG1gXG5jb25zdCByZWQgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzFtJHtzfVxceDFiWzBtYFxuY29uc3QgeWVsbG93ID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMzbSR7c31cXHgxYlswbWBcbmNvbnN0IGJsdWUgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzRtJHtzfVxceDFiWzBtYFxuY29uc3QgbWFnZW50YSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYlszNW0ke3N9XFx4MWJbMG1gXG5jb25zdCBjeWFuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzM2bSR7c31cXHgxYlswbWBcbmNvbnN0IGdyZWVuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMybSR7c31cXHgxYlswbWBcblxuZXhwb3J0IHR5cGUgRnJhbWUgPSB7XG4gIGZpbGU6IHN0cmluZ1xuICBsaW5lOiBudW1iZXJcbiAgY29sdW1uOiBudW1iZXJcbiAgc291cmNlTGluZT86IHN0cmluZ1xuICBjYWxsZWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2VTdGFjayA9IChzdGFjazogc3RyaW5nKTogRnJhbWVbXSA9PiB7XG4gIGNvbnN0IGZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKVxuXG4gIGZ1bmN0aW9uIGdldFNvdXJjZUxpbmUoZmlsZTogc3RyaW5nLCBsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGxldCBsaW5lcyA9IGZpbGVDYWNoZS5nZXQoZmlsZSlcblxuICAgIGlmICghbGluZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbGluZXMgPSBbXVxuICAgICAgfVxuICAgICAgZmlsZUNhY2hlLnNldChmaWxlLCBsaW5lcylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXNbbGluZSAtIDFdXG4gIH1cblxuICByZXR1cm4gc3RhY2suc3BsaXQoJ1xcbicpLmZsYXRNYXAoKHN0YWNrTGluZSk6IEZyYW1lW10gPT4ge1xuICAgIGNvbnN0IG1hdGNoMSA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccytcXCgoW15cXHNdKyk6KFxcZCspOihcXGQrKVxcKSQvKVxuICAgIGNvbnN0IG1hdGNoMiA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccysoW15cXHNdKyk6KFxcZCspOihcXGQrKSQvKVxuICAgIGNvbnN0IG1hdGNoID0gbWF0Y2gxID8/IG1hdGNoMlxuICAgIGlmICghbWF0Y2gpIHJldHVybiBbXVxuXG4gICAgY29uc3QgWywgY2FsbGVlLCBmaWxlTWF5YmVVcmwsIGxpbmVTdHIsIGNvbHVtblN0cl0gPSBtYXRjaFxuICAgIGNvbnN0IGxpbmUgPSBwYXJzZUludChsaW5lU3RyLCAxMClcbiAgICBjb25zdCBjb2x1bW4gPSBwYXJzZUludChjb2x1bW5TdHIsIDEwKVxuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVNYXliZVVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykgPyBmaWxlVVJMVG9QYXRoKGZpbGVNYXliZVVybCkgOiBmaWxlTWF5YmVVcmxcblxuICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBnZXRTb3VyY2VMaW5lKGZpbGUsIGxpbmUpXG5cbiAgICByZXR1cm4gW3sgZmlsZSwgbGluZSwgY29sdW1uLCBzb3VyY2VMaW5lLCBjYWxsZWUgfV1cbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXJyb3JFeHRyYSA9IEVycm9yICYgeyBwYXJzZWRTdGFjaz86IEZyYW1lW107IHByZWZpeD86IHN0cmluZyB9XG5cbmV4cG9ydCBjb25zdCBwcmV0dHlFcnJvclRyZWUgPSAoZXJyOiBFcnJvckV4dHJhKTogc3RyaW5nID0+IHtcbiAgY29uc3QgbGluZXMgPSBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIpXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxufVxuXG5jb25zdCBwcmV0dHlFcnJvclRyZWVMaW5lcyA9IChlcnI6IEVycm9yRXh0cmEsIHByZWZpeD86IHN0cmluZyk6IHN0cmluZ1tdID0+IHtcbiAgaWYgKCFlcnIgfHwgdHlwZW9mIGVyciAhPT0gJ29iamVjdCcpIHJldHVybiBbYCR7U3RyaW5nKGVycil9YF1cblxuICBjb25zdCBzdGFjayA9IGVyci5wYXJzZWRTdGFjayA/PyAoZXJyLnN0YWNrID8gcGFyc2VTdGFjayhlcnIuc3RhY2spIDogW10pXG4gIGNvbnN0IGZyYW1lcyA9IHN0YWNrXG5cbiAgLy8gbmFtZSBhbmQgbWVzc2FnZVxuICBjb25zdCBoZWFkZXJMaW5lcyA9IFtgJHtwcmVmaXggPz8gJyd9JHtncmF5KCdbJyl9JHtyZWQoZXJyLm5hbWUpfSR7Z3JheSgnXScpfSAke2Vyci5tZXNzYWdlLnRyaW0oKX1gXVxuXG4gIC8vIHByb3BzXG4gIGNvbnN0IGtub3duID0gbmV3IFNldChbJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycsICdjYXVzZScsICdlcnJvcnMnLCAncGFyc2VkU3RhY2snLCAncHJlZml4JywgJ2Vycm9yJywgJ3N1cHByZXNzZWQnXSlcbiAgY29uc3QgcHJvcHNPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge31cbiAgY29uc3QgZXJyT2JqID0gZXJyIGFzIEVycm9yICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgbGV0IGhhc1Byb3BzID0gZmFsc2VcbiAgY29uc3QgcHJvcExpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGVycikpIHtcbiAgICBpZiAoa25vd24uaGFzKGtleSkpIGNvbnRpbnVlXG4gICAgcHJvcHNPYmpba2V5XSA9IGVyck9ialtrZXldXG4gICAgaGFzUHJvcHMgPSB0cnVlXG4gIH1cbiAgaWYgKGhhc1Byb3BzKSB7XG4gICAgY29uc3QgaW5zcGVjdExpbmVzID0gdXRpbC5pbnNwZWN0KHByb3BzT2JqLCB7IGNvbG9yczogdHJ1ZSwgZGVwdGg6IG51bGwsIGNvbXBhY3Q6IDEwIH0pLnNwbGl0KCdcXG4nKVxuICAgIHByb3BMaW5lcy5wdXNoKGdyYXkoJ1Byb3BlcnRpZXM6ICcpICsgaW5zcGVjdExpbmVzWzBdKVxuICAgIHByb3BMaW5lcy5wdXNoKC4uLmluc3BlY3RMaW5lcy5zbGljZSgxKSlcbiAgfVxuXG4gIC8vIHN0YWNrIHRyYWNlXG4gIGNvbnN0IGxvYyA9IChpdGVtOiBGcmFtZSkgPT4gYCR7cGF0aC5yZWxhdGl2ZShwcm9jZXNzLmN3ZCgpLCBpdGVtLmZpbGUpfToke2l0ZW0ubGluZX06JHtpdGVtLmNvbHVtbn1gXG4gIGNvbnN0IGxvY1dpZHRoID0gTWF0aC5tYXgoLi4uZnJhbWVzLm1hcChmID0+IGxvYyhmKS5sZW5ndGgpLCAwKVxuICBjb25zdCBjYWxsZWVXaWR0aCA9IE1hdGgubWF4KC4uLmZyYW1lcy5tYXAoZiA9PiBmLmNhbGxlZS5sZW5ndGgpLCAwKVxuICBjb25zdCBzdHlsZTogQnJhY2tldFN0eWxlID0geyBvbmU6ICcnLCB0b3A6ICcnLCBtaWQ6ICcnLCBib3Q6ICcnIH1cbiAgc3R5bGUudG9wID0gJ+KVreKUgOKWtiAnXG4gIHN0eWxlLm1pZCA9ICfilJzilIDilIAgJ1xuICBzdHlsZS5ib3QgPSAn4pWw4pSA4pSAICdcbiAgc3R5bGUub25lID0gJyAg4pa2ICdcbiAgY29uc3Qgc3RhY2tMaW5lczogc3RyaW5nW10gPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZyYW1lID0gZnJhbWVzW2ldXG4gICAgY29uc3QgcGFkZGVkTG9jID0gYCR7Z3JheShsb2MoZnJhbWUpLnBhZEVuZChsb2NXaWR0aCkpfTpgXG4gICAgY29uc3QgcGFkZGVkQ2FsbGVlID0gYCR7Z3JheShmcmFtZS5jYWxsZWUucGFkRW5kKGNhbGxlZVdpZHRoKSl9YFxuICAgIGlmIChmcmFtZS5zb3VyY2VMaW5lKSB7XG4gICAgICBjb25zdCBsaW5lID0gZnJhbWUuc291cmNlTGluZS50cmltKClcbiAgICAgIGNvbnN0IGNvbCA9IGZyYW1lLmNvbHVtbiAtIChmcmFtZS5zb3VyY2VMaW5lLmxlbmd0aCAtIGZyYW1lLnNvdXJjZUxpbmUudHJpbVN0YXJ0KCkubGVuZ3RoKVxuICAgICAgY29uc3QgYmVmb3JlID0gbGluZS5zbGljZSgwLCBjb2wgLSAxKVxuICAgICAgY29uc3Qgd29yZCA9IGxpbmUuc2xpY2UoY29sIC0gMSkubWF0Y2goL14oXFx3K3xcXCgpLyk/LlswXSA/PyAnJ1xuICAgICAgY29uc3QgYWZ0ZXIgPSBsaW5lLnNsaWNlKGNvbCAtIDEgKyB3b3JkLmxlbmd0aClcbiAgICAgIGNvbnN0IGxpbmVDb2xvcmVkID0gYCR7Z3JheShiZWZvcmUpfSR7eWVsbG93KHdvcmQpfSR7Z3JheShhZnRlcil9YFxuICAgICAgc3RhY2tMaW5lcy5wdXNoKGAke2dyYXkoJ2F0Jyl9ICR7cGFkZGVkQ2FsbGVlfSAke3BhZGRlZExvY30gJHtsaW5lQ29sb3JlZH1gKVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGFja0xpbmVzLnB1c2goYCR7Z3JheSgnYXQnKX0gJHtwYWRkZWRDYWxsZWV9ICR7cGFkZGVkTG9jfSAke2dyYXkoJy8vIHNvdXJjZSBub3QgYXZhaWxhYmxlJyl9YClcbiAgICB9XG4gIH1cbiAgYnJhY2tldChzdGFja0xpbmVzLCBzdHlsZSwgZ3JheSlcblxuICBjb25zdCBwcmludElubmVyID0gKGVycm9yczogQXJyYXk8eyBlcnJvcjogRXJyb3I7IHByZWZpeD86IHN0cmluZyB9Pik6IHN0cmluZ1tdID0+IHtcbiAgICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW11cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5uZXJFcnIgPSBlcnJvcnNbaV1cbiAgICAgIG91dC5wdXNoKHJlZCgn4pSCJykpXG4gICAgICBjb25zdCBpbm5lciA9IHByZXR0eUVycm9yVHJlZUxpbmVzKGlubmVyRXJyLmVycm9yLCBpbm5lckVyci5wcmVmaXgpXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGlubmVyLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChmYWxzZSkgY29udGludWVcbiAgICAgICAgZWxzZSBpZiAoaSA8IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilJzilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPCBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID4gMCkgaW5uZXJbal0gPSByZWQoYOKUgiBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilbDilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPiAwKSBpbm5lcltqXSA9IHJlZChgICBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgY29udGludWVcbiAgICAgIH1cbiAgICAgIG91dC5wdXNoKC4uLmlubmVyKVxuICAgIH1cbiAgICByZXR1cm4gb3V0XG4gIH1cblxuICBjb25zdCBpbm5lckVycm9yTGluZXM6IHN0cmluZ1tdID0gW11cblxuICAvLyBBZ2dyZWdhdGVFcnJvclxuICBpZiAoZXJyIGluc3RhbmNlb2YgQWdncmVnYXRlRXJyb3IgJiYgQXJyYXkuaXNBcnJheShlcnIuZXJyb3JzKSkge1xuICAgIGlubmVyRXJyb3JMaW5lcy5wdXNoKC4uLnByaW50SW5uZXIoZXJyLmVycm9ycy5tYXAoZXJyb3IgPT4gKHsgZXJyb3IgfSkpKSlcbiAgfVxuXG4gIC8vIFN1cHByZXNzZWRFcnJvclxuICBpZiAoZXJyIGluc3RhbmNlb2YgU3VwcHJlc3NlZEVycm9yKSB7XG4gICAgaW5uZXJFcnJvckxpbmVzLnB1c2goXG4gICAgICAuLi5wcmludElubmVyKFtcbiAgICAgICAgeyBlcnJvcjogZXJyLmVycm9yLCBwcmVmaXg6ICdTdXBwcmVzc2VkIGJ5ICcgfSxcbiAgICAgICAgeyBlcnJvcjogZXJyLnN1cHByZXNzZWQsIHByZWZpeDogJ1N1cHByZXNzZWQgJyB9LFxuICAgICAgXSlcbiAgICApXG4gIH1cblxuICAvLyBjYXVzZVxuICBjb25zdCBjYXVzZUxpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGlmIChlcnIuY2F1c2UpIHtcbiAgICBjYXVzZUxpbmVzLnB1c2gobWFnZW50YSgn4pSCJykpXG4gICAgY29uc3QgY2F1c2U6IHN0cmluZ1tdID0gKCgpID0+IHtcbiAgICAgIGlmIChlcnIuY2F1c2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICByZXR1cm4gcHJldHR5RXJyb3JUcmVlTGluZXMoZXJyLmNhdXNlLCAnQ2F1c2VkIGJ5OiAnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtgQ2F1c2VkIGJ5OiAke1N0cmluZyhlcnIuY2F1c2UpfWBdXG4gICAgICB9XG4gICAgfSkoKVxuICAgIGNhdXNlTGluZXMucHVzaCguLi5jYXVzZSlcbiAgfVxuXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXVxuICBvdXQucHVzaCguLi5oZWFkZXJMaW5lcylcbiAgaWYgKHByb3BMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4ucHJvcExpbmVzKVxuICBpZiAoc3RhY2tMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4uc3RhY2tMaW5lcylcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBvdXQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoaW5uZXJFcnJvckxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IHJlZCgn4pSCICcpICsgb3V0W2ldXG4gICAgZWxzZSBvdXRbaV0gPSAnICAnICsgb3V0W2ldXG4gIH1cbiAgb3V0LnB1c2goLi4uaW5uZXJFcnJvckxpbmVzKVxuICBmb3IgKGxldCBpID0gMTsgaSA8IG91dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChjYXVzZUxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IG1hZ2VudGEoJ+KUgiAnKSArIG91dFtpXVxuICAgIGVsc2Ugb3V0W2ldID0gJyAgJyArIG91dFtpXVxuICB9XG4gIG91dC5wdXNoKC4uLmNhdXNlTGluZXMpXG4gIHJldHVybiBvdXRcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFNQSxNQUFhLCtCQUErQjtDQUMxQyxNQUFNLEtBQUssUUFBYTtBQUN0QixVQUFRLE1BQU0sZ0JBQWdCLElBQUksQ0FBQztBQUNuQyxVQUFRLEtBQUssRUFBRTs7QUFHakIsU0FBUSxHQUFHLHFCQUFxQixFQUFFO0FBQ2xDLFNBQVEsR0FBRyxzQkFBc0IsRUFBRTs7QUFLckMsTUFBTSxXQUFXLEtBQWUsT0FBcUIsVUFBMkM7QUFDOUYsTUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksUUFBUSxJQUM5QixLQUFJLE1BQU0sS0FBSyxNQUFNLElBQUksU0FBUyxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7VUFDNUQsTUFBTSxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7VUFDekMsTUFBTSxJQUFJLFNBQVMsRUFBRyxLQUFJLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJO0tBQzFELEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFHdkMsUUFBTzs7QUFHVCxNQUFNLFFBQVEsTUFBYyxXQUFXLEVBQUU7QUFDekMsTUFBTSxPQUFPLE1BQWMsV0FBVyxFQUFFO0FBQ3hDLE1BQU0sVUFBVSxNQUFjLFdBQVcsRUFBRTtBQUUzQyxNQUFNLFdBQVcsTUFBYyxXQUFXLEVBQUU7QUFZNUMsTUFBYSxjQUFjLFVBQTJCO0NBQ3BELE1BQU0sNEJBQVksSUFBSSxLQUF1QjtDQUU3QyxTQUFTLGNBQWMs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