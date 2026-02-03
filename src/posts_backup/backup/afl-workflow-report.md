---
title: "AFL++ Fuzzing Workflow"
date: "2026-01-26"
excerpt: "A breakdown of the standard fuzzing loop."
---

Fuzzing is a loop: **Instrument -> Fuzz -> Crash -> Triage**. Here is a breakdown of a standard session using AFL++.

## 1. Instrumentation

We compile the target using AFL's compiler wrappers (like `afl-gcc` or `afl-clang-lto`). This injects "trampolines" or coverage counters into every basic block of the code.

![Build Output](/images/posts/fuzz-report/build-output.png)
*(Note: Ensure you include debug symbols `-g` for easier analysis later.)*

## 2. Invocation

We launch `afl-fuzz` with a seed corpus. The fuzzer:
1.  Binds to a free CPU core.
2.  Performs a "dry run" to verify the corpus works.
3.  Starts the "havoc" stage, mutating bits and bytes.

## 3. The Dashboard

The UI shows us:
*   **Process Timing**: Speed (execs/sec).
*   **Stage Progress**: Current mutation strategy.
*   **Findings**: Number of unique crashes and hangs.

## 4. Crash Detection

When a crash is found (`SIGSEGV`, `SIGABRT`), AFL++ saves the input file causing it.

If we compiled with **Sanitizers** (like ASan or UBSan), the crashes are even clearer. The sanitizer prints a detailed error report (e.g., "Stack-buffer-overflow") before the program dies, giving us an immediate clue about the vulnerability type.
