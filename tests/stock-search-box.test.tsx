import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StockSearchBox } from "../src/App";

describe("stock selector click target", () => {
  it("reopens from the full field even when the input is already focused", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSelect = vi.fn();

    render(
      <StockSearchBox
        value="600900 · 长江电力"
        selectedCode="600900"
        options={[
          ["600900", "长江电力"],
          ["600025", "华能水电"],
        ]}
        industryLabel="水电"
        onValueChange={onValueChange}
        onSelect={onSelect}
      />,
    );

    const field = screen.getByRole("combobox", { name: "搜索水电股票" });
    await user.click(field);
    expect(screen.getByRole("listbox", { name: "水电股票列表" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /华能水电/ }));
    expect(onSelect).toHaveBeenCalledWith("600025");
    expect(screen.queryByRole("listbox", { name: "水电股票列表" })).not.toBeInTheDocument();
    expect(field).toHaveFocus();

    await user.click(field);
    expect(screen.getByRole("listbox", { name: "水电股票列表" })).toBeInTheDocument();

    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.pointerDown(field.parentElement!);
    expect(field).toHaveFocus();
    expect(screen.getByRole("listbox", { name: "水电股票列表" })).toBeInTheDocument();
  });
});
