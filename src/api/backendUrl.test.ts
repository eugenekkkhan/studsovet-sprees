import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
/** Единственное место, которому положено знать, как собирается адрес сервера. */
const OWNER = join(SOURCE_ROOT, "api", "backendUrl.ts");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

/**
 * «Поле чудес» однажды уже собирало адрес само и прибивало порт 3000 намертво.
 * В разработке это незаметно — там порт и правда другой, — а в собранном
 * приложении фронт отдаёт сам сервер, и игра стучалась в никуда. Квиз при этом
 * работал, потому что брал адрес из общего модуля. Копия разошлась с оригиналом,
 * и починка одного не чинила другое; тест держит их вместе.
 */
describe("адрес игрового сервера", () => {
  const offenders = sourceFiles(SOURCE_ROOT).filter(
    (path) =>
      path !== OWNER && readFileSync(path, "utf8").includes("VITE_BACKEND_URL"),
  );

  it("собирается ровно в одном модуле", () => {
    expect(offenders).toEqual([]);
  });

  it("в сборке ведёт на собственный адрес страницы, а не на порт 3000", () => {
    const source = readFileSync(OWNER, "utf8");
    expect(source).toContain("import.meta.env.DEV");
    expect(source).toContain("window.location.origin");
  });
});
