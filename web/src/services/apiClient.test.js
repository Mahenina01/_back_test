import { describe, expect, it } from "vitest";
import { normalizeReading } from "./apiClient";

describe("normalizeReading", () => {
  it("treats readings without an explicit healthy sensor flag as unavailable", () => {
    const reading = normalizeReading({ temperature: 0, humidity: 0 });

    expect(reading.sensor_fault).toBe(true);
    expect(reading.defaut_sonde).toBe(true);
  });

  it("accepts readings only when the sensor explicitly reports healthy", () => {
    const reading = normalizeReading({
      temperature: 37.5,
      humidity: 55,
      sensor_fault: false,
    });

    expect(reading.sensor_fault).toBe(false);
    expect(reading.defaut_sonde).toBe(false);
  });
});
