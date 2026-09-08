import assert from "node:assert/strict";
import { test } from "node:test";

import { parseQuestions } from "./parse-paper.ts";

test("splits a numbered paper into questions and drops the numbers", () => {
  const got = parseQuestions([
    "1. State the Cauchy-Riemann equations.",
    "2. Find dy/dx if y = x^3 + 2x.",
  ]);

  assert.deepEqual(got, [
    "State the Cauchy-Riemann equations.",
    "Find dy/dx if y = x^3 + 2x.",
  ]);
});

test("drops the preamble before the first question", () => {
  const got = parseQuestions([
    "FEDERAL UNIVERSITY OF TECHNOLOGY, AKURE",
    "Department of Computer Science",
    "Time allowed: 3 hours",
    "Answer ALL questions",
    "1. Define an operating system.",
  ]);

  assert.deepEqual(got, ["Define an operating system."]);
});

test("joins lines that wrap", () => {
  const got = parseQuestions([
    "1. Explain, with the aid of a suitable diagram,",
    "the operation of a half-wave rectifier.",
  ]);

  assert.equal(
    got[0],
    "Explain, with the aid of a suitable diagram, the operation of a half-wave rectifier."
  );
});

test("keeps sub-parts with their parent question", () => {
  const got = parseQuestions([
    "3. Consider the circuit in Figure 1.",
    "(a) Find the total resistance.",
    "(b) Find the current through R2.",
  ]);

  assert.equal(got.length, 1);
  assert.match(got[0], /total resistance/);
  assert.match(got[0], /current through R2/);
});

test("recognises Q-prefixed and bracketed numbering", () => {
  const got = parseQuestions([
    "Q1 What is a binary search tree?",
    "(2) Define time complexity.",
    "Question 3: State Ohm's law.",
  ]);

  assert.deepEqual(got, [
    "What is a binary search tree?",
    "Define time complexity.",
    "State Ohm's law.",
  ]);
});

test("discards page furniture inside a question", () => {
  const got = parseQuestions([
    "1. Derive the quadratic formula.",
    "Page 2",
    "Turn over",
    "Show all working.",
  ]);

  assert.equal(got[0], "Derive the quadratic formula. Show all working.");
});

test("drops fragments too short to revise", () => {
  assert.deepEqual(parseQuestions(["1. Why?", "2. Explain the halting problem."]), [
    "Explain the halting problem.",
  ]);
});

test("returns nothing for a page with no numbering", () => {
  assert.deepEqual(parseQuestions(["some scanned prose", "with no question numbers"]), []);
});
