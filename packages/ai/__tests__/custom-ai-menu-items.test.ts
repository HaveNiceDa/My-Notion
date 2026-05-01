import { describe, it, expect } from "vitest";
import {
  CUSTOM_AI_MENU_ITEMS,
  getCustomItemsForContext,
  resolveLocale,
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
        expect(item.icon).toBeTruthy();
        expect(item.prompt).toBeTruthy();
        expect(typeof item.requiresSelection).toBe("boolean");
        expect(typeof item.autoSubmit).toBe("boolean");
        expect(item.title).toBeTypeOf("object");
        expect(item.title.en).toBeTruthy();
        expect(item.subtext).toBeTypeOf("object");
        expect(item.subtext.en).toBeTruthy();
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

    it("all items have autoSubmit enabled", () => {
      CUSTOM_AI_MENU_ITEMS.forEach((item) => {
        expect(item.autoSubmit).toBe(true);
      });
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

  describe("resolveLocale", () => {
    it("returns exact match for supported locale", () => {
      expect(resolveLocale("en")).toBe("en");
      expect(resolveLocale("zh-CN")).toBe("zh-CN");
      expect(resolveLocale("zh-TW")).toBe("zh-TW");
    });

    it("falls back to zh-CN for zh-* variants", () => {
      expect(resolveLocale("zh")).toBe("zh-CN");
      expect(resolveLocale("zh-HK")).toBe("zh-CN");
      expect(resolveLocale("zh-SG")).toBe("zh-CN");
    });

    it("falls back to en for unsupported locales", () => {
      expect(resolveLocale("ja")).toBe("en");
      expect(resolveLocale("ko")).toBe("en");
      expect(resolveLocale("fr")).toBe("en");
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

    it("resolves titles to English by default", () => {
      const items = getCustomItemsForContext(true);
      const translateItem = items.find((i) => i.key === "translate-to-en");
      expect(translateItem!.resolvedTitle).toBe("Translate to English");
      expect(translateItem!.resolvedSubtext).toBe(
        "Translate selected text to English",
      );
    });

    it("resolves titles to zh-CN", () => {
      const items = getCustomItemsForContext(true, "zh-CN");
      const translateItem = items.find((i) => i.key === "translate-to-en");
      expect(translateItem!.resolvedTitle).toBe("翻译为英文");
      expect(translateItem!.resolvedSubtext).toBe("将选中文本翻译为英文");
    });

    it("resolves titles to zh-TW", () => {
      const items = getCustomItemsForContext(true, "zh-TW");
      const translateItem = items.find((i) => i.key === "translate-to-en");
      expect(translateItem!.resolvedTitle).toBe("翻譯為英文");
      expect(translateItem!.resolvedSubtext).toBe("將選中翻譯為英文");
    });

    it("falls back to English for unsupported locale", () => {
      const items = getCustomItemsForContext(true, "ja");
      const translateItem = items.find((i) => i.key === "translate-to-en");
      expect(translateItem!.resolvedTitle).toBe("Translate to English");
    });

    it("returns items with valid prompts", () => {
      const items = getCustomItemsForContext(true);
      items.forEach((item) => {
        expect(item.prompt.length).toBeGreaterThan(10);
      });
    });

    it("includes autoSubmit flag in returned items", () => {
      const items = getCustomItemsForContext(true);
      items.forEach((item) => {
        expect(item.autoSubmit).toBe(true);
      });
    });

    it("all items have resolvedTitle and resolvedSubtext", () => {
      const items = getCustomItemsForContext(true, "zh-CN");
      items.forEach((item) => {
        expect(item.resolvedTitle).toBeTruthy();
        expect(item.resolvedSubtext).toBeTruthy();
      });
    });
  });
});
