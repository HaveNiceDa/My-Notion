import { describe, it, expect } from "vitest";
import {
  AI_MODELS,
  DEFAULT_MODEL,
  MODEL_ID_MAPPING,
  MODEL_DISPLAY_NAMES,
  MODELS_CONFIG,
  getActualModelId,
  EMB_MODEL,
} from "../config/model";

describe("AI config", () => {
  describe("AI_MODELS", () => {
    it("contains at least one model", () => {
      expect(AI_MODELS.length).toBeGreaterThan(0);
    });

    it("all models are strings", () => {
      AI_MODELS.forEach((model) => {
        expect(typeof model).toBe("string");
      });
    });
  });

  describe("DEFAULT_MODEL", () => {
    it("is one of AI_MODELS", () => {
      expect(AI_MODELS).toContain(DEFAULT_MODEL);
    });
  });

  describe("MODEL_ID_MAPPING", () => {
    it("maps every AIModel to a non-empty string", () => {
      AI_MODELS.forEach((model) => {
        expect(MODEL_ID_MAPPING[model]).toBeTruthy();
        expect(typeof MODEL_ID_MAPPING[model]).toBe("string");
      });
    });
  });

  describe("MODEL_DISPLAY_NAMES", () => {
    it("provides display name for every model", () => {
      AI_MODELS.forEach((model) => {
        expect(MODEL_DISPLAY_NAMES[model]).toBeTruthy();
      });
    });
  });

  describe("getActualModelId", () => {
    it("returns correct mapping for each model", () => {
      AI_MODELS.forEach((model) => {
        expect(getActualModelId(model)).toBe(MODEL_ID_MAPPING[model]);
      });
    });
  });

  describe("MODELS_CONFIG", () => {
    it("has config for every model", () => {
      const configIds = MODELS_CONFIG.map((c) => c.id);
      AI_MODELS.forEach((model) => {
        expect(configIds).toContain(model);
      });
    });

    it("every config has required fields", () => {
      MODELS_CONFIG.forEach((config) => {
        expect(config.id).toBeTruthy();
        expect(config.actualModelId).toBeTruthy();
        expect(config.displayName).toBeTruthy();
        expect(typeof config.enabled).toBe("boolean");
      });
    });
  });

  describe("EMB_MODEL", () => {
    it("is a non-empty string", () => {
      expect(EMB_MODEL).toBeTruthy();
      expect(typeof EMB_MODEL).toBe("string");
    });
  });
});
