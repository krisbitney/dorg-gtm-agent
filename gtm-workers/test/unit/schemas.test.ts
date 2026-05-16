import { test, expect, describe } from "bun:test";
import { queuePayloadSchema } from "../../src/schemas/queue-payload-schema.js";
import { deadLetterPayloadSchema } from "../test-utils/dead-letter-payload-schema.js";
import { dorgClaimResponseSchema } from "../test-utils/dorg-claim-response-schema.js";

describe("Schemas", () => {
  describe("queuePayloadSchema", () => {
    test("should validate a valid queue payload", () => {
      const validPayload = {
        id: "72175949-8c67-463d-82b4-53906263884d",
        platform: "reddit",
      };
      const result = queuePayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe("deadLetterPayloadSchema", () => {
    test("should validate a valid DLQ payload", () => {
      const validDLQ = {
        id: "post1",
        platform: "reddit",
        stage: "processing",
        errorMessage: "error",
        failedAt: "2024-03-21T12:00:00.000Z",
        originalPayload: '{"id":"post1"}',
      };
      const result = deadLetterPayloadSchema.safeParse(validDLQ);
      expect(result.success).toBe(true);
    });
  });

  describe("dorgClaimResponseSchema", () => {
    test("should validate a valid claim response", () => {
      const validResponse = {
        lead_id: "lead1",
      };
      const result = dorgClaimResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });
});
