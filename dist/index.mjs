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
export { installPrettyErrorTree, parseStack, prettyErrorTree };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdXRpbCBmcm9tICd1dGlsJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCBnZXRTb3VyY2UgZnJvbSAnZ2V0LXNvdXJjZSdcbmltcG9ydCBmcyBmcm9tICdmcydcblxuZXhwb3J0IGNvbnN0IGluc3RhbGxQcmV0dHlFcnJvclRyZWUgPSAoKSA9PiB7XG4gIGNvbnN0IGggPSAoZXJyOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKHByZXR0eUVycm9yVHJlZShlcnIpKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBoKVxuICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBoKVxufVxuXG50eXBlIEJyYWNrZXRTdHlsZSA9IHsgb25lOiBzdHJpbmc7IHRvcDogc3RyaW5nOyBtaWQ6IHN0cmluZzsgYm90OiBzdHJpbmcgfVxuXG5jb25zdCBicmFja2V0ID0gKG91dDogc3RyaW5nW10sIHN0eWxlOiBCcmFja2V0U3R5bGUsIGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGkgPT09IDAgJiYgaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLm9uZSkgKyBvdXRbaV1cbiAgICBlbHNlIGlmIChpID09PSAwKSBvdXRbaV0gPSBjb2xvcihzdHlsZS50b3ApICsgb3V0W2ldXG4gICAgZWxzZSBpZiAoaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLmJvdCkgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9IGNvbG9yKHN0eWxlLm1pZCkgKyBvdXRbaV1cbiAgfVxuXG4gIHJldHVybiBvdXRcbn1cblxuY29uc3QgZ3JheSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYls5MG0ke3N9XFx4MWJbMG1gXG5jb25zdCByZWQgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzFtJHtzfVxceDFiWzBtYFxuY29uc3QgeWVsbG93ID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMzbSR7c31cXHgxYlswbWBcbmNvbnN0IGJsdWUgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzRtJHtzfVxceDFiWzBtYFxuY29uc3QgbWFnZW50YSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYlszNW0ke3N9XFx4MWJbMG1gXG5jb25zdCBjeWFuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzM2bSR7c31cXHgxYlswbWBcbmNvbnN0IGdyZWVuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMybSR7c31cXHgxYlswbWBcblxuZXhwb3J0IHR5cGUgRnJhbWUgPSB7XG4gIGZpbGU6IHN0cmluZ1xuICBsaW5lOiBudW1iZXJcbiAgY29sdW1uOiBudW1iZXJcbiAgc291cmNlTGluZT86IHN0cmluZ1xuICBjYWxsZWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2VTdGFjayA9IChzdGFjazogc3RyaW5nKTogRnJhbWVbXSA9PiB7XG4gIGNvbnN0IGZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKVxuXG4gIGZ1bmN0aW9uIGdldFNvdXJjZUxpbmUoZmlsZTogc3RyaW5nLCBsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGxldCBsaW5lcyA9IGZpbGVDYWNoZS5nZXQoZmlsZSlcblxuICAgIGlmICghbGluZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbGluZXMgPSBbXVxuICAgICAgfVxuICAgICAgZmlsZUNhY2hlLnNldChmaWxlLCBsaW5lcylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXNbbGluZSAtIDFdXG4gIH1cblxuICByZXR1cm4gc3RhY2suc3BsaXQoJ1xcbicpLmZsYXRNYXAoKHN0YWNrTGluZSk6IEZyYW1lW10gPT4ge1xuICAgIGNvbnN0IG1hdGNoMSA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccytcXCgoW15cXHNdKyk6KFxcZCspOihcXGQrKVxcKSQvKVxuICAgIGNvbnN0IG1hdGNoMiA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccysoW15cXHNdKyk6KFxcZCspOihcXGQrKSQvKVxuICAgIGNvbnN0IG1hdGNoID0gbWF0Y2gxID8/IG1hdGNoMlxuICAgIGlmICghbWF0Y2gpIHJldHVybiBbXVxuXG4gICAgY29uc3QgWywgY2FsbGVlLCBmaWxlTWF5YmVVcmwsIGxpbmVTdHIsIGNvbHVtblN0cl0gPSBtYXRjaFxuICAgIGNvbnN0IGxpbmUgPSBwYXJzZUludChsaW5lU3RyLCAxMClcbiAgICBjb25zdCBjb2x1bW4gPSBwYXJzZUludChjb2x1bW5TdHIsIDEwKVxuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVNYXliZVVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykgPyBmaWxlVVJMVG9QYXRoKGZpbGVNYXliZVVybCkgOiBmaWxlTWF5YmVVcmxcblxuICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBnZXRTb3VyY2VMaW5lKGZpbGUsIGxpbmUpXG5cbiAgICByZXR1cm4gW3sgZmlsZSwgbGluZSwgY29sdW1uLCBzb3VyY2VMaW5lLCBjYWxsZWUgfV1cbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXJyb3JFeHRyYSA9IEVycm9yICYgeyBwYXJzZWRTdGFjaz86IEZyYW1lW107IHByZWZpeD86IHN0cmluZyB9XG5cbmV4cG9ydCBjb25zdCBwcmV0dHlFcnJvclRyZWUgPSAoZXJyOiBFcnJvckV4dHJhKTogc3RyaW5nID0+IHtcbiAgY29uc3QgbGluZXMgPSBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIpXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxufVxuXG5jb25zdCBwcmV0dHlFcnJvclRyZWVMaW5lcyA9IChlcnI6IEVycm9yRXh0cmEpOiBzdHJpbmdbXSA9PiB7XG4gIGNvbnN0IHN0YWNrID0gZXJyLnBhcnNlZFN0YWNrID8/IChlcnIuc3RhY2sgPyBwYXJzZVN0YWNrKGVyci5zdGFjaykgOiBbXSlcbiAgY29uc3QgZnJhbWVzID0gc3RhY2tcblxuICAvLyBuYW1lIGFuZCBtZXNzYWdlXG4gIGNvbnN0IGhlYWRlckxpbmVzID0gW2Ake2Vyci5wcmVmaXggPz8gJyd9JHtncmF5KCdbJyl9JHtyZWQoZXJyLm5hbWUpfSR7Z3JheSgnXScpfSAke2Vyci5tZXNzYWdlLnRyaW0oKX1gXVxuXG4gIC8vIHByb3BzXG4gIGNvbnN0IGtub3duID0gbmV3IFNldChbJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycsICdjYXVzZScsICdlcnJvcnMnLCAncGFyc2VkU3RhY2snLCAncHJlZml4JywgJ2Vycm9yJywgJ3N1cHByZXNzZWQnXSlcbiAgY29uc3QgcHJvcHNPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge31cbiAgY29uc3QgZXJyT2JqID0gZXJyIGFzIEVycm9yICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgbGV0IGhhc1Byb3BzID0gZmFsc2VcbiAgY29uc3QgcHJvcExpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGVycikpIHtcbiAgICBpZiAoa25vd24uaGFzKGtleSkpIGNvbnRpbnVlXG4gICAgcHJvcHNPYmpba2V5XSA9IGVyck9ialtrZXldXG4gICAgaGFzUHJvcHMgPSB0cnVlXG4gIH1cbiAgaWYgKGhhc1Byb3BzKSB7XG4gICAgY29uc3QgaW5zcGVjdExpbmVzID0gdXRpbC5pbnNwZWN0KHByb3BzT2JqLCB7IGNvbG9yczogdHJ1ZSwgZGVwdGg6IG51bGwsIGNvbXBhY3Q6IDEwIH0pLnNwbGl0KCdcXG4nKVxuICAgIHByb3BMaW5lcy5wdXNoKGdyYXkoJ1Byb3BlcnRpZXM6ICcpICsgaW5zcGVjdExpbmVzWzBdKVxuICAgIHByb3BMaW5lcy5wdXNoKC4uLmluc3BlY3RMaW5lcy5zbGljZSgxKSlcbiAgfVxuXG4gIC8vIHN0YWNrIHRyYWNlXG4gIGNvbnN0IGxvYyA9IChpdGVtOiBGcmFtZSkgPT4gYCR7cGF0aC5yZWxhdGl2ZShwcm9jZXNzLmN3ZCgpLCBpdGVtLmZpbGUpfToke2l0ZW0ubGluZX06JHtpdGVtLmNvbHVtbn1gXG4gIGNvbnN0IGxvY1dpZHRoID0gTWF0aC5tYXgoLi4uZnJhbWVzLm1hcChmID0+IGxvYyhmKS5sZW5ndGgpLCAwKVxuICBjb25zdCBjYWxsZWVXaWR0aCA9IE1hdGgubWF4KC4uLmZyYW1lcy5tYXAoZiA9PiBmLmNhbGxlZS5sZW5ndGgpLCAwKVxuICBjb25zdCBzdHlsZTogQnJhY2tldFN0eWxlID0geyBvbmU6ICcnLCB0b3A6ICcnLCBtaWQ6ICcnLCBib3Q6ICcnIH1cbiAgc3R5bGUudG9wID0gJ+KVreKUgOKWtiAnXG4gIHN0eWxlLm1pZCA9ICfilJzilIDilIAgJ1xuICBzdHlsZS5ib3QgPSAn4pWw4pSA4pSAICdcbiAgc3R5bGUub25lID0gJyAg4pa2ICdcbiAgY29uc3Qgc3RhY2tMaW5lczogc3RyaW5nW10gPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZyYW1lID0gZnJhbWVzW2ldXG4gICAgY29uc3QgcGFkZGVkTG9jID0gYCR7Z3JheShsb2MoZnJhbWUpLnBhZEVuZChsb2NXaWR0aCkpfTpgXG4gICAgY29uc3QgcGFkZGVkQ2FsbGVlID0gYCR7Z3JheShmcmFtZS5jYWxsZWUucGFkRW5kKGNhbGxlZVdpZHRoKSl9YFxuICAgIGlmIChmcmFtZS5zb3VyY2VMaW5lKSB7XG4gICAgICBjb25zdCBsaW5lID0gZnJhbWUuc291cmNlTGluZS50cmltKClcbiAgICAgIGNvbnN0IGNvbCA9IGZyYW1lLmNvbHVtbiAtIChmcmFtZS5zb3VyY2VMaW5lLmxlbmd0aCAtIGZyYW1lLnNvdXJjZUxpbmUudHJpbVN0YXJ0KCkubGVuZ3RoKVxuICAgICAgY29uc3QgYmVmb3JlID0gbGluZS5zbGljZSgwLCBjb2wgLSAxKVxuICAgICAgY29uc3Qgd29yZCA9IGxpbmUuc2xpY2UoY29sIC0gMSkubWF0Y2goL14oXFx3K3xcXCgpLyk/LlswXSA/PyAnJ1xuICAgICAgY29uc3QgYWZ0ZXIgPSBsaW5lLnNsaWNlKGNvbCAtIDEgKyB3b3JkLmxlbmd0aClcbiAgICAgIGNvbnN0IGxpbmVDb2xvcmVkID0gYCR7Z3JheShiZWZvcmUpfSR7eWVsbG93KHdvcmQpfSR7Z3JheShhZnRlcil9YFxuICAgICAgc3RhY2tMaW5lcy5wdXNoKGAke2dyYXkoJ2F0Jyl9ICR7cGFkZGVkQ2FsbGVlfSAke3BhZGRlZExvY30gJHtsaW5lQ29sb3JlZH1gKVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGFja0xpbmVzLnB1c2goYCR7Z3JheSgnYXQnKX0gJHtwYWRkZWRDYWxsZWV9ICR7cGFkZGVkTG9jfSAke2dyYXkoJy8vIHNvdXJjZSBub3QgYXZhaWxhYmxlJyl9YClcbiAgICB9XG4gIH1cbiAgYnJhY2tldChzdGFja0xpbmVzLCBzdHlsZSwgZ3JheSlcblxuICBjb25zdCBwcmludElubmVyID0gKGVycm9yczogRXJyb3JbXSk6IHN0cmluZ1tdID0+IHtcbiAgICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW11cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5uZXJFcnIgPSBlcnJvcnNbaV1cbiAgICAgIG91dC5wdXNoKHJlZCgn4pSCJykpXG4gICAgICBjb25zdCBpbm5lciA9IHByZXR0eUVycm9yVHJlZUxpbmVzKGlubmVyRXJyKVxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpbm5lci5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoZmFsc2UpIGNvbnRpbnVlXG4gICAgICAgIGVsc2UgaWYgKGkgPCBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID09PSAwKSBpbm5lcltqXSA9IHJlZChg4pSc4pSAYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpIDwgZXJyb3JzLmxlbmd0aCAtIDEgJiYgaiA+IDApIGlubmVyW2pdID0gcmVkKGDilIIgYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpID09PSBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID09PSAwKSBpbm5lcltqXSA9IHJlZChg4pWw4pSAYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGlmIChpID09PSBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID4gMCkgaW5uZXJbal0gPSByZWQoYCAgYCkgKyBpbm5lcltqXVxuICAgICAgICBlbHNlIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBvdXQucHVzaCguLi5pbm5lcilcbiAgICB9XG4gICAgcmV0dXJuIG91dFxuICB9XG5cbiAgY29uc3QgaW5uZXJFcnJvckxpbmVzOiBzdHJpbmdbXSA9IFtdXG5cbiAgLy8gQWdncmVnYXRlRXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEFnZ3JlZ2F0ZUVycm9yICYmIEFycmF5LmlzQXJyYXkoZXJyLmVycm9ycykpIHtcbiAgICBpbm5lckVycm9yTGluZXMucHVzaCguLi5wcmludElubmVyKGVyci5lcnJvcnMpKVxuICB9XG5cbiAgLy8gU3VwcHJlc3NlZEVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBTdXBwcmVzc2VkRXJyb3IpIHtcbiAgICA7KGVyci5lcnJvciBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnU3VwcHJlc3NlZCBieSAnXG4gICAgOyhlcnIuc3VwcHJlc3NlZCBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnU3VwcHJlc3NlZCAnXG4gICAgaW5uZXJFcnJvckxpbmVzLnB1c2goLi4ucHJpbnRJbm5lcihbZXJyLmVycm9yLCBlcnIuc3VwcHJlc3NlZF0pKVxuICB9XG5cbiAgLy8gY2F1c2VcbiAgY29uc3QgY2F1c2VMaW5lczogc3RyaW5nW10gPSBbXVxuICBpZiAoZXJyLmNhdXNlKSB7XG4gICAgY2F1c2VMaW5lcy5wdXNoKG1hZ2VudGEoJ+KUgicpKVxuICAgIGNvbnN0IGNhdXNlOiBzdHJpbmdbXSA9ICgoKSA9PiB7XG4gICAgICBpZiAoZXJyLmNhdXNlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgOyhlcnIuY2F1c2UgYXMgRXJyb3JFeHRyYSkucHJlZml4ID0gJ0NhdXNlZCBieTogJ1xuICAgICAgICByZXR1cm4gcHJldHR5RXJyb3JUcmVlTGluZXMoZXJyLmNhdXNlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtgQ2F1c2VkIGJ5OiAke1N0cmluZyhlcnIuY2F1c2UpfWBdXG4gICAgICB9XG4gICAgfSkoKVxuICAgIGNhdXNlTGluZXMucHVzaCguLi5jYXVzZSlcbiAgfVxuXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXVxuICBvdXQucHVzaCguLi5oZWFkZXJMaW5lcylcbiAgaWYgKHByb3BMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4ucHJvcExpbmVzKVxuICBpZiAoc3RhY2tMaW5lcy5sZW5ndGggPiAwKSBvdXQucHVzaCgnJylcbiAgb3V0LnB1c2goLi4uc3RhY2tMaW5lcylcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBvdXQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoaW5uZXJFcnJvckxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IHJlZCgn4pSCICcpICsgb3V0W2ldXG4gICAgZWxzZSBvdXRbaV0gPSAnICAnICsgb3V0W2ldXG4gIH1cbiAgb3V0LnB1c2goLi4uaW5uZXJFcnJvckxpbmVzKVxuICBmb3IgKGxldCBpID0gMTsgaSA8IG91dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChjYXVzZUxpbmVzLmxlbmd0aCA+IDApIG91dFtpXSA9IG1hZ2VudGEoJ+KUgiAnKSArIG91dFtpXVxuICAgIGVsc2Ugb3V0W2ldID0gJyAgJyArIG91dFtpXVxuICB9XG4gIG91dC5wdXNoKC4uLmNhdXNlTGluZXMpXG4gIHJldHVybiBvdXRcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFNQSxNQUFhLCtCQUErQjtDQUMxQyxNQUFNLEtBQUssUUFBYTtBQUN0QixVQUFRLE1BQU0sZ0JBQWdCLElBQUksQ0FBQztBQUNuQyxVQUFRLEtBQUssRUFBRTs7QUFHakIsU0FBUSxHQUFHLHFCQUFxQixFQUFFO0FBQ2xDLFNBQVEsR0FBRyxzQkFBc0IsRUFBRTs7QUFLckMsTUFBTSxXQUFXLEtBQWUsT0FBcUIsVUFBMkM7QUFDOUYsTUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksUUFBUSxJQUM5QixLQUFJLE1BQU0sS0FBSyxNQUFNLElBQUksU0FBUyxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7VUFDNUQsTUFBTSxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7VUFDekMsTUFBTSxJQUFJLFNBQVMsRUFBRyxLQUFJLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJO0tBQzFELEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFHdkMsUUFBTzs7QUFHVCxNQUFNLFFBQVEsTUFBYyxXQUFXLEVBQUU7QUFDekMsTUFBTSxPQUFPLE1BQWMsV0FBVyxFQUFFO0FBQ3hDLE1BQU0sVUFBVSxNQUFjLFdBQVcsRUFBRTtBQUUzQyxNQUFNLFdBQVcsTUFBYyxXQUFXLEVBQUU7QUFZNUMsTUFBYSxjQUFjLFVBQTJCO0NBQ3BELE1BQU0sNEJBQVksSUFBSSxLQUF1QjtDQUU3QyxTQUFTLGNBQWMsTUFBYyxNQUFrQztFQUNyRSxJQUFJLFFBQVEsVUFBVSxJQUFJLEtBQUs7QUFFL0IsTUFBSSxDQUFDLE9BQU87QUFDVixPQUFJO0FBQ0YsWUFBUSxHQUFHLGFBQWEsTUFBTSxPQUFPLENBQUMsTUFBTSxL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