import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeManualInputs,
  normalizeRosterRows,
} from "../dist/packages/roster-import/src/index.js";

const importedAt = "2026-05-11T00:00:00.000Z";

test("normalizeRosterRows trims fields and lowercases email", () => {
  const result = normalizeRosterRows(
    [
      {
        name: "  홍길동  ",
        email: " HONG@example.COM ",
        department: "  이벤트 팀 ",
        appliedAsset: "  상품 A ",
        submittedAt: " 2026-05-10T12:00:00.000Z ",
      },
    ],
    { importedAt },
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.participants.length, 1);
  assert.deepEqual(result.participants[0], {
    id: "email:hong-example-com",
    inputSource: "excel",
    name: "홍길동",
    email: "hong@example.com",
    department: "이벤트 팀",
    appliedAsset: "상품 A",
    submittedAt: "2026-05-10T12:00:00.000Z",
  });
});

test("normalizeManualInputs uses importedAt as submittedAt", () => {
  const result = normalizeManualInputs(
    [{ name: "김민수", department: "운영팀" }],
    { importedAt },
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.participants[0], {
    id: "participant:김민수-운영팀-1",
    inputSource: "manual",
    name: "김민수",
    department: "운영팀",
    submittedAt: importedAt,
  });
});

test("normalizers report blank participant names", () => {
  const result = normalizeManualInputs(
    [{ name: " " }, { name: "이서연" }],
    { importedAt },
  );

  assert.deepEqual(result.errors, [
    {
      index: 0,
      field: "name",
      message: "Participant name is required.",
    },
  ]);
  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].name, "이서연");
});

test("normalizers report duplicate emails before raffle execution", () => {
  const result = normalizeRosterRows(
    [
      {
        name: "김민수",
        email: "DUPLICATE@example.com",
      },
      {
        name: "이서연",
        email: " duplicate@example.com ",
      },
    ],
    { importedAt },
  );

  assert.deepEqual(result.errors, [
    {
      index: 1,
      field: "email",
      message: "Duplicate participant email: duplicate@example.com",
    },
  ]);
  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].email, "duplicate@example.com");
});
