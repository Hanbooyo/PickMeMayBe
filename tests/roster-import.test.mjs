import test from "node:test";
import assert from "node:assert/strict";

import {
  addManualInputRow,
  createEmptyManualInput,
  normalizeManualInputs,
  normalizeRosterRows,
  parseRosterText,
  removeManualInputRow,
  updateManualInputRow,
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

test("parseRosterText parses tab separated Excel paste data", () => {
  assert.deepEqual(
    parseRosterText(
      [
        "이름\t이메일\t부서\t응모자산\t입력시간",
        "김민수\tMINSU@example.com\t운영팀\t상품 A\t2026-05-11T00:00:00.000Z",
        "이서연\tseoyeon@example.com\t마케팅팀\t상품 B\t2026-05-11T00:01:00.000Z",
      ].join("\n"),
    ),
    [
      {
        name: "김민수",
        email: "MINSU@example.com",
        department: "운영팀",
        appliedAsset: "상품 A",
        submittedAt: "2026-05-11T00:00:00.000Z",
      },
      {
        name: "이서연",
        email: "seoyeon@example.com",
        department: "마케팅팀",
        appliedAsset: "상품 B",
        submittedAt: "2026-05-11T00:01:00.000Z",
      },
    ],
  );
});

test("parseRosterText parses comma separated data", () => {
  assert.deepEqual(parseRosterText("name,email\nAlpha,alpha@example.com"), [
    {
      name: "Alpha",
      email: "alpha@example.com",
    },
  ]);
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

test("manual input helpers add update and remove rows immutably", () => {
  const initial = [createEmptyManualInput()];
  const added = addManualInputRow(initial);
  const updated = updateManualInputRow(added, 0, {
    name: "김민수",
    email: "minsu@example.com",
    department: "운영팀",
    appliedAsset: "상품 A",
  });
  const removed = removeManualInputRow(updated, 1);

  assert.deepEqual(initial, [{ name: "" }]);
  assert.deepEqual(added, [{ name: "" }, { name: "" }]);
  assert.deepEqual(removed, [
    {
      name: "김민수",
      email: "minsu@example.com",
      department: "운영팀",
      appliedAsset: "상품 A",
    },
  ]);
});

test("manual input helpers reject invalid row indexes", () => {
  assert.throws(
    () => updateManualInputRow([createEmptyManualInput()], 1, { name: "김민수" }),
    /out of range/,
  );
  assert.throws(
    () => removeManualInputRow([createEmptyManualInput()], -1),
    /out of range/,
  );
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
