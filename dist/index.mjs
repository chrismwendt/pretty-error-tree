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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdXRpbCBmcm9tICd1dGlsJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCBnZXRTb3VyY2UgZnJvbSAnZ2V0LXNvdXJjZSdcbmltcG9ydCBmcyBmcm9tICdmcydcblxuZXhwb3J0IGNvbnN0IGluc3RhbGxQcmV0dHlFcnJvclRyZWUgPSAoKSA9PiB7XG4gIGNvbnN0IGggPSAoZXJyOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKHByZXR0eUVycm9yVHJlZShlcnIpKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBoKVxuICBwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBoKVxufVxuXG50eXBlIEJyYWNrZXRTdHlsZSA9IHsgb25lOiBzdHJpbmc7IHRvcDogc3RyaW5nOyBtaWQ6IHN0cmluZzsgYm90OiBzdHJpbmcgfVxuXG5jb25zdCBicmFja2V0ID0gKG91dDogc3RyaW5nW10sIHN0eWxlOiBCcmFja2V0U3R5bGUsIGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGkgPT09IDAgJiYgaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLm9uZSkgKyBvdXRbaV1cbiAgICBlbHNlIGlmIChpID09PSAwKSBvdXRbaV0gPSBjb2xvcihzdHlsZS50b3ApICsgb3V0W2ldXG4gICAgZWxzZSBpZiAoaSA9PT0gb3V0Lmxlbmd0aCAtIDEpIG91dFtpXSA9IGNvbG9yKHN0eWxlLmJvdCkgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9IGNvbG9yKHN0eWxlLm1pZCkgKyBvdXRbaV1cbiAgfVxuXG4gIHJldHVybiBvdXRcbn1cblxuY29uc3QgZ3JheSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYls5MG0ke3N9XFx4MWJbMG1gXG5jb25zdCByZWQgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzFtJHtzfVxceDFiWzBtYFxuY29uc3QgeWVsbG93ID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMzbSR7c31cXHgxYlswbWBcbmNvbnN0IGJsdWUgPSAoczogc3RyaW5nKSA9PiBgXFx4MWJbMzRtJHtzfVxceDFiWzBtYFxuY29uc3QgbWFnZW50YSA9IChzOiBzdHJpbmcpID0+IGBcXHgxYlszNW0ke3N9XFx4MWJbMG1gXG5jb25zdCBjeWFuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzM2bSR7c31cXHgxYlswbWBcbmNvbnN0IGdyZWVuID0gKHM6IHN0cmluZykgPT4gYFxceDFiWzMybSR7c31cXHgxYlswbWBcblxuZXhwb3J0IHR5cGUgRnJhbWUgPSB7XG4gIGZpbGU6IHN0cmluZ1xuICBsaW5lOiBudW1iZXJcbiAgY29sdW1uOiBudW1iZXJcbiAgc291cmNlTGluZT86IHN0cmluZ1xuICBjYWxsZWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2VTdGFjayA9IChzdGFjazogc3RyaW5nKTogRnJhbWVbXSA9PiB7XG4gIGNvbnN0IGZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKVxuXG4gIGZ1bmN0aW9uIGdldFNvdXJjZUxpbmUoZmlsZTogc3RyaW5nLCBsaW5lOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGxldCBsaW5lcyA9IGZpbGVDYWNoZS5nZXQoZmlsZSlcblxuICAgIGlmICghbGluZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgbGluZXMgPSBbXVxuICAgICAgfVxuICAgICAgZmlsZUNhY2hlLnNldChmaWxlLCBsaW5lcylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXNbbGluZSAtIDFdXG4gIH1cblxuICByZXR1cm4gc3RhY2suc3BsaXQoJ1xcbicpLmZsYXRNYXAoKHN0YWNrTGluZSk6IEZyYW1lW10gPT4ge1xuICAgIGNvbnN0IG1hdGNoMSA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccytcXCgoW15cXHNdKyk6KFxcZCspOihcXGQrKVxcKSQvKVxuICAgIGNvbnN0IG1hdGNoMiA9IHN0YWNrTGluZS5tYXRjaCgvXlxccyphdFxccysoLis/KVxccysoW15cXHNdKyk6KFxcZCspOihcXGQrKSQvKVxuICAgIGNvbnN0IG1hdGNoID0gbWF0Y2gxID8/IG1hdGNoMlxuICAgIGlmICghbWF0Y2gpIHJldHVybiBbXVxuXG4gICAgY29uc3QgWywgY2FsbGVlLCBmaWxlTWF5YmVVcmwsIGxpbmVTdHIsIGNvbHVtblN0cl0gPSBtYXRjaFxuICAgIGNvbnN0IGxpbmUgPSBwYXJzZUludChsaW5lU3RyLCAxMClcbiAgICBjb25zdCBjb2x1bW4gPSBwYXJzZUludChjb2x1bW5TdHIsIDEwKVxuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVNYXliZVVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykgPyBmaWxlVVJMVG9QYXRoKGZpbGVNYXliZVVybCkgOiBmaWxlTWF5YmVVcmxcblxuICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBnZXRTb3VyY2VMaW5lKGZpbGUsIGxpbmUpXG5cbiAgICByZXR1cm4gW3sgZmlsZSwgbGluZSwgY29sdW1uLCBzb3VyY2VMaW5lLCBjYWxsZWUgfV1cbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXJyb3JFeHRyYSA9IEVycm9yICYgeyBwYXJzZWRTdGFjaz86IEZyYW1lW107IHByZWZpeD86IHN0cmluZyB9XG5cbmV4cG9ydCBjb25zdCBwcmV0dHlFcnJvclRyZWUgPSAoZXJyOiBFcnJvckV4dHJhKTogc3RyaW5nID0+IHtcbiAgY29uc3QgbGluZXMgPSBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIpXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxufVxuXG5jb25zdCBwcmV0dHlFcnJvclRyZWVMaW5lcyA9IChlcnI6IEVycm9yRXh0cmEpOiBzdHJpbmdbXSA9PiB7XG4gIGlmICghZXJyIHx8IHR5cGVvZiBlcnIgIT09ICdvYmplY3QnKSByZXR1cm4gW2Ake1N0cmluZyhlcnIpfWBdXG5cbiAgY29uc3Qgc3RhY2sgPSBlcnIucGFyc2VkU3RhY2sgPz8gKGVyci5zdGFjayA/IHBhcnNlU3RhY2soZXJyLnN0YWNrKSA6IFtdKVxuICBjb25zdCBmcmFtZXMgPSBzdGFja1xuXG4gIC8vIG5hbWUgYW5kIG1lc3NhZ2VcbiAgY29uc3QgaGVhZGVyTGluZXMgPSBbYCR7ZXJyLnByZWZpeCA/PyAnJ30ke2dyYXkoJ1snKX0ke3JlZChlcnIubmFtZSl9JHtncmF5KCddJyl9ICR7ZXJyLm1lc3NhZ2UudHJpbSgpfWBdXG5cbiAgLy8gcHJvcHNcbiAgY29uc3Qga25vd24gPSBuZXcgU2V0KFsnbmFtZScsICdtZXNzYWdlJywgJ3N0YWNrJywgJ2NhdXNlJywgJ2Vycm9ycycsICdwYXJzZWRTdGFjaycsICdwcmVmaXgnLCAnZXJyb3InLCAnc3VwcHJlc3NlZCddKVxuICBjb25zdCBwcm9wc09iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fVxuICBjb25zdCBlcnJPYmogPSBlcnIgYXMgRXJyb3IgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICBsZXQgaGFzUHJvcHMgPSBmYWxzZVxuICBjb25zdCBwcm9wTGluZXM6IHN0cmluZ1tdID0gW11cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZXJyKSkge1xuICAgIGlmIChrbm93bi5oYXMoa2V5KSkgY29udGludWVcbiAgICBwcm9wc09ialtrZXldID0gZXJyT2JqW2tleV1cbiAgICBoYXNQcm9wcyA9IHRydWVcbiAgfVxuICBpZiAoaGFzUHJvcHMpIHtcbiAgICBjb25zdCBpbnNwZWN0TGluZXMgPSB1dGlsLmluc3BlY3QocHJvcHNPYmosIHsgY29sb3JzOiB0cnVlLCBkZXB0aDogbnVsbCwgY29tcGFjdDogMTAgfSkuc3BsaXQoJ1xcbicpXG4gICAgcHJvcExpbmVzLnB1c2goZ3JheSgnUHJvcGVydGllczogJykgKyBpbnNwZWN0TGluZXNbMF0pXG4gICAgcHJvcExpbmVzLnB1c2goLi4uaW5zcGVjdExpbmVzLnNsaWNlKDEpKVxuICB9XG5cbiAgLy8gc3RhY2sgdHJhY2VcbiAgY29uc3QgbG9jID0gKGl0ZW06IEZyYW1lKSA9PiBgJHtwYXRoLnJlbGF0aXZlKHByb2Nlc3MuY3dkKCksIGl0ZW0uZmlsZSl9OiR7aXRlbS5saW5lfToke2l0ZW0uY29sdW1ufWBcbiAgY29uc3QgbG9jV2lkdGggPSBNYXRoLm1heCguLi5mcmFtZXMubWFwKGYgPT4gbG9jKGYpLmxlbmd0aCksIDApXG4gIGNvbnN0IGNhbGxlZVdpZHRoID0gTWF0aC5tYXgoLi4uZnJhbWVzLm1hcChmID0+IGYuY2FsbGVlLmxlbmd0aCksIDApXG4gIGNvbnN0IHN0eWxlOiBCcmFja2V0U3R5bGUgPSB7IG9uZTogJycsIHRvcDogJycsIG1pZDogJycsIGJvdDogJycgfVxuICBzdHlsZS50b3AgPSAn4pWt4pSA4pa2ICdcbiAgc3R5bGUubWlkID0gJ+KUnOKUgOKUgCAnXG4gIHN0eWxlLmJvdCA9ICfilbDilIDilIAgJ1xuICBzdHlsZS5vbmUgPSAnICDilrYgJ1xuICBjb25zdCBzdGFja0xpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZnJhbWUgPSBmcmFtZXNbaV1cbiAgICBjb25zdCBwYWRkZWRMb2MgPSBgJHtncmF5KGxvYyhmcmFtZSkucGFkRW5kKGxvY1dpZHRoKSl9OmBcbiAgICBjb25zdCBwYWRkZWRDYWxsZWUgPSBgJHtncmF5KGZyYW1lLmNhbGxlZS5wYWRFbmQoY2FsbGVlV2lkdGgpKX1gXG4gICAgaWYgKGZyYW1lLnNvdXJjZUxpbmUpIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBmcmFtZS5zb3VyY2VMaW5lLnRyaW0oKVxuICAgICAgY29uc3QgY29sID0gZnJhbWUuY29sdW1uIC0gKGZyYW1lLnNvdXJjZUxpbmUubGVuZ3RoIC0gZnJhbWUuc291cmNlTGluZS50cmltU3RhcnQoKS5sZW5ndGgpXG4gICAgICBjb25zdCBiZWZvcmUgPSBsaW5lLnNsaWNlKDAsIGNvbCAtIDEpXG4gICAgICBjb25zdCB3b3JkID0gbGluZS5zbGljZShjb2wgLSAxKS5tYXRjaCgvXihcXHcrfFxcKCkvKT8uWzBdID8/ICcnXG4gICAgICBjb25zdCBhZnRlciA9IGxpbmUuc2xpY2UoY29sIC0gMSArIHdvcmQubGVuZ3RoKVxuICAgICAgY29uc3QgbGluZUNvbG9yZWQgPSBgJHtncmF5KGJlZm9yZSl9JHt5ZWxsb3cod29yZCl9JHtncmF5KGFmdGVyKX1gXG4gICAgICBzdGFja0xpbmVzLnB1c2goYCR7Z3JheSgnYXQnKX0gJHtwYWRkZWRDYWxsZWV9ICR7cGFkZGVkTG9jfSAke2xpbmVDb2xvcmVkfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YWNrTGluZXMucHVzaChgJHtncmF5KCdhdCcpfSAke3BhZGRlZENhbGxlZX0gJHtwYWRkZWRMb2N9ICR7Z3JheSgnLy8gc291cmNlIG5vdCBhdmFpbGFibGUnKX1gKVxuICAgIH1cbiAgfVxuICBicmFja2V0KHN0YWNrTGluZXMsIHN0eWxlLCBncmF5KVxuXG4gIGNvbnN0IHByaW50SW5uZXIgPSAoZXJyb3JzOiBFcnJvcltdKTogc3RyaW5nW10gPT4ge1xuICAgIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbm5lckVyciA9IGVycm9yc1tpXVxuICAgICAgb3V0LnB1c2gocmVkKCfilIInKSlcbiAgICAgIGNvbnN0IGlubmVyID0gcHJldHR5RXJyb3JUcmVlTGluZXMoaW5uZXJFcnIpXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGlubmVyLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChmYWxzZSkgY29udGludWVcbiAgICAgICAgZWxzZSBpZiAoaSA8IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilJzilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPCBlcnJvcnMubGVuZ3RoIC0gMSAmJiBqID4gMCkgaW5uZXJbal0gPSByZWQoYOKUgiBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPT09IDApIGlubmVyW2pdID0gcmVkKGDilbDilIBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgaWYgKGkgPT09IGVycm9ycy5sZW5ndGggLSAxICYmIGogPiAwKSBpbm5lcltqXSA9IHJlZChgICBgKSArIGlubmVyW2pdXG4gICAgICAgIGVsc2UgY29udGludWVcbiAgICAgIH1cbiAgICAgIG91dC5wdXNoKC4uLmlubmVyKVxuICAgIH1cbiAgICByZXR1cm4gb3V0XG4gIH1cblxuICBjb25zdCBpbm5lckVycm9yTGluZXM6IHN0cmluZ1tdID0gW11cblxuICAvLyBBZ2dyZWdhdGVFcnJvclxuICBpZiAoZXJyIGluc3RhbmNlb2YgQWdncmVnYXRlRXJyb3IgJiYgQXJyYXkuaXNBcnJheShlcnIuZXJyb3JzKSkge1xuICAgIGlubmVyRXJyb3JMaW5lcy5wdXNoKC4uLnByaW50SW5uZXIoZXJyLmVycm9ycykpXG4gIH1cblxuICAvLyBTdXBwcmVzc2VkRXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFN1cHByZXNzZWRFcnJvcikge1xuICAgIDsoZXJyLmVycm9yIGFzIEVycm9yRXh0cmEpLnByZWZpeCA9ICdTdXBwcmVzc2VkIGJ5ICdcbiAgICA7KGVyci5zdXBwcmVzc2VkIGFzIEVycm9yRXh0cmEpLnByZWZpeCA9ICdTdXBwcmVzc2VkICdcbiAgICBpbm5lckVycm9yTGluZXMucHVzaCguLi5wcmludElubmVyKFtlcnIuZXJyb3IsIGVyci5zdXBwcmVzc2VkXSkpXG4gIH1cblxuICAvLyBjYXVzZVxuICBjb25zdCBjYXVzZUxpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIGlmIChlcnIuY2F1c2UpIHtcbiAgICBjYXVzZUxpbmVzLnB1c2gobWFnZW50YSgn4pSCJykpXG4gICAgY29uc3QgY2F1c2U6IHN0cmluZ1tdID0gKCgpID0+IHtcbiAgICAgIGlmIChlcnIuY2F1c2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICA7KGVyci5jYXVzZSBhcyBFcnJvckV4dHJhKS5wcmVmaXggPSAnQ2F1c2VkIGJ5OiAnXG4gICAgICAgIHJldHVybiBwcmV0dHlFcnJvclRyZWVMaW5lcyhlcnIuY2F1c2UpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW2BDYXVzZWQgYnk6ICR7U3RyaW5nKGVyci5jYXVzZSl9YF1cbiAgICAgIH1cbiAgICB9KSgpXG4gICAgY2F1c2VMaW5lcy5wdXNoKC4uLmNhdXNlKVxuICB9XG5cbiAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdXG4gIG91dC5wdXNoKC4uLmhlYWRlckxpbmVzKVxuICBpZiAocHJvcExpbmVzLmxlbmd0aCA+IDApIG91dC5wdXNoKCcnKVxuICBvdXQucHVzaCguLi5wcm9wTGluZXMpXG4gIGlmIChzdGFja0xpbmVzLmxlbmd0aCA+IDApIG91dC5wdXNoKCcnKVxuICBvdXQucHVzaCguLi5zdGFja0xpbmVzKVxuICBmb3IgKGxldCBpID0gMTsgaSA8IG91dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChpbm5lckVycm9yTGluZXMubGVuZ3RoID4gMCkgb3V0W2ldID0gcmVkKCfilIIgJykgKyBvdXRbaV1cbiAgICBlbHNlIG91dFtpXSA9ICcgICcgKyBvdXRbaV1cbiAgfVxuICBvdXQucHVzaCguLi5pbm5lckVycm9yTGluZXMpXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNhdXNlTGluZXMubGVuZ3RoID4gMCkgb3V0W2ldID0gbWFnZW50YSgn4pSCICcpICsgb3V0W2ldXG4gICAgZWxzZSBvdXRbaV0gPSAnICAnICsgb3V0W2ldXG4gIH1cbiAgb3V0LnB1c2goLi4uY2F1c2VMaW5lcylcbiAgcmV0dXJuIG91dFxufVxuIl0sIm1hcHBpbmdzIjoiOzs7OztBQU1BLE1BQWEsK0JBQStCO0NBQzFDLE1BQU0sS0FBSyxRQUFhO0FBQ3RCLFVBQVEsTUFBTSxnQkFBZ0IsSUFBSSxDQUFDO0FBQ25DLFVBQVEsS0FBSyxFQUFFOztBQUdqQixTQUFRLEdBQUcscUJBQXFCLEVBQUU7QUFDbEMsU0FBUSxHQUFHLHNCQUFzQixFQUFFOztBQUtyQyxNQUFNLFdBQVcsS0FBZSxPQUFxQixVQUEyQztBQUM5RixNQUFLLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxRQUFRLElBQzlCLEtBQUksTUFBTSxLQUFLLE1BQU0sSUFBSSxTQUFTLEVBQUcsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtVQUM1RCxNQUFNLEVBQUcsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtVQUN6QyxNQUFNLElBQUksU0FBUyxFQUFHLEtBQUksS0FBSyxNQUFNLE1BQU0sSUFBSSxHQUFHLElBQUk7S0FDMUQsS0FBSSxLQUFLLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSTtBQUd2QyxRQUFPOztBQUdULE1BQU0sUUFBUSxNQUFjLFdBQVcsRUFBRTtBQUN6QyxNQUFNLE9BQU8sTUFBYyxXQUFXLEVBQUU7QUFDeEMsTUFBTSxVQUFVLE1BQWMsV0FBVyxFQUFFO0FBRTNDLE1BQU0sV0FBVyxNQUFjLFdBQVcsRUFBRTtBQVk1QyxNQUFhLGNBQWMsVUFBMkI7Q0FDcEQsTUFBTSw0QkFBWSxJQUFJLEtBQXVCO0NBRTdDLFNBQVMsY0FBYyxNQUFjLE1BQWtDO0VBQ3JFLElBQUksUUFBUSxVQUFVLElBQUksS0FBSztBQUUv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