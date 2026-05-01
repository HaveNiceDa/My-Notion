import { describe, it, expect } from "vitest";
import {
  CUSTOM_AI_MENU_ITEMS,
  getCustomItemsForContext,
  type CustomAIMenuItemDef,
} from "../utils/custom-ai-menu-items";

describe("custom-ai-menu-items", () => {
  describe("CUSTOM_AI_MENU_ITEMS", () => {
    it("has 8 items total", () => {
      expect(CUSTOM_AI_MENU_ITEMS).toHaveLength(8);
    });

    it("every item has required fields", () => {
      CUSTOM_AI_MENU_ITEMS.forEach((item) => {
        expect(item.key).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.subtext).toBeTruthy();
        expect(item.prompt).toBeTruthy();
        expect(item.icon).toBeTruthy();
        expect(typeof item.requiresSelection).toBe("boolean");
      });
    });

    it("all keys are unique", () => {
      const keys = CUSTOM_AI_MENU_ITEMS.map((item) => item.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("has 5 selection-only items", () => {
      const selectionItems = CUSTOM_AI_MENU_ITEMS.filter(
        (item) => item.requiresSelection,
      );
      expect(selectionItems).toHaveLength(5);
    });

    it("has 3 cursor-only items", () => {
      const cursorItems = CUSTOM_AI_MENU_ITEMS.filter(
        (item) => !item.requiresSelection,
      );
      expect(cursorItems).toHaveLength(3);
    });

    const SELECTION_KEYS = [
      "translate-to-en",
      "translate-to-zh",
      "improve-writing",
      "make-shorter",
      "make-longer",
    ];

    SELECTION_KEYS.forEach((key) => {
      it(`includes selection item "${key}"`, () => {
        const found = CUSTOM_AI_MENU_ITEMS.find((item) => item.key === key);
        expect(found).toBeDefined();
        expect(found!.requiresSelection).toBe(true);
      });
    });

    const CURSOR_KEYS = [
      "generate-outline",
      "continue-writing",
      "summarize-above",
    ];

    CURSOR_KEYS.forEach((key) => {
      it(`includes cursor item "${key}"`, () => {
        const found = CUSTOM_AI_MENU_ITEMS.find((item) => item.key === key);
        expect(found).toBeDefined();
        expect(found!.requiresSelection).toBe(false);
      });
    });
  });

  describe("getCustomItemsForContext", () => {
    it("returns only selection items when hasSelection is true", () => {
      const items = getCustomItemsForContext(true);
      expect(items).toHaveLength(5);
      items.forEach((item) => {
        expect(item.requiresSelection).toBe(true);
      });
    });

    it("returns only cursor items when hasSelection is false", () => {
      const items = getCustomItemsForContext(false);
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.requiresSelection).toBe(false);
      });
    });

    it("returns items with valid prompts", () => {
      const items = getCustomItemsForContext(true);
      items.forEach((item) => {
        expect(item.prompt.length).toBeGreaterThan(10);
      });
    });
  });
});
