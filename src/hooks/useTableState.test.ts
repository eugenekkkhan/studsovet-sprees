import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTableState } from "./useTableState";

const defaultSort = [{ key: "rating", direction: "desc" as const }];
const setUrl = (query: string) => window.history.replaceState(null, "", `/rating${query}`);

beforeEach(() => {
  localStorage.clear();
  setUrl("");
});

describe("состояние таблицы", () => {
  it("пишет отбор в адрес, чтобы ссылкой можно было поделиться", () => {
    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    act(() => result.current.setSearch("аня"));

    expect(new URLSearchParams(window.location.search).get("rating.q")).toBe("аня");
  });

  it("читает адрес вперёд localStorage: ссылка важнее прошлого сеанса", () => {
    localStorage.setItem("sprees:rating:state", JSON.stringify({ search: "из памяти", filters: {}, sort: [] }));
    setUrl("?rating.q=из+ссылки");

    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    expect(result.current.search).toBe("из ссылки");
  });

  it("подхватывает прошлый сеанс, когда в адресе ничего нет", () => {
    localStorage.setItem("sprees:rating:state", JSON.stringify({ search: "из памяти", filters: {}, sort: [] }));

    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    expect(result.current.search).toBe("из памяти");
  });

  it("убирает пустые значения из адреса, а не пишет пустые ключи", () => {
    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    act(() => result.current.setSearch("аня"));
    act(() => result.current.setSearch(""));

    expect(window.location.search).not.toContain("rating.q");
  });

  it("сохраняет и возвращает именованный набор", () => {
    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    act(() => result.current.setSearch("первокурсники"));
    act(() => result.current.saveView("ФКН, первый курс"));
    act(() => result.current.reset());

    expect(result.current.search).toBe("");

    act(() => result.current.applyView(result.current.views[0]));

    expect(result.current.search).toBe("первокурсники");
  });

  it("возвращает сортировку по умолчанию при сбросе", () => {
    const { result } = renderHook(() => useTableState({ name: "rating", defaultSort }));

    act(() => result.current.setSort([{ key: "name", direction: "asc" }]));
    act(() => result.current.reset());

    expect(result.current.sort).toEqual(defaultSort);
  });
});
