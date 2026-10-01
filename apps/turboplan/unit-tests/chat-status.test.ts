import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getToolErrorMessage,
  isChatBusy,
  isToolPartInterrupted,
} from "../lib/chat-status.js";

describe("isChatBusy", () => {
  it("is busy only while a request is in flight", () => {
    assert.equal(isChatBusy("submitted"), true);
    assert.equal(isChatBusy("streaming"), true);
  });

  it("lets the user send again after a finished or failed reply", () => {
    assert.equal(isChatBusy("ready"), false);
    assert.equal(isChatBusy("error"), false);
    assert.equal(isChatBusy(undefined), false);
  });
});

describe("isToolPartInterrupted", () => {
  it("treats pending tool parts as interrupted once the message stops loading", () => {
    assert.equal(isToolPartInterrupted("input-streaming", false), true);
    assert.equal(isToolPartInterrupted("input-available", false), true);
  });

  it("leaves pending tool parts alone while the message is still streaming", () => {
    assert.equal(isToolPartInterrupted("input-streaming", true), false);
    assert.equal(isToolPartInterrupted("input-available", true), false);
  });

  it("never flags settled tool parts", () => {
    assert.equal(isToolPartInterrupted("output-available", false), false);
    assert.equal(isToolPartInterrupted("output-error", false), false);
  });
});

describe("getToolErrorMessage", () => {
  it("names known tools in plain language", () => {
    assert.equal(
      getToolErrorMessage("createDocument"),
      "Couldn't finish creating the document. Try again.",
    );
  });

  it("falls back to a generic label for unknown tools", () => {
    assert.equal(
      getToolErrorMessage("someNewTool"),
      "Couldn't finish this step. Try again.",
    );
  });
});
