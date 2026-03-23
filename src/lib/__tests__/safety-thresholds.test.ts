import { describe, it, expect } from "vitest";
import {
  PERSON_DANGER_THRESHOLD,
  PERSON_CAUTION_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  getPersonSafetyLevel,
} from "../safety-thresholds";

describe("safety-thresholds", () => {
  it("exports correct threshold values", () => {
    expect(PERSON_DANGER_THRESHOLD).toBe(0.6);
    expect(PERSON_CAUTION_THRESHOLD).toBe(0.3);
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.5);
  });

  describe("getPersonSafetyLevel", () => {
    it("returns danger for bbox height > 0.6", () => {
      expect(getPersonSafetyLevel(0.7)).toBe("danger");
      expect(getPersonSafetyLevel(0.61)).toBe("danger");
      expect(getPersonSafetyLevel(1.0)).toBe("danger");
    });

    it("returns caution for bbox height > 0.3 and <= 0.6", () => {
      expect(getPersonSafetyLevel(0.4)).toBe("caution");
      expect(getPersonSafetyLevel(0.31)).toBe("caution");
      expect(getPersonSafetyLevel(0.6)).toBe("caution");
    });

    it("returns safe for bbox height <= 0.3", () => {
      expect(getPersonSafetyLevel(0.3)).toBe("safe");
      expect(getPersonSafetyLevel(0.1)).toBe("safe");
      expect(getPersonSafetyLevel(0.0)).toBe("safe");
    });
  });
});
