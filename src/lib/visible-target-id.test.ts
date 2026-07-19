import assert from "node:assert/strict";
import test from "node:test";

import { visibleTargetId } from "./visible-target-id.ts";

test("keeps the selected id when it is still visible", () => {
  assert.equal(visibleTargetId("proj-a", ["proj-a", "proj-b"]), "proj-a");
});

test("clears the selected id when the filter hides it", () => {
  assert.equal(visibleTargetId("proj-a", ["proj-b"]), "");
});

test("clears the selected id when no options match", () => {
  assert.equal(visibleTargetId("proj-a", []), "");
});

test("keeps an empty selection empty", () => {
  assert.equal(visibleTargetId("", ["proj-a"]), "");
});
