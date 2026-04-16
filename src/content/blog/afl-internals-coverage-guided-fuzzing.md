---
title: "AFL++ Internals: Coverage-Guided Fuzzing from First Principles"
description: "A deep technical walkthrough of how AFL++ instruments binaries, drives mutations, and finds memory safety bugs: from the feedback loop to the bitmap to crash triage."
date: 2026-03-17
tags: ["fuzzing", "security", "afl++", "binary-analysis"]
---

<style>
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

.afl-fig {
 font-family: 'EB Garamond', Georgia, serif;
 background: #fafaf8;
 border: 1px solid #c8c4b8;
 border-radius: 3px;
 padding: 28px 32px 20px;
 margin: 2em 0;
 overflow-x: auto;
 box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.afl-fig svg {
 display: block;
 margin: 0 auto;
 max-width: 100%;
 height: auto;
}
.afl-fig-caption {
 font-family: 'EB Garamond', Georgia, serif;
 font-size: 12px;
 color: #6b6860;
 text-align: center;
 margin-top: 10px;
 font-style: italic;
 letter-spacing: .01em;
}
</style>

# AFL++ Internals

## Coverage-Guided Fuzzing from First Principles

---

## TL;DR

AFL++ instruments your binary at compile time to track which code paths each input takes. It mutates inputs that reach new paths, drops the ones that don't, and repeats at 4,000+ executions per second. That feedback loop is why it finds heap overflows and use-after-frees buried hundreds of functions deep while your test suite misses them entirely.

The short version of how to use it well: build with `afl-clang-fast`, use ASan, write small valid seeds, add a dictionary for format tokens, run in persistent mode, and parallelize across all your cores with mixed power schedules. Everything in this post is the explanation for why those steps matter.

---

## Table of Contents

1. [What AFL++ Is](#1-what-afl-is): the feedback loop, why it works, fuzzer taxonomy
2. [Instrumentation](#2-instrumentation): how LLVM hooks get injected, edge XOR, CMPLOG
3. [The 64KB Coverage Bitmap](#3-the-64kb-coverage-bitmap): shared memory, virgin_bits, the bucket system
4. [Mutation Stages](#4-mutation-stages): bit flips, arithmetics, havoc, splice, stagnation ratchet, custom mutators
5. [Forkserver and Persistent Mode](#5-forkserver-and-persistent-mode): COW, deferred fork, \_\_AFL_LOOP, state reset problems
6. [Corpus Scoring and Energy](#6-corpus-scoring-and-energy): favoured set, power schedules, afl-cmin, afl-tmin
7. [AddressSanitizer](#7-addresssanitizer): shadow memory, red zones, quarantine, reading reports
8. [Crash Triage Pipeline](#8-crash-triage-pipeline): minimise, symbolise, verify, root-cause
9. [Parallel Fuzzing Architecture](#9-parallel-fuzzing-architecture): master vs secondary, sync mechanism, core allocation
10. [Sanitizer Interactions](#10-sanitizer-interactions): ASan vs UBSan vs MSan, what each catches, multi-sanitizer campaigns
11. [Seed Corpus Construction](#11-seed-corpus-construction): validity, minimality, diversity, afl-cov, hand-crafted seeds

---

## 1. What AFL++ Is

Let's be real: most fuzzers are just throwing darts in the dark. Random bytes, blind hope, and occasionally a crash near the surface. That gets you nowhere near the interesting stuff. Real bugs live hundreds of functions deep, tucked behind parsers and state machines that random bytes will never reach on their own. A random 1KB blob has no shot at being a valid GGUF file, let alone one that tickles the tensor loading code four call frames down.

AFL++ flips the whole game with one elegant idea: ask the program itself which paths each input took, then use that to drive mutations. Inputs that unlock new territory get saved and mutated further. Inputs that retread old ground get dropped. That feedback loop is what separates serious fuzzing from random noise.

The formal name is **coverage-guided grey-box fuzzing**. Grey-box sits between black-box (treat the target as a sealed box, no source needed) and white-box (full symbolic execution, mathematically solve every path). AFL++ needs source at compile time to inject instrumentation hooks, but it never analyzes the program statically. It just watches what happens at runtime. That distinction is what keeps it fast and practical in the real world.

Michal Zalewski built the original AFL at Google and released it in 2013. Coverage-guided fuzzing existed as an academic concept before that, but AFL was the first implementation people actually used. Within two years it had found critical vulnerabilities in OpenSSL, libpng, libjpeg-turbo, bash, PHP, FFmpeg, GNU Binutils, and hundreds of other widely-deployed projects. AFL++ is the community fork that's been maintained since 2019, adding LLVM-based instrumentation, persistent mode, a custom mutator API, CMPLOG, and the ability to fuzz across dozens of cores in parallel.

Why does it find bugs that human testing misses? Two reasons: scale and relentlessness. A human writes maybe 100 test cases. AFL++ generates 4,000 per second, every single one steered toward code that hasn't been touched yet. That's 345 million executions in 24 hours. The bugs it finds are the real kind too, heap overflows, use-after-frees, integer overflows, all exploitable in production.

### The core feedback loop

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="220" viewBox="0 0 720 220">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
    </marker>
    <marker id="ah-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#5a8a5a"/>
    </marker>
    <marker id="ah-red" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#c07070"/>
    </marker>
  </defs>

  <!-- ── nodes ── -->
  <!-- Corpus -->
  <rect x="15" y="80" width="120" height="44" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.4"/>
  <text x="75" y="97" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">Corpus</text>
  <text x="75" y="113" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">seed inputs</text>

  <!-- New input -->
  <rect x="183" y="80" width="122" height="44" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="244" y="97" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">New input</text>
  <text x="244" y="113" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">mutated bytes</text>

  <!-- Target binary -->
  <rect x="353" y="80" width="132" height="44" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.4"/>
  <text x="419" y="97" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Target binary</text>
  <text x="419" y="113" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">instrumented</text>

  <!-- Bitmap -->
  <rect x="543" y="80" width="112" height="44" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="599" y="97" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">Bitmap</text>
  <text x="599" y="113" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">64KB map</text>

  <!-- findings/crashes -->
  <rect x="528" y="162" width="144" height="36" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/>
  <text x="600" y="180" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a2020">findings/crashes/</text>

  <!-- ── horizontal flow arrows ── -->
  <line x1="135" y1="102" x2="176" y2="102" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="157" y="117" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">mutate</text>

  <line x1="305" y1="102" x2="346" y2="102" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="328" y="117" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">execute</text>

  <line x1="485" y1="102" x2="536" y2="102" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- crash path: bitmap down then right -->
  <line x1="419" y1="124" x2="419" y2="155" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <line x1="419" y1="162" x2="521" y2="175" stroke="#2d2a26" stroke-width="1" stroke-dasharray="3,2"/>
  <line x1="521" y1="175" x2="524" y2="175" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="468" y="157" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">crash</text>

  <!-- ── feedback arc: ABOVE the boxes ── -->
  <!-- Goes from top of Bitmap (y=80) up to y=28, sweeps left, comes down to top of Corpus (y=80) -->

<path d="M 599,80 C 599,32 75,32 75,80"
        fill="none" stroke="#5a8a5a" stroke-width="1.5"
        stroke-dasharray="7,4"
        marker-end="url(#ah-green)"/>

  <!-- label sits in the middle of the arc, above the boxes -->

<text x="337" y="22" text-anchor="middle"
        font-family="'EB Garamond',Georgia,serif" font-size="10"
        font-style="italic" fill="#5a8a5a">new edges found — save &amp; mutate further</text>
</svg>

<div class="afl-fig-caption">Figure 1. Coverage-guided fuzzing feedback loop.</div>
</div>

### Fuzzer taxonomy

| Type                      | How it works                                       | What it finds              |
| ------------------------- | -------------------------------------------------- | -------------------------- |
| Blackbox / dumb           | Random bytes, no feedback                          | Surface bugs only          |
| Coverage-guided (AFL++)   | Instruments binary, tracks edges, steers mutations | Deep logic bugs            |
| Structure-aware           | Knows the input grammar (protobuf, TLS)            | Format-specific deep paths |
| Symbolic execution (KLEE) | Mathematically solves path constraints             | Precise but extremely slow |

---

## 2. Instrumentation

Here's the thing: AFL++ can't observe coverage from the outside. Watching system calls or memory usage tells you nothing about which branches a process actually took. AFL++ needs the program to report back. So it injects measurement hooks at compile time, before the program ever runs for the first time.

When you compile with `afl-clang-fast`, an LLVM pass fires after your source has been parsed and lowered to IR, but before machine code is emitted. At that stage the program is a clean graph of basic blocks with every branch clearly visible. That's exactly when AFL++ reaches in and plants its hooks.

A basic block, if you haven't met one before, is a straight line of instructions: one entry point at the top, one exit at the bottom, no jumps in the middle. Every `if`, every loop condition, every `switch` case creates a new boundary. A 30-line C function will typically have 15 to 20 of them. A complex parser? Hundreds.

### The injected instrumentation

The LLVM pass injects this three-line sequence at the start of every basic block:

```c
cur_location  = <compile_time_random_16bit_id>;
shared_mem[cur_location ^ prev_location]++;
prev_location = cur_location >> 1;
```

`cur_location` is a random 16-bit constant baked into the binary at compile time, one per basic block. `shared_mem` is the 64KB bitmap shared between the fuzzer and the target via `mmap(MAP_SHARED)`. XOR-ing the current and previous location IDs gives a unique identifier for the **edge**, meaning the specific transition between two blocks, not just the fact that a block was visited. That distinction matters a lot, which we'll get to in a second.

The right-shift of `prev_location` by 1 bit is there to fix a subtle symmetry problem. Without it, `XOR(A, B)` equals `XOR(B, A)`, so A→B and B→A would look identical in the bitmap. The shift breaks that symmetry and keeps directionality intact.

### Why edges instead of blocks?

**Block recording, loses direction** (A→B→D and A→C→D look identical):

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="110" y="10" width="130" height="36" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="175.0" y="28.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#4a4640">Block A</text><rect x="30" y="100" width="130" height="36" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="95.0" y="118.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">Block B</text><rect x="190" y="100" width="130" height="36" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="255.0" y="118.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">Block C</text><rect x="110" y="190" width="130" height="36" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="175.0" y="208.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#4a4640">Block D</text><line x1="175.0" y1="46.0" x2="100.8" y2="96.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="175.0" y1="46.0" x2="249.2" y2="96.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="95.0" y1="136.0" x2="169.2" y2="186.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="255.0" y1="136.0" x2="180.8" y2="186.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/></svg>
<div class="afl-fig-caption">Block recording: paths A→B→D and A→C→D appear identical.</div>
</div>
</div>

**Edge recording, AFL++ approach** (A→B→D and A→C→D are distinct paths):

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="110" y="10" width="130" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="175.0" y="28.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">Block A</text><rect x="30" y="100" width="130" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="95.0" y="118.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Block B</text><rect x="190" y="100" width="130" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="255.0" y="118.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Block C</text><rect x="110" y="190" width="130" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="175.0" y="208.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">Block D</text><line x1="155.0" y1="46.0" x2="100.2" y2="95.3" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="117.0" y="64.1" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">A→B</text><line x1="185.0" y1="46.0" x2="249.5" y2="95.7" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="212.7" y="82.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">A→C</text><line x1="95.0" y1="136.0" x2="169.2" y2="186.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="128.3" y="172.9" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">B→D</text><line x1="255.0" y1="136.0" x2="180.8" y2="186.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="208.3" y="153.1" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">C→D</text></svg>
<div class="afl-fig-caption">Edge recording: each transition is uniquely identified via XOR of block IDs.</div>
</div>
</div>

### Real instrumented code example

```c
int parse_header(uint8_t *buf, size_t len) {
    // ← basic block 1 starts here
    if (len < 8) return -1;             // branch → block 2 or block 3

    // ← basic block 3 (len >= 8 path)
    uint32_t magic = *(uint32_t *)buf;
    if (magic != 0x46465547) return -1; // branch → block 4 or block 5

    // ← basic block 5 (magic matches)
    uint16_t version = *(uint16_t *)(buf + 4);
    if (version > 3) return -1;         // branch → block 6 or block 7

    // ← basic block 7 (all checks passed)
    return process_body(buf + 8, len - 8);
}

// AFL injects a counter increment at the start of every block above.
// It tracks every EDGE between blocks:
//   block1 → block2  =  "short input rejected"       (edge ID = XOR(id1, id2))
//   block1 → block3  =  "input long enough"          (edge ID = XOR(id1, id3))
//   block3 → block5  =  "magic matched"              (edge ID = XOR(id3, id5))
//   block5 → block7  =  "version ok — deep path"     (edge ID = XOR(id5, id7))
```

### CMPLOG, solving the magic byte problem

Picture a parser that starts with `if (memcmp(buf, "GGUF", 4) != 0) return`. Every input that doesn't open with those exact 4 bytes gets rejected instantly, before reaching anything worth fuzzing. Random mutations will almost never stumble across the right sequence by chance.

CMPLOG is AFL++'s answer to that. It intercepts comparison instructions and logs both sides of every comparison to a shared buffer. AFL reads that log and splices the expected values directly into its mutation queue. Suddenly the program's guards are transparent. Magic-byte barriers disappear.

```bash
# Build with CMPLOG:
AFL_USE_CMPLOG=1 afl-clang-fast -o target-cmplog target.c

# Run with CMPLOG enabled:
afl-fuzz -c ./target-cmplog -i corpus/ -o findings/ -- ./target @@
```

---

## 3. The 64KB Coverage Bitmap

The communication channel between AFL++ and the target is a 64KB shared memory region, exactly **65,536 bytes**, allocated via `mmap(MAP_SHARED)` so both processes read and write the same physical pages. Each byte corresponds to one possible edge. The byte's value is a hit counter: how many times did that edge fire during this execution?

After each run, AFL reads the entire 64KB bitmap and compares it to a global `virgin_bits` map that tracks every edge and count combination seen across the whole campaign. Any new combination, even just an existing edge firing more times than before, marks the input as worth keeping. Before the next run, the bitmap gets wiped with a fast `memset()`. The forkserver parent handles this so the child always starts fresh.

The 64KB size is a deliberate choice. It's large enough to hold coverage maps for most real programs without excessive hash collisions (you get 65,536 distinct edge slots before things start degrading). More importantly, 64KB fits in L2 cache on virtually every modern CPU, which means those repeated bitmap reads and writes per execution stay fast.

### Bitmap comparison logic

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><text x="5" y="36" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" fill="#6b6860">virgin_bits</text><text x="5" y="96" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" fill="#6b6860">current exec</text><rect x="110" y="18" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="140.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="178" y="18" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="208.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="246" y="18" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="276.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">—</text><rect x="314" y="18" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="344.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="382" y="18" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="412.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">—</text><rect x="450" y="18" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="480.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">—</text><rect x="518" y="18" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="548.0" y="32.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">…</text><rect x="110" y="78" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="140.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="178" y="78" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="208.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="246" y="78" width="60" height="28" rx="3" fill="#faf8ee" stroke="#b8a840" stroke-width="1.2"/><text x="276.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a3000">NEW</text><line x1="276.0" y1="106.0" x2="276.0" y2="131.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="314" y="78" width="60" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="344.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">hit</text><rect x="382" y="78" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="412.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">—</text><rect x="450" y="78" width="60" height="28" rx="3" fill="#faf8ee" stroke="#b8a840" stroke-width="1.2"/><text x="480.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a3000">NEW</text><line x1="480.0" y1="106.0" x2="480.0" y2="131.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="518" y="78" width="60" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="548.0" y="92.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">…</text><rect x="190" y="138" width="230" height="30" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="305.0" y="153.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">INTERESTING — saved to corpus</text></svg>
<div class="afl-fig-caption">Bitmap comparison: new edge/count combinations trigger corpus addition.</div>
</div>
 NEW entries found → <strong>INTERESTING, saved to corpus</strong>
  </div>
</div>
</div>

### The bucket system

AFL doesn't compare raw hit counts in `virgin_bits`. Instead it normalizes each counter into logarithmic buckets first:

| Counter | Bucket | Meaning                                  |
| ------- | ------ | ---------------------------------------- |
| 1       | 1      | Hit exactly once                         |
| 2       | 2      | Hit exactly twice                        |
| 3       | 3      | Hit three times                          |
| 4-7     | 4      | Small loop                               |
| 8-15    | 5      | Medium loop                              |
| 16-31   | 6      | Larger loop                              |
| 32-127  | 7      | Large loop, potential overflow territory |
| 128+    | 8      | Very high iteration, highest priority    |

An input that drives a loop to 128 iterations lands in a completely different bucket from one that only drives it to 3, even though both paths hit the same edges. AFL treats the higher-iteration input as genuinely new coverage. This is the mechanism behind AFL finding loop-bound overflows: it keeps pushing loop counters into larger and larger buckets until eventually something breaks.

---

## 4. Mutation Stages

AFL++ never generates inputs from nothing. It starts from your seed corpus and works outward through a series of mutation stages. The pipeline moves from **deterministic** (exhaustive, fully predictable, guaranteed to terminate) to **non-deterministic** (random, combinatorial, effectively bottomless). The deterministic stages guarantee complete coverage at their level of granularity. The non-deterministic stages explore the exponentially larger space that determinism can't reach.

This ordering has real implications for how you set up your campaign. A good seed corpus lets deterministic stages get to meaningful byte positions quickly. Seeds should be small, valid, and semantically diverse. A good dictionary, meanwhile, makes havoc vastly more effective by giving it real tokens to work with instead of random garbage.

### Stage overview

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="142" viewBox="0 0 700 142" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="400" height="90" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="210.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Deterministic stages</text><rect x="440" y="32.0" width="240" height="90" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/><text x="560.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#3a1a5a" font-weight="500">Non-deterministic stages</text><rect x="18" y="62.0" width="90" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="63.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Bit flips</text><text x="63.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">1,2,4 bits</text><rect x="118" y="62.0" width="90" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="163.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Byte flips</text><text x="163.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">1,2,4 bytes</text><rect x="218" y="62.0" width="90" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="263.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Arithmetics</text><text x="263.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">±35</text><rect x="318" y="62.0" width="90" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="363.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Known ints</text><text x="363.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">0,−1,INT_MAX</text><rect x="448" y="62.0" width="100" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="498.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">Havoc</text><text x="498.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">random combos</text><rect x="562" y="62.0" width="112" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="618.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">Splice</text><text x="618.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">corpus crossover</text><line x1="108.0" y1="79.0" x2="111.0" y2="79.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="208.0" y1="79.0" x2="211.0" y2="79.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="308.0" y1="79.0" x2="311.0" y2="79.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="408.0" y1="79.0" x2="441.0" y2="79.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="548.0" y1="79.0" x2="555.0" y2="79.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/></svg>
<div class="afl-fig-caption">Mutation pipeline: deterministic stages run exhaustively, then non-deterministic havoc/splice.</div>
</div>
</div>

Deterministic stages run exactly once per corpus entry, in order, exhaustively. Every bit position gets flipped. Every arithmetic delta gets tried. Every known dangerous integer gets substituted. After all that, havoc runs in a loop for however long the entry's energy budget allows. Then splice runs if there are at least two corpus entries available.

The ordering isn't arbitrary. Bit flips are the cheapest probe AFL has. They map out which bytes are structurally sensitive without burning budget on compound mutations that are hard to reproduce. By the time havoc starts, AFL already has a working model of which regions of the input drive branching. Havoc concentrates its fire there.

### Input selection, which corpus entry gets mutated next

Before a single byte gets mutated, AFL has to decide which corpus entry to fuzz next. This is not a random draw. AFL++ maintains a **performance score** per entry and allocates fuzzing time accordingly.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="340" viewBox="0 0 680 340">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
    </marker>
    <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
    </marker>
  </defs>

  <!-- top: all corpus entries -->
  <rect x="255" y="10" width="170" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="340" y="27" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">All corpus entries</text>

  <line x1="340" y1="44" x2="340" y2="68" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- compute score -->
  <rect x="210" y="75" width="260" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="340" y="92" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Compute performance score</text>

  <line x1="340" y1="109" x2="340" y2="133" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- score formula -->
  <rect x="200" y="140" width="280" height="34" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="340" y="157" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Score = base × time × size</text>

  <line x1="340" y1="174" x2="340" y2="198" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- diamond: favoured set? centred at x=340 -->
  <polygon points="340,196 420,224 340,252 260,224" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="340" y="217" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Favoured</text>
  <text x="340" y="231" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">set?</text>

  <!-- yes → left → Full energy -->
  <line x1="260" y1="224" x2="165" y2="224" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="210" y="214" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="60" y="210" width="100" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="110" y="220" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">Full energy</text>
  <text x="110" y="235" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">normal exec</text>
  <line x1="110" y1="244" x2="110" y2="274" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <rect x="60" y="281" width="100" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="110" y="291" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">Deterministic</text>
  <text x="110" y="306" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">+ havoc</text>

  <!-- no → right → Skip? diamond centred at x=530 -->
  <line x1="420" y1="224" x2="484" y2="224" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="453" y="214" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <polygon points="530,200 600,224 530,248 460,224" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="530" y="217" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Skip?</text>
  <text x="530" y="231" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">(95% prob)</text>

  <!-- skip yes → down → Next entry -->
  <line x1="530" y1="248" x2="530" y2="274" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="518" y="265" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="480" y="281" width="100" height="34" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="530" y="291" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Next</text>
  <text x="530" y="306" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">entry</text>

  <!-- skip no → up-right → Reduced energy box, sits above Skip diamond -->
  <line x1="600" y1="224" x2="638" y2="224" stroke="#2d2a26" stroke-width="1.3"/>
  <line x1="638" y1="224" x2="638" y2="168" stroke="#2d2a26" stroke-width="1.3"/>
  <line x1="638" y1="168" x2="606" y2="168" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="648" y="198" text-anchor="start" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <rect x="490" y="148" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="545" y="161" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Reduced</text>
  <text x="545" y="178" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">energy ×3</text>
</svg>
<div class="afl-fig-caption">Corpus entry selection: performance score determines energy allocation.</div>
</div>
</div>

The performance score formula:

```
base_score = 100

if exec_time < avg:  score *= 0.1 to 0.25   (fast = bonus)
if exec_time > avg:  score *= 2 to 5        (slow = penalty)

if file_size < avg:  score *= 0.25          (small = bonus)
if file_size > avg:  score *= 2 to 4        (big = penalty)

if recent new finds: score *= 2 to 4        (productive = bonus)
if no finds lately:  score *= 0.25 to 0.5   (cold = penalty)
```

A fast, small, recently-productive entry might get 4x normal energy. A slow, bloated, cold entry that hasn't produced a new find in 1000 cycles gets 1/16th of normal energy. This is why seed corpus quality matters so much, large seeds drag down the whole campaign by burning energy on slow deterministic passes over bytes that don't affect coverage.

### Bit flips (deterministic)

Bit flipping is AFL's most granular probe, the finest-grained tool in the deterministic arsenal. It runs in three sub-passes: single-bit flips, then adjacent 2-bit pairs, then adjacent 4-bit nibbles. For a 100-byte input that produces exactly `800 + 799 + 798 = 2397` variants. Every single bit position gets touched.

```c
original:  01001000  (0x48 = 'H')
1-bit flip at pos 0:
           11001000  (0xC8)
1-bit flip at pos 1:
           00001000  (0x08)
2-bit flip at pos 0:
           10001000  (0x88 — bits 0 and 1 both flipped)
4-bit flip at pos 0:
           10110000  (0xB0 — bits 0-3 flipped — nibble swap)
```

The 2-bit and 4-bit passes aren't redundant. A 2-bit flip on a flag byte with two independent bits can trigger a path that no single-bit flip would ever hit: the branch that requires both flags set at once. A 4-bit flip inverts an entire nibble, which is the natural unit for BCD-encoded values and hex-digit parsers. These things matter.

**What bit flips find:** checksum fields that reject any single-bit deviation, flag bytes with multi-bit semantics, length fields where adjacent bits each control something different, version fields that gate entire feature sets.

**What they miss:** anything gated on a specific multi-byte value. A 4-byte magic like `GGUF` requires all 32 bits to land correctly at once. Bit flips can't get there from a wrong starting point. That's exactly why CMPLOG and the dictionary exist.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="660" height="260" viewBox="0 0 660 260">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
    </marker>
  </defs>

  <!-- ── Pass 1: 1-bit flips ── -->
  <rect x="10" y="30" width="640" height="56" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/>
  <text x="330" y="24" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" font-weight="500" fill="#2a4a2a">Pass 1 — 1-bit flips</text>

  <!-- row 1 boxes: x positions 20, 150, 280, 420 — gaps of ~36px between each -->
  <rect x="20" y="44" width="110" height="30" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="75" y="59" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">flip bit 0</text>

  <line x1="130" y1="59" x2="158" y2="59" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="164" y="44" width="110" height="30" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="219" y="59" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">flip bit 1</text>

  <line x1="274" y1="59" x2="302" y2="59" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="308" y="44" width="110" height="30" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="363" y="59" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">flip bit 2</text>

  <line x1="418" y1="59" x2="446" y2="59" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="452" y="44" width="182" height="30" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="543" y="59" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">… flip bit N×8</text>

  <!-- arrow down pass1→pass2 -->
  <line x1="330" y1="86" x2="330" y2="104" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- ── Pass 2: 2-bit flips ── -->
  <rect x="10" y="110" width="640" height="56" rx="3" fill="none" stroke="#607aaa" stroke-width="1" stroke-dasharray="5,3"/>
  <text x="330" y="104" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" font-weight="500" fill="#1e3060">Pass 2 — 2-bit flips</text>

  <rect x="20" y="124" width="130" height="30" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="85" y="139" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">flip bits 0,1</text>

  <line x1="150" y1="139" x2="178" y2="139" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="184" y="124" width="130" height="30" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="249" y="139" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">flip bits 1,2</text>

  <line x1="314" y1="139" x2="342" y2="139" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="348" y="124" width="182" height="30" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="439" y="139" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">… flip bits N−1,N</text>

  <!-- arrow down pass2→pass3 -->
  <line x1="330" y1="166" x2="330" y2="184" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- ── Pass 3: 4-bit flips ── -->
  <rect x="10" y="190" width="640" height="56" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/>
  <text x="330" y="184" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" font-weight="500" fill="#3a1a5a">Pass 3 — 4-bit flips</text>

  <rect x="20" y="204" width="130" height="30" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="85" y="219" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">flip bits 0–3</text>

  <line x1="150" y1="219" x2="178" y2="219" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="184" y="204" width="130" height="30" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="249" y="219" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">flip bits 1–4</text>

  <line x1="314" y1="219" x2="342" y2="219" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="348" y="204" width="182" height="30" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="439" y="219" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">… flip bits N−3,N</text>
</svg>
<div class="afl-fig-caption">Three bit-flip passes: 1-bit, 2-bit, and 4-bit flips at every position.</div>
</div>
</div>

There's also a useful side effect here. By watching which bit flips change the coverage bitmap, AFL builds an implicit map of which byte positions are semantically meaningful. Bytes where every flip moves coverage are hot, they directly drive branching logic. Bytes where nothing changes are cold, probably payload or padding that never gets compared. That inference feeds into the arithmetic and havoc stages, which focus their effort accordingly.

### Byte flips (deterministic)

After bit flips, AFL runs byte-level flips: XOR each byte with `0xFF` (invert all 8 bits), then each consecutive 2-byte word, then each consecutive 4-byte dword.

```c
original byte:  0x48
byte flip:      0xB7   (0x48 ^ 0xFF)

original word:  0x4865  ("He")
word flip:      0xB79A  (each byte XORed with 0xFF)

original dword: 0x48656C6C  ("Hell")
dword flip:     0xB79A9393
```

The byte flip pass is where AFL starts detecting token boundaries in the input. If flipping byte N and byte N+1 together produces the same coverage change as flipping just byte N alone, then byte N+1 is likely part of the same logical token as byte N. AFL builds a rough internal tokenization map from these observations, which later feeds into the havoc stage's block insertion logic.

### Arithmetics (deterministic)

The arithmetic stage walks through every byte position and applies additions and subtractions in the range 1 to 35, treating the value at that position as an 8-bit, 16-bit, or 32-bit integer in both little-endian and big-endian layout. That's `35 × 2 × 3 × 2 = 420` operations per position. It sounds like a lot because it is.

Why ±35 specifically? Because it's wide enough to cross every common integer boundary from any nearby starting value in one step. `INT8_MAX` is 127, so starting from 92 and adding 35 gets you there. Start at 128 and subtract 1 and you've crossed the signed boundary. Go wider and you waste cycles on deltas that never trigger anything new. It's a calibrated tradeoff.

```c
// arithmetic at a 16-bit word position, starting value 0x7FFE:
+1  → 0x7FFF   (INT16_MAX - 1)
+2  → 0x8000   (INT16_MIN in signed, crosses the sign boundary)
+3  → 0x8001

// little-endian vs big-endian:
// bytes in memory: 0xFE 0x7F (little-endian 0x7FFE)
// arithmetic +2:
//   little-endian result: 0x00 0x80  (value 0x8000)
//   big-endian result:    0x80 0x00  (same value, different byte layout)
// both are tried
```

The endianness doubling matters because real parsers almost always use explicit endian conversion: `ntohs()`, `le32toh()`, or hand-rolled bit shifts. AFL has no idea which one your parser uses, so it tries both byte orders for every value. One of them will land in the layout your parser actually reads.

**What arithmetics find:** size fields where `count + 1` wraps, index fields where `i - 1` underflows to a huge positive number, length fields that trigger off-by-one errors in allocation math.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="430" viewBox="0 0 500 430">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
    <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#888480"/></marker>
  </defs>

  <!-- Input byte position i -->
  <rect x="165" y="16" width="170" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="250" y="33" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">Input byte position i</text>

  <line x1="250" y1="50" x2="250" y2="70" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Read as uint8/16/32 -->
  <rect x="140" y="76" width="220" height="40" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="250" y="90" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Read as uint8/16/32</text>
  <text x="250" y="107" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">both endians</text>

  <line x1="250" y1="116" x2="250" y2="136" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- For delta = 1 to 35 -->
  <rect x="165" y="142" width="170" height="34" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="250" y="159" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">For delta = 1 to 35:</text>

  <line x1="250" y1="176" x2="250" y2="196" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- value ± delta -->
  <rect x="165" y="202" width="170" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.4"/>
  <text x="250" y="219" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">value ± delta</text>

  <line x1="250" y1="236" x2="250" y2="256" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: Already seen? centred at 250,278 -->
  <polygon points="250,254 340,278 250,302 160,278" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="250" y="272" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Already seen</text>
  <text x="250" y="286" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">by bit/byte flip?</text>

  <!-- yes → left → Next delta -->
  <line x1="160" y1="278" x2="110" y2="278" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="132" y="268" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="20" y="264" width="88" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="64" y="278" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Next delta</text>

  <!-- loop back dashed from Next delta up to For delta box -->
  <path d="M20,278 C-10,278 -10,159 165,159" fill="none" stroke="#9a9690" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#ah-gray)"/>
  <text x="6" y="222" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="9" font-style="italic" fill="#9a9690">loop</text>

  <!-- no → down → Run target -->
  <line x1="250" y1="302" x2="250" y2="322" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="238" y="316" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>

  <!-- Run target -->
  <rect x="165" y="328" width="170" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="250" y="343" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">Run target</text>
  <text x="250" y="359" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">check bitmap</text>

  <line x1="250" y1="368" x2="250" y2="388" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- two terminal boxes: New coverage | No new coverage -->
  <rect x="80" y="394" width="130" height="30" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="145" y="409" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">New coverage</text>

  <rect x="290" y="394" width="130" height="30" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="355" y="409" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">No new coverage</text>
</svg>
<div class="afl-fig-caption">Arithmetic mutation loop with deduplication against prior bit-flip results.</div>
</div>

AFL also skips any arithmetic mutation that would produce a byte sequence already generated by a bit flip pass. No point running the same input twice.

### Havoc (non-deterministic)

Havoc is where AFL++ gets dangerous. It takes a single input and applies a randomly-chosen stack of randomly-chosen mutations on top of each other. The mutation count starts at 4 and can climb to `2^stacking_multiplier`. That multiplier increases automatically when coverage stagnates, which means the longer AFL goes without finding something new, the more aggressive it gets.

The full set of havoc operations:

```
bit flip (random single bit)
set random byte to random value
set random byte to interesting 8-bit value
set random 16-bit word to interesting 16-bit value (both endians)
set random 32-bit dword to interesting 32-bit value (both endians)
randomly subtract from byte/word/dword (arithmetic)
randomly add to byte/word/dword (arithmetic)
random XOR on a byte
randomly flip upper/lower case of a byte (ASCII)
delete random block (size 1–2*havoc_blk_small bytes)
clone random block and insert at random position
overwrite random block with random bytes
overwrite random block with a fixed byte
overwrite random block with a copy from elsewhere in the input
insert a dictionary token at a random position
overwrite bytes with a dictionary token
splice in a random chunk from another corpus entry
```

The stacking is the whole point. One mutation changes one feature. Stack 16 or 32 mutations and you can produce structurally complex inputs that no single-stage deterministic pass could ever generate. A block deletion, two byte flips, an integer boundary value, and a dictionary token, all in one execution. Four interacting changes navigating past four different parser guards simultaneously.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="480" viewBox="0 0 620 480">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
    <marker id="ah-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#5a8a5a"/></marker>
    <marker id="ah-red" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#c07070"/></marker>
  </defs>

  <!-- Input from corpus -->
  <rect x="210" y="16" width="160" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="290" y="33" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">Input from corpus</text>

  <line x1="290" y1="50" x2="290" y2="70" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Pick mutation count -->
  <rect x="195" y="76" width="190" height="40" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="290" y="91" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">Pick mutation count</text>
  <text x="290" y="107" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">weighted: 4..256</text>

  <line x1="290" y1="116" x2="290" y2="136" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Pick random operation -->
  <rect x="190" y="142" width="200" height="40" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="290" y="157" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">Pick random operation</text>
  <text x="290" y="173" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">from 17-item menu</text>

  <line x1="290" y1="182" x2="290" y2="202" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Apply mutation -->
  <rect x="195" y="208" width="190" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="290" y="225" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Apply mutation in-place</text>

  <line x1="290" y1="242" x2="290" y2="262" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: More mutations? centred at 290,284 -->
  <polygon points="290,260 375,284 290,308 205,284" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="290" y="278" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">More mutations</text>
  <text x="290" y="292" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">remaining?</text>

  <!-- yes → right arc back up to Pick random operation -->
  <path d="M375,284 C430,284 430,162 390,162" fill="none" stroke="#2d2a26" stroke-width="1.2" marker-end="url(#ah)"/>
  <text x="440" y="226" text-anchor="start" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>

  <!-- no → down -->
  <line x1="290" y1="308" x2="290" y2="328" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="278" y="322" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>

  <!-- Execute mutated input -->
  <rect x="195" y="334" width="190" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.4"/>
  <text x="290" y="351" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Execute mutated input</text>

  <line x1="290" y1="368" x2="290" y2="388" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: New coverage? centred at 290,410 -->
  <polygon points="290,386 375,410 290,434 205,410" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="290" y="410" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">New coverage?</text>

  <!-- yes → left → Save to corpus -->
  <line x1="205" y1="410" x2="155" y2="410" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="177" y="400" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="20" y="394" width="130" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="85" y="407" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">Save to corpus</text>
  <text x="85" y="422" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">reset stagnation</text>

  <!-- save → dashed arc back to top -->
  <path d="M20,410 C-10,410 -10,33 210,33" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3" marker-end="url(#ah-green)"/>

  <!-- no → right → Increase stacking multiplier -->
  <line x1="375" y1="410" x2="425" y2="410" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="402" y="400" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <rect x="432" y="390" width="160" height="40" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/>
  <text x="512" y="405" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a2020">Increase stacking</text>
  <text x="512" y="421" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a2020">multiplier</text>

  <!-- stacking → dashed arc back up to Pick mutation count -->
  <path d="M512,390 C512,50 395,50 395,116" fill="none" stroke="#c07070" stroke-width="1" stroke-dasharray="5,3" marker-end="url(#ah-red)"/>
</svg>
<div class="afl-fig-caption">Havoc mutation loop with stagnation ratchet: mutation depth increases when coverage plateaus.</div>
</div>
</div>

#### The stagnation ratchet

When havoc stops producing new coverage, AFL++ automatically raises the stacking multiplier. More mutations per execution means more radical transformations, further from the starting input. This is the self-regulating mechanism that keeps a campaign productive long after the obvious paths are exhausted. You'll see it in the stats panel: `havoc/splice` counts climbing while `new edges on` drops. AFL is digging deeper.

#### Block operations in detail

The block operations are worth understanding separately because they do something deterministic stages never do: they change the input's length.

```
delete block:  [AAABBBCCC] → [AAACCC]   (BBB removed)
clone block:   [AAABBBCCC] → [AAABBBBBCCC]  (BBB duplicated)
insert block:  [AAABBBCCC] → [AAA????BBBCCC]  (random bytes inserted)
overwrite:     [AAABBBCCC] → [AAAXXX CCC]  (BBB replaced with copy from elsewhere)
```

Length-changing mutations are what catch parsers that blindly trust a length field in the header. If a file declares a 100-byte section and AFL clones a block to push it to 120 bytes, a parser that calls `malloc(header->section_len)` and then reads the full body will overflow by exactly 20 bytes. The header still says 100. The actual payload is 120. That's the bug.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="222" viewBox="0 0 680 222" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="180" height="140" rx="3" fill="none" stroke="#607aaa" stroke-width="1" stroke-dasharray="5,3"/><text x="100.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#1e3060" font-weight="500">Before block clone</text><rect x="220" y="32.0" width="200" height="140" rx="3" fill="none" stroke="#c09050" stroke-width="1" stroke-dasharray="5,3"/><text x="320.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#5a3800" font-weight="500">After havoc clone</text><rect x="460" y="32.0" width="210" height="140" rx="3" fill="none" stroke="#c07070" stroke-width="1" stroke-dasharray="5,3"/><text x="565.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#5a2020" font-weight="500">Parser behaviour</text><rect x="20" y="72.0" width="80" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="60.0" y="81.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">header</text><text x="60.0" y="96.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">len=100</text><line x1="100.0" y1="89.0" x2="123.0" y2="89.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="130" y="72.0" width="50" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="155.0" y="81.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">data</text><text x="155.0" y="96.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">100B</text><rect x="230" y="56.0" width="80" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="270.0" y="58.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">header</text><text x="270.0" y="73.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">len=100</text><text x="270.0" y="88.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">(unchanged)</text><line x1="310.0" y1="73.0" x2="343.0" y2="73.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="350" y="56.0" width="60" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="380.0" y="58.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">data</text><text x="380.0" y="73.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">120B</text><text x="380.0" y="88.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">(cloned)</text><rect x="470" y="56.0" width="190" height="28" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="565.0" y="70.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">malloc(header→len) = malloc(100)</text><line x1="565.0" y1="84.0" x2="565.0" y2="101.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="470" y="108.0" width="190" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="565.0" y="122.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">read 120B into 100B buffer</text><line x1="565.0" y1="136.0" x2="565.0" y2="153.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="470" y="160.0" width="190" height="28" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="565.0" y="174.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">20-byte overflow — ASan fires</text><line x1="420.0" y1="112.0" x2="453.0" y2="112.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/></svg>
<div class="afl-fig-caption">Length-discrepancy overflow: header claims 100 bytes; block clone produces 120.</div>
</div>
</div>

### Splice (non-deterministic)

Splice takes two corpus entries and crossbreeds them. It picks a random split point in each input, combines the first half of one with the second half of the other, and then runs havoc on the result. Genetic algorithm energy, basically.

```
input_A:  [HEADER_A | PAYLOAD_A]
input_B:  [HEADER_B | PAYLOAD_B]

splice at midpoint:
result:   [HEADER_A | PAYLOAD_B]  ← then havoc runs on this
```

The genetic analogy isn't accidental. Two inputs that each unlocked a different deep code path, one that passed the version check, one that got past the magic, might combine into something that passes both. Splice is AFL exploring the intersection of independent paths at the same time.

Splice only runs with at least two corpus entries available, and it enforces constraints to avoid producing clones. The two parents must differ by at least one byte in the spliced region. Pointless crossings are skipped.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="180" viewBox="0 0 560 180" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="20" y="60" width="150" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="95.0" y="69.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Corpus entry A</text><text x="95.0" y="84.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">(reached path X)</text><rect x="20" y="120" width="150" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="95.0" y="129.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">Corpus entry B</text><text x="95.0" y="144.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">(reached path Y)</text><line x1="170.0" y1="77.0" x2="223.5" y2="97.5" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="170.0" y1="137.0" x2="224.0" y2="103.7" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="230" y="82" width="110" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="285.0" y="91.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#3a1a5a">Splice</text><text x="285.0" y="106.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#3a1a5a">random split point</text><line x1="340.0" y1="99.0" x2="373.0" y2="99.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="380" y="82" width="100" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="430.0" y="91.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Havoc on</text><text x="430.0" y="106.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">spliced input</text><line x1="480.0" y1="99.0" x2="523.0" y2="99.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="530" y="82" width="20" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="540.0" y="99.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640"></text><text x="492" y="80" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">may reach X ∩ Y</text></svg>
<div class="afl-fig-caption">Splice combines halves of two corpus entries, enabling exploration of path intersections.</div>
</div>
</div>

### Mutation feedback and the coverage ratchet

Every mutation that reveals new coverage gets saved to the corpus immediately and becomes a starting point for future mutations. This is the ratchet: coverage only moves in one direction, and every new entry unlocks mutations that couldn't have been generated from the seeds alone.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="460" height="470" viewBox="0 0 460 470">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
  </defs>

  <rect x="80" y="16" width="300" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.4"/>
  <text x="230" y="31" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">Seed: valid.gguf</text>
  <text x="230" y="47" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">(200 edges covered)</text>

  <line x1="230" y1="56" x2="230" y2="76" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="82" width="300" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="230" y="97" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Havoc round 1</text>
  <text x="230" y="113" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">malformed header produced</text>

  <line x1="230" y1="122" x2="230" y2="142" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="148" width="300" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="230" y="163" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">bad_magic.gguf saved</text>
  <text x="230" y="179" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">(+50 new edges)</text>

  <line x1="230" y1="188" x2="230" y2="208" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="214" width="300" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="230" y="229" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Havoc round 2</text>
  <text x="230" y="245" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">invalid tensor count</text>

  <line x1="230" y1="254" x2="230" y2="274" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="280" width="300" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="230" y="295" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">bad_tensor.gguf saved</text>
  <text x="230" y="311" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">(+30 new edges)</text>

  <line x1="230" y1="320" x2="230" y2="340" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="346" width="300" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="230" y="361" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Havoc round 3</text>
  <text x="230" y="377" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">tensor loop past bounds</text>

  <line x1="230" y1="386" x2="230" y2="406" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="80" y="412" width="300" height="42" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.4"/>
  <text x="230" y="428" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">CRASH: heap-buffer-overflow</text>
  <text x="230" y="445" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">in tensor loading code</text>
</svg>
<div class="afl-fig-caption">Coverage ratchet: each mutation builds on the last, reaching progressively deeper code paths.</div>
</div>
</div>

This is why coverage-guided fuzzing reaches bugs that random fuzzing never will. The heap overflow in tensor loading code isn't reachable in one shot. It requires a specific sequence of structural violations, each one unlocking the next. AFL builds that sequence incrementally, each mutation standing on the shoulders of the last one.

### Dictionary, what it does and why it matters

A dictionary gives havoc meaningful tokens to work with instead of random bytes. Without one, AFL would have to stumble across a 5-byte token like `<unk>` purely by chance, roughly 1 in 256⁵, or about 1 in a trillion. With a dictionary, that token shows up in every havoc batch.

```ini
# tokenizer.dict
token_sos="<s>"
token_eos="</s>"
token_unk="<unk>"
token_sep="▁"
null="\x00"
bom="\xEF\xBB\xBF"
```

Internally, each token is just a byte string with a length. During havoc, AFL picks a token at random and either inserts it at a random position (making the input longer) or overwrites bytes starting somewhere (keeping the length the same). The token goes in whole, unmutated. That's how a specific 5-byte sequence reliably appears in inputs that random byte substitutions would never produce.

**Auto-dictionary from CMPLOG:** Run with `-c target-cmplog` and AFL++ builds the dictionary for you automatically. Every `strcmp`, `memcmp`, and switch-case operand gets logged at runtime. AFL extracts the expected comparison values and adds them to an internal token list. Your manual dictionary fills in tokens that appear in data sections rather than comparison instructions.

Stats panel impact after adding the dictionary:

```
before:  dictionary : 0/0,    0/0,    0/0, 0/0
after:   dictionary : 27/736, 33/850, 0/0, 0/0
                       ↑  ↑
                  27 new-coverage finds from 736 dict-assisted mutations = 3.7% hit rate
```

### Custom mutators

AFL++ lets you plug in custom mutators via a C or Python API. These run alongside or in place of the built-in stages. This is the right move for structured formats where byte-level mutations spend most of their time producing inputs that fail format validation before reaching any interesting code.

```c
// custom_mutator.c — skeletal structure
#include "afl-fuzz.h"

void *afl_custom_init(afl_state_t *afl, unsigned int seed) {
    // allocate mutator state, seed RNG
    return my_state;
}

size_t afl_custom_fuzz(void *data, uint8_t *buf, size_t buf_size,
                       uint8_t **out_buf, uint8_t *add_buf,
                       size_t add_buf_size, size_t max_size) {
    // parse buf as your format, apply structured mutations,
    // write result to *out_buf, return new size
    GGUFFile *f = gguf_parse(buf, buf_size);
    gguf_mutate_tensor_dims(f);          // change a tensor dimension
    return gguf_serialize(f, out_buf);   // reserialize
}

uint8_t afl_custom_queue_get(void *data, const uint8_t *filename) {
    return 1; // return 0 to skip this corpus entry
}
```

Custom mutators stack with the built-in stages by default. AFL runs its havoc pass, then hands the result to your mutator for a second pass. Set `AFL_CUSTOM_MUTATOR_ONLY=1` and your mutator runs alone. Python bindings are there for rapid prototyping when you don't want to write C:

```python
# mutator.py
def fuzz(buf, add_buf, max_size):
    import struct, random
    data = bytearray(buf)
    # flip a random tensor dimension to a boundary value
    if len(data) >= 12:
        offset = random.randint(0, len(data) - 4) & ~3
        boundary = random.choice([0, 1, 0xFFFFFFFF, 0x80000000, 65535])
        struct.pack_into('<I', data, offset, boundary)
    return bytes(data)
```

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="150" viewBox="0 0 680 150" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32" width="110" height="36" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="65.0" y="50.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">Corpus entry</text><rect x="155" y="32" width="150" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="230.0" y="42.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Built-in stages</text><text x="230.0" y="57.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">bit flips, havoc, splice</text><rect x="348" y="32" width="150" height="36" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="423.0" y="42.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">Custom mutator</text><text x="423.0" y="57.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">format-aware transforms</text><rect x="542" y="32" width="110" height="36" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="597.0" y="50.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Execute target</text><rect x="542" y="82" width="110" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="597.0" y="92.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Corpus if new</text><text x="597.0" y="107.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">coverage</text><line x1="120.0" y1="50.0" x2="148.0" y2="50.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="305.0" y1="50.0" x2="341.0" y2="50.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="498.0" y1="50.0" x2="535.0" y2="50.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="597.0" y1="68.0" x2="597.0" y2="75.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/></svg>
<div class="afl-fig-caption">Custom mutator pipeline: AFL++ built-in stages followed by format-aware mutator pass.</div>
</div>
</div>

The practical payoff is significant. A pure byte-level mutator on a protobuf binary spends most of its budget producing inputs that fail proto parsing immediately, never reaching any interesting code. A custom mutator that keeps the structure valid while randomizing field values reaches the actual application logic on virtually every execution. Coverage density improves dramatically. Time to first crash drops.

---

## 5. Forkserver and Persistent Mode

Speed in fuzzing isn't a nice-to-have, it's everything. The number of bugs you find scales roughly linearly with how many executions you run. The naive approach, forking a fresh process for each input, forces you to pay the full startup cost every single time: dynamic linker, C runtime initialization, model loading. For a target that loads a vocabulary model that's 200-500ms per execution. At 200ms per exec you're getting 5 execs per second. You might as well not bother.

### The forkserver

AFL's forkserver cleanly separates initialization from execution. The target binary runs through all its setup, then stops at the forkserver checkpoint and signals AFL that it's ready. From that point forward, AFL calls `fork()` on the already-initialized process for each new input.

On Linux, `fork()` uses copy-on-write. The child inherits all of the parent's memory pages, the heap, the stack, the loaded model, but no physical pages are actually copied until the child writes to them. The child gets all that initialization work for free.

**Without forkserver**, full init cost every execution:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="80" viewBox="0 0 680 80" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="22" width="120" height="36" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="70.0" y="40.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">exec + init + load</text><line x1="130.0" y1="40.0" x2="137.0" y2="40.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="144" y="22" width="120" height="36" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="204.0" y="40.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run + exit</text><line x1="264.0" y1="40.0" x2="271.0" y2="40.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="278" y="22" width="120" height="36" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="338.0" y="40.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">exec + init + load</text><line x1="398.0" y1="40.0" x2="405.0" y2="40.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="412" y="22" width="120" height="36" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="472.0" y="40.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run + exit</text><line x1="532.0" y1="40.0" x2="539.0" y2="40.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="546" y="22" width="110" height="36" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="601.0" y="40.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">… 200ms × N</text></svg>
<div class="afl-fig-caption">Without forkserver: full initialisation cost paid on every execution.</div>
</div>
</div>

**With deferred forkserver**, init once, fork per input:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="160" viewBox="0 0 680 160" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="62" width="160" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="90.0" y="74.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">exec + init + load model</text><text x="90.0" y="89.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">(runs once in parent)</text><line x1="170.0" y1="82.0" x2="203.0" y2="82.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="62" width="120" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="270.0" y="74.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">__AFL_INIT</text><text x="270.0" y="89.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">CHECKPOINT</text><line x1="330.0" y1="62.0" x2="354.5" y2="42.4" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="330.0" y1="82.0" x2="353.0" y2="82.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="330.0" y1="102.0" x2="354.5" y2="121.6" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="342" y="30" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">fork()</text><rect x="360" y="20" width="150" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="435.0" y="37.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">child → run → exit</text><rect x="360" y="65" width="150" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="435.0" y="82.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">child → run → exit</text><rect x="360" y="110" width="150" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="435.0" y="127.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">child → run → exit</text><text x="340" y="155" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#5a8a5a">model pages inherited via copy-on-write — no redundant loading</text></svg>
<div class="afl-fig-caption">Deferred forkserver: expensive initialisation amortised across all child executions.</div>
</div>
</div>

### Deferred forkserver pattern

```c
int main(int argc, char **argv) {
    // This code runs ONCE in the parent process:
    llama_backend_init();
    llama_model_params mp = llama_model_default_params();
    mp.vocab_only = true;
    g_model = llama_model_load_from_file(argv[1], mp);  // expensive — done once

    __AFL_INIT();  // ← fork happens HERE
                   // every forked child inherits g_model for free via COW

    uint8_t buf[65536];
    while (__AFL_LOOP(10000)) {
        ssize_t n = read(0, buf, sizeof(buf));
        if (n > 0) fuzz_tokenizer(buf, n);
        // reset any modified global state here
    }
}
```

### Persistent mode internals

Persistent mode eliminates `fork()` from the inner loop entirely. The same process handles thousands of inputs in a tight loop. AFL delivers each new input via shared memory and a pipe-based control channel. No process creation, no dynamic linking, no OS overhead. Just function call overhead.

`__AFL_LOOP(N)` is the macro that makes this work. On each iteration it:

1. Signals AFL over the control pipe that the previous execution finished and the bitmap is ready to read
2. Waits for AFL to send the next input via stdin (or shared memory in `AFL_SHMEM_FUZZING` mode)
3. Resets the coverage bitmap to zero
4. Returns `1` to continue the loop, or `0` after `N` iterations to trigger a graceful process restart

The `N` parameter is a safety valve. After `N` iterations the process exits gracefully and AFL forks a fresh one. Persistent mode processes accumulate garbage: leaked allocations, heap fragmentation, stale file descriptors. Restarting every 10,000 iterations keeps the process clean enough that accumulated drift doesn't poison your coverage signal. Targets with known leaks should use a lower `N`, around 1,000. Clean targets can run 10,000 to 100,000.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="516" viewBox="0 0 420 516" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="100" y="10" width="220" height="32" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="210.0" y="26.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">fork() once — child process starts</text><line x1="210.0" y1="42.0" x2="210.0" y2="47.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="54" width="220" height="32" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="210.0" y="70.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">__AFL_INIT — deferred checkpoint</text><line x1="210.0" y1="86.0" x2="210.0" y2="91.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="98" width="220" height="32" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="210.0" y="114.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">__AFL_LOOP(10000) — returns 1</text><line x1="210.0" y1="130.0" x2="210.0" y2="135.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="142" width="220" height="32" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="210.0" y="158.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">read input from stdin / shmem</text><line x1="210.0" y1="174.0" x2="210.0" y2="179.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="186" width="220" height="32" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="210.0" y="202.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">execute fuzz target</text><line x1="210.0" y1="218.0" x2="210.0" y2="223.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="230" width="220" height="32" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="210.0" y="246.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">bitmap updated by instrumentation</text><line x1="210.0" y1="262.0" x2="210.0" y2="267.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="274" width="220" height="32" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="210.0" y="290.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">signal AFL: execution done</text><line x1="210.0" y1="306.0" x2="210.0" y2="311.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="318" width="220" height="32" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="210.0" y="334.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">AFL reads bitmap, sends next input</text><line x1="210.0" y1="350.0" x2="210.0" y2="355.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="100" y="362" width="220" height="32" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="210.0" y="378.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">memset bitmap to 0</text><line x1="210.0" y1="394.0" x2="210.0" y2="399.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><polygon points="210,394 290,420 210,446 130,420" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/><text x="210" y="420.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">iteration < N?</text><path d="M290,420 C370,420 370,114 320,114" fill="none" stroke="#2d2a26" stroke-width="1.2" marker-end="url(#ah)"/><text x="375" y="267" text-anchor="start" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text><line x1="210.0" y1="446.0" x2="210.0" y2="461.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="198.0" y="457.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text><rect x="130" y="468" width="160" height="32" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="210.0" y="476.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">process exits</text><text x="210.0" y="491.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">AFL forks new child</text></svg>
<div class="afl-fig-caption">Persistent mode: single process handles N inputs per fork, eliminating fork() overhead.</div>
</div>
</div>

#### AFL_PERSISTENT vs AFL_DEFER_FORKSRV

These are two independent orthogonal features that are often confused:

`AFL_DEFER_FORKSRV` moves the fork point later in `main()`, past your expensive setup code. The process still forks for every input. You pay one `fork()` and one `waitpid()` per execution, but the expensive initialization, model loading, network setup, crypto init, happens once in the parent and is inherited free by every child.

`AFL_PERSISTENT` eliminates fork entirely from the inner loop. The same process handles many inputs back to back. The cost is discipline: you must reset all state between iterations manually. The benefit is a 5 to 20x throughput improvement over even a deferred forkserver. That's the deal.

The two features stack. Use both together and you get expensive init amortized across the whole campaign (deferred forkserver) plus no fork overhead per input (persistent). That's the `__AFL_INIT()` + `__AFL_LOOP()` pattern above, and it's how you get serious throughput numbers.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="30" width="170" height="230" rx="3" fill="none" stroke="#9a9690" stroke-width="1" stroke-dasharray="5,3"/><text x="95.0" y="24" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#4a4640" font-weight="500">Plain forkserver</text><rect x="30" y="50" width="130" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="95.0" y="64.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">fork</text><line x1="95.0" y1="78.0" x2="95.0" y2="81.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="88" width="130" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="95.0" y="102.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run</text><line x1="95.0" y1="116.0" x2="95.0" y2="119.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="126" width="130" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="95.0" y="140.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">wait</text><line x1="95.0" y1="154.0" x2="95.0" y2="157.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="164" width="130" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="95.0" y="178.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">fork</text><line x1="95.0" y1="192.0" x2="95.0" y2="195.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="202" width="130" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="95.0" y="216.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run</text><line x1="95.0" y1="230.0" x2="95.0" y2="233.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="240" width="130" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="95.0" y="254.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">wait</text><rect x="200" y="30" width="190" height="230" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="295.0" y="24" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Deferred forkserver</text><rect x="210" y="50" width="170" height="36" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="295.0" y="60.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">init once</text><text x="295.0" y="75.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">(expensive)</text><line x1="295.0" y1="86.0" x2="295.0" y2="83.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="90" width="170" height="28" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="295.0" y="104.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">checkpoint</text><line x1="295.0" y1="118.0" x2="295.0" y2="115.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="122" width="170" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="295.0" y="136.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">fork</text><line x1="295.0" y1="150.0" x2="295.0" y2="147.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="154" width="170" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="295.0" y="168.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run</text><line x1="295.0" y1="182.0" x2="295.0" y2="179.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="186" width="170" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="295.0" y="200.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">wait</text><line x1="295.0" y1="214.0" x2="295.0" y2="211.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="218" width="170" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="295.0" y="232.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">fork</text><line x1="295.0" y1="246.0" x2="295.0" y2="243.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="250" width="170" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="295.0" y="264.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">run</text><rect x="415" y="30" width="215" height="230" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/><text x="522.5" y="24" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#3a1a5a" font-weight="500">Persistent mode</text><rect x="425" y="50" width="195" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="522.5" y="64.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">init once</text><line x1="522.0" y1="78.0" x2="522.0" y2="75.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="425" y="82" width="195" height="36" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="522.5" y="92.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">checkpoint</text><text x="522.5" y="107.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">fork once</text><line x1="522.0" y1="118.0" x2="522.0" y2="115.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="425" y="122" width="195" height="28" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="522.5" y="136.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">loop iter 1</text><line x1="522.0" y1="150.0" x2="522.0" y2="147.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="425" y="154" width="195" height="28" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="522.5" y="168.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">loop iter 2</text><line x1="522.0" y1="182.0" x2="522.0" y2="179.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="425" y="186" width="195" height="28" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="522.5" y="200.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">loop iter 3</text><line x1="522.0" y1="214.0" x2="522.0" y2="211.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="425" y="218" width="195" height="36" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="522.5" y="228.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">loop iter N</text><text x="522.5" y="243.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">then exit</text></svg>
<div class="afl-fig-caption">Three execution models compared: each eliminates a different component of per-execution overhead.</div>
</div>
</div>

#### The state reset problem, what breaks and why

Persistent mode's only real cost is correctness discipline. Every piece of state the fuzz target touches must return to a clean baseline before the next iteration. Anything that doesn't reset causes two problems:

**Non-determinism:** The second execution of input X is not identical to the first, because some state left over from the previous input changes the behaviour. AFL's stability metric drops. Coverage signals become noise. The campaign appears to find new coverage when it's just seeing the same input produce different results due to accumulated state.

**Silent memory corruption:** State from one iteration corrupts the heap for the next. Bugs get masked (the corrupted state hides a crash) or false bugs appear (clean inputs crash due to prior corruption). Both are worse than just finding real bugs.

Concrete examples of what breaks:

```c
// BREAKS: static buffer never cleared
static char error_msg[256];
void fuzz_target(uint8_t *buf, size_t len) {
    if (len < 4) {
        strcpy(error_msg, "too short");  // set on iter 1
        return;
    }
    // iter 2 with len>=4: error_msg still says "too short" from iter 1
    // if code later checks error_msg, it reads stale state
}

// FIX:
    memset(error_msg, 0, sizeof(error_msg));  // reset at top of each iteration
```

```c
// BREAKS: heap allocation never freed
void fuzz_target(uint8_t *buf, size_t len) {
    char *tmp = malloc(len + 1);
    memcpy(tmp, buf, len);
    parse(tmp);
    // forgot free(tmp) — leaks every iteration
    // after 1000 iterations: 1000 * avg_input_size bytes leaked
    // heap fragmentation grows, addresses change, coverage changes spuriously
}

// FIX:
    free(tmp);  // always, even on error paths
```

```c
// BREAKS: file descriptor leak
void fuzz_target(uint8_t *buf, size_t len) {
    int fd = open("/tmp/testfile", O_RDWR | O_CREAT, 0644);
    write(fd, buf, len);
    parse_from_fd(fd);
    // forgot close(fd)
    // after 1024 iterations: EMFILE, all subsequent opens fail
    // target behaviour changes completely — false stability drop
}

// FIX:
    close(fd);
```

```c
// BREAKS: global counter never reset
static int parse_depth = 0;
void recursive_parser(uint8_t *buf, size_t len, int depth) {
    parse_depth = depth;  // set during recursion
    // ...
}
void fuzz_target(uint8_t *buf, size_t len) {
    recursive_parser(buf, len, 0);
    // parse_depth left at whatever the deepest recursion was
    // next iteration: parse_depth starts non-zero, changes branch behaviour
}

// FIX:
    parse_depth = 0;  // reset before each call
```

The diagnostic: if `stability` in the stats panel drops below 95%, open the `fuzzer_stats` file and look at `stability` directly. Then add `ASAN_OPTIONS=detect_leaks=1` and run the target manually in a loop, the first leak or UAF that shows up is usually the stability culprit.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="300" viewBox="0 0 680 300" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="260" y="10" width="160" height="34" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="340.0" y="27.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">stability < 95%</text><line x1="340.0" y1="44.0" x2="340.0" y2="63.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="230" y="70" width="220" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="340.0" y="79.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">What changed between</text><text x="340.0" y="94.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">iterations?</text><line x1="340.0" y1="104.0" x2="92.0" y2="133.2" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="134" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="85.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Global/static</text><text x="85.0" y="161.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">vars not reset</text><line x1="85.0" y1="174.0" x2="85.0" y2="193.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="30" y="200" width="110" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="85.0" y="212.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">memset/reset</text><text x="85.0" y="227.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">at loop top</text><line x1="340.0" y1="104.0" x2="221.8" y2="132.4" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="160" y="134" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="215.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Heap allocs</text><text x="215.0" y="161.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">not freed</text><line x1="215.0" y1="174.0" x2="215.0" y2="193.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="160" y="200" width="110" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="215.0" y="212.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">ASAN detect_leaks</text><text x="215.0" y="227.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">or valgrind</text><line x1="340.0" y1="104.0" x2="343.8" y2="127.1" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="290" y="134" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="345.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">File descriptors</text><text x="345.0" y="161.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">not closed</text><line x1="345.0" y1="174.0" x2="345.0" y2="193.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="290" y="200" width="110" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="345.0" y="212.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">check open()</text><text x="345.0" y="227.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">vs close()</text><line x1="340.0" y1="104.0" x2="468.2" y2="132.5" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="420" y="134" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="475.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Signal handlers</text><text x="475.0" y="161.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">/ errno</text><line x1="475.0" y1="174.0" x2="475.0" y2="193.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="420" y="200" width="110" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="475.0" y="212.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">reset errno=0</text><text x="475.0" y="227.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">reinstall</text><line x1="340.0" y1="104.0" x2="608.0" y2="133.2" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="560" y="134" width="110" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="615.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Library state</text><text x="615.0" y="161.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">not reset</text><line x1="615.0" y1="174.0" x2="615.0" y2="193.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="560" y="200" width="110" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="615.0" y="212.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">call reset API</text><text x="615.0" y="227.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">or reinitialize</text></svg>
<div class="afl-fig-caption">Stability diagnosis tree: each category of non-determinism has a distinct remediation.</div>
</div>
</div>

### Throughput comparison

| Mode                  | Typical exec/sec | Notes                                            |
| --------------------- | ---------------- | ------------------------------------------------ |
| Naive exec per input  | 50-200           | Full init cost every time                        |
| Forkserver only       | 500-2000         | Init once, fork per input                        |
| Deferred forkserver   | 1000-4000        | Fork after expensive init                        |
| Persistent mode       | 4000-20000       | No fork in inner loop                            |
| Persistent + deferred | 8000-50000       | Best of both, model loaded once, no fork in loop |

---

## 6. Corpus Scoring and Energy

As a campaign runs, the corpus grows fast. Three seeds can become 10,000 entries in 24 hours. Not all of those entries deserve equal attention. AFL++ allocates fuzzing time, what it calls **energy**, using a scoring system. Getting this right is the difference between a campaign that finds deep bugs and one that just cycles through the same surface-level paths forever.

### The favoured set, greedy set cover

AFL++ continuously maintains a **favoured set**: the smallest subset of the corpus that collectively covers every known edge. Entries outside that set get far less attention.

```
1. Score all entries: execution_time_μs × file_size_bytes
   (penalises slow, bloated inputs)

2. Sort by score ascending (cheapest first)

3. Greedily pick the cheapest entry covering at least one uncovered edge
   Mark those edges covered

4. Repeat until all edges covered

5. Everything not selected → non-favoured (fuzzed at lower rate)
```

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="232" viewBox="0 0 600 232" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="250" height="180" rx="3" fill="none" stroke="#9a9690" stroke-width="1" stroke-dasharray="5,3"/><text x="135.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#4a4640" font-weight="500">Corpus candidates</text><rect x="20" y="52.0" width="230" height="28" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="135.0" y="66.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">input_A  edges 1-5  cost 5000  (dropped)</text><rect x="20" y="88.0" width="230" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="135.0" y="102.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_B  edges 1,2,3  cost 1000</text><rect x="20" y="124.0" width="230" height="28" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="135.0" y="138.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">input_C  edges 4,5,6,7  cost 2400</text><rect x="20" y="160.0" width="230" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="135.0" y="174.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_D  edges 6,7  cost 300</text><rect x="20" y="196.0" width="230" height="28" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="135.0" y="210.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">input_E  (dropped — redundant)</text><line x1="260.0" y1="122.0" x2="323.0" y2="122.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="295.0" y="134.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">greedy
set cover</text><rect x="330" y="32.0" width="260" height="180" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="460.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Favoured set</text><rect x="340" y="62.0" width="240" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="460.0" y="76.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_D: edges 6,7 (cheapest)</text><rect x="340" y="102.0" width="240" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="460.0" y="116.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_B: edges 1,2,3</text><rect x="340" y="142.0" width="240" height="28" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="460.0" y="156.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">input_C: edges 4,5 (remaining)</text><text x="460" y="192.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#5a8a5a">100% coverage retained</text></svg>
<div class="afl-fig-caption">Greedy set cover: cheapest inputs covering all edges selected; redundant inputs discarded.</div>
</div>
</div>

This is exactly what `afl-cmin` does when you run it manually. We'll get to that shortly.

### Power schedules

| Schedule  | Behaviour                                     | Best for                        |
| --------- | --------------------------------------------- | ------------------------------- |
| `explore` | Balanced, default                             | General purpose                 |
| `fast`    | Less time per entry, faster cycles            | Large corpora                   |
| `exploit` | More time on recently-productive entries      | Doubling down on hot paths      |
| `rare`    | Prioritises entries covering rarely-hit edges | Finding bugs in cold paths      |
| `mmopt`   | Time-weighted moving average of recent finds  | Balance between exploit/explore |
| `coe`     | High energy on non-havoc-generated entries    | When havoc dominates            |

For parallel campaigns, assign different schedules to different instances. The main instance uses `explore`, secondaries cycle through `fast`, `rare`, and `exploit`. They'll each push on different parts of the corpus and sync their findings.

### afl-cmin, corpus minimisation

After a long campaign the queue directory gets unwieldy. You might have 10,000 inputs, but the majority of them are redundant, covering edges already covered by smaller, faster inputs discovered earlier. Running a new campaign on all 10,000 wastes time and slows every cycle. `afl-cmin` solves this by running the same greedy set-cover algorithm AFL++ uses internally, as a standalone pass over your whole corpus, throwing out everything that doesn't add unique coverage.

The result is a corpus that covers 100% of the edges the original covered, in a fraction of the entries. Typical reduction: 10,000 inputs down to 200-500. The next campaign starts lean and cycles fast.

#### How afl-cmin works internally

afl-cmin doesn't guess. For each input in the corpus it actually executes the target binary and captures its full 64KB coverage bitmap. It runs every file. Then it applies the greedy set-cover:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="460" viewBox="0 0 500 460">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
  </defs>

  <rect x="120" y="16" width="260" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="250" y="33" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">Load all inputs from -i</text>

  <line x1="250" y1="50" x2="250" y2="70" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="100" y="76" width="300" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="250" y="91" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Execute each input</text>
  <text x="250" y="107" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">capture 64KB bitmap</text>

  <line x1="250" y1="116" x2="250" y2="136" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="100" y="142" width="300" height="34" rx="3" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="250" y="159" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">Build edge→input map</text>

  <line x1="250" y1="176" x2="250" y2="196" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="100" y="202" width="300" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="250" y="219" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">Score: exec_time × file_size</text>

  <line x1="250" y1="236" x2="250" y2="256" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="100" y="262" width="300" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="250" y="279" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">Sort by score ascending</text>

  <line x1="250" y1="296" x2="250" y2="316" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: Uncovered edges remain? centred at 250,338 -->
  <polygon points="250,314 345,338 250,362 155,338" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="250" y="331" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Uncovered</text>
  <text x="250" y="347" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">edges remain?</text>

  <!-- yes → down -->
  <line x1="250" y1="362" x2="250" y2="382" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="238" y="376" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>

  <!-- Pick cheapest -->
  <rect x="100" y="388" width="300" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="250" y="405" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">Pick cheapest input covering ≥1 new edge</text>

  <!-- loop back dashed arc right side -->
  <path d="M400,405 C460,405 460,338 345,338" fill="none" stroke="#2d2a26" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#ah)"/>
  <text x="468" y="375" text-anchor="start" font-family="'EB Garamond',Georgia,serif" font-size="9" font-style="italic" fill="#6b6860">loop</text>

  <!-- no → left → Write -o directory -->
  <line x1="155" y1="338" x2="112" y2="338" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="131" y="328" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <rect x="16" y="318" width="90" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="61" y="333" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#1e3060">Write -o dir</text>
  <text x="61" y="349" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#1e3060">discard rest</text>
</svg>
<div class="afl-fig-caption">afl-cmin internal algorithm: execute all inputs, then greedy set-cover by cost.</div>
</div>
</div>

The key thing: `afl-cmin` doesn't reason about which inputs exist in the abstract, it runs them. An input found early in the campaign that covers edges 1-50 might be 40KB. A later input covering those same edges plus edges 51-60 might be 200 bytes. `afl-cmin` picks the 200-byte one and drops the 40KB one completely. Both size and execution time feed into the score.

#### Why the order matters: an example

Say you have these five inputs after a 24-hour campaign:

```
input_001  covers edges {A,B,C,D,E}        size: 8KB   exec: 12ms   score: 98304
input_047  covers edges {A,B,C}            size: 200B  exec: 1ms    score:   200
input_203  covers edges {D,E,F,G}          size: 400B  exec: 2ms    score:   800
input_891  covers edges {F,G}              size: 100B  exec: 0.5ms  score:    50
input_992  covers edges {A,B,C,D,E,F,G,H}  size: 1KB   exec: 5ms    score:  5120
```

Sorted by score: `891 (50)` → `047 (200)` → `203 (800)` → `992 (5120)` → `001 (98304)`

Greedy walk:

- Pick `input_891`: covers {F,G}. Covered so far: {F,G}
- Pick `input_047`: covers {A,B,C}, all new. Covered: {A,B,C,F,G}
- Pick `input_203`: covers {D,E,F,G}. D,E are new. Covered: {A,B,C,D,E,F,G}
- Pick `input_992`: covers {H}, which is new. Covered: {A,B,C,D,E,F,G,H}
- `input_001` covers nothing new, dropped.

Final corpus: 4 inputs instead of 5, total size dropped from ~10KB to ~1.7KB, and `input_001` (the biggest, slowest one) is gone even though it had the broadest raw coverage.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="258" viewBox="0 0 620 258" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="260" height="210" rx="3" fill="none" stroke="#c07070" stroke-width="1" stroke-dasharray="5,3"/><text x="140.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#5a2020" font-weight="500">Before afl-cmin — 5 inputs</text><rect x="18" y="52.0" width="244" height="28" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="140.0" y="66.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">input_001  8KB   score 98304  A-E</text><rect x="18" y="88.0" width="244" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="140.0" y="102.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_047  200B  score 200    A,B,C</text><rect x="18" y="124.0" width="244" height="28" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="140.0" y="138.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">input_203  400B  score 800    D,E,F,G</text><rect x="18" y="160.0" width="244" height="28" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="140.0" y="174.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_891  100B  score 50     F,G</text><rect x="18" y="196.0" width="244" height="28" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="140.0" y="210.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">input_992  1KB   score 5120   A-H</text><line x1="270.0" y1="138.0" x2="333.0" y2="138.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="305.0" y="150.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">afl-cmin</text><rect x="340" y="32.0" width="270" height="210" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="475.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">After afl-cmin — 4 inputs</text><rect x="348" y="52.0" width="254" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="475.0" y="69.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_891 — edges F,G    (cost 50)</text><rect x="348" y="98.0" width="254" height="34" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="475.0" y="115.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">input_047 — edges A,B,C  (cost 200)</text><rect x="348" y="144.0" width="254" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="475.0" y="161.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">input_203 — edges D,E    (cost 800)</text><rect x="348" y="190.0" width="254" height="34" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="475.0" y="207.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">input_992 — edge H       (cost 5120)</text><text x="310" y="256.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#c07070">input_001 dropped — all edges covered by cheaper entries</text></svg>
<div class="afl-fig-caption">afl-cmin in practice: 5 inputs reduced to 4 with identical edge coverage.</div>
</div>
</div>

#### When to run afl-cmin

```bash
# Standard usage — minimise queue before starting a new campaign:
afl-cmin \
  -i findings/main/queue/ \
  -o corpus-min/ \
  -- ./build-afl/bin/afl-tokenizer @@

# With a timeout per execution (useful if some inputs cause slow paths):
afl-cmin \
  -i findings/main/queue/ \
  -o corpus-min/ \
  -t 500 \
  -- ./build-afl/bin/afl-tokenizer @@

# After merging output from multiple parallel instances:
afl-cmin \
  -i findings/fuzzer01/queue/ \
  -i findings/fuzzer02/queue/ \
  -i findings/fuzzer03/queue/ \
  -o corpus-min/ \
  -- ./build-afl/bin/afl-tokenizer @@
```

Run `afl-cmin` before seeding a new campaign from a previous run's queue, after merging outputs from parallel instances, and any time your corpus has grown past around 5,000 entries and you can see cycle time creeping up.

Don't run it during an active campaign. `afl-cmin` is a preprocessing and postprocessing tool. Running it while AFL is active will discard entries AFL is in the middle of fuzzing and break the coverage accounting.

#### What afl-cmin does NOT do

`afl-cmin` only removes redundant whole inputs. It does not shrink individual files. An 8KB input that is the sole entry covering edge X stays in the corpus at full 8KB. Shrinking individual files is `afl-tmin`'s job.

The two tools complement each other:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="100" viewBox="0 0 760 100">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
  </defs>

  <rect x="10" y="22" width="130" height="46" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="75" y="40" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">findings/queue/</text>
  <text x="75" y="57" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">10,000 inputs</text>

  <line x1="140" y1="45" x2="165" y2="45" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="171" y="22" width="130" height="46" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="236" y="40" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">afl-cmin</text>
  <text x="236" y="57" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">remove redundant</text>

  <line x1="301" y1="45" x2="326" y2="45" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="332" y="22" width="130" height="46" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="397" y="40" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">corpus-min/</text>
  <text x="397" y="57" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">300 inputs</text>

  <line x1="462" y1="45" x2="487" y2="45" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="493" y="22" width="130" height="46" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="558" y="40" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">afl-tmin</text>
  <text x="558" y="57" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">per-file shrink</text>

  <line x1="623" y1="45" x2="648" y2="45" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <rect x="654" y="22" width="96" height="46" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="702" y="40" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">seed corpus</text>
  <text x="702" y="57" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">300 small</text>
</svg>
<div class="afl-fig-caption">Corpus preparation pipeline: afl-cmin removes redundant files; afl-tmin shrinks each survivor.</div>
</div>
</div>

Running both tools in sequence gives you a corpus that's minimal in count (courtesy of afl-cmin) and minimal in per-file size (courtesy of afl-tmin). On a long parser campaign this can take you from 10,000 inputs averaging 20KB each down to 300 inputs averaging 150 bytes each, with identical edge coverage. The next campaign cycles through that corpus 30 to 50 times faster.

---

### afl-tmin, single-file minimisation

`afl-tmin` takes a single input file and binary-searches it down to the smallest possible byte sequence that still triggers the exact same behavior: same coverage bitmap for a queue entry, same crash signal for a crash file.

#### The algorithm

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="390" viewBox="0 0 620 390">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
    <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#888480"/></marker>
  </defs>

  <!-- Load input file -->
  <rect x="190" y="16" width="240" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="310" y="33" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">Load input file — N bytes</text>

  <line x1="310" y1="50" x2="310" y2="70" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Try removing top half -->
  <rect x="185" y="76" width="250" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="310" y="91" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">Try removing top half</text>
  <text x="310" y="107" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">bytes 0..N/2</text>

  <line x1="310" y1="116" x2="310" y2="136" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: Same crash? centred at 310,158 -->
  <polygon points="310,134 400,158 310,182 220,158" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="310" y="152" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Same crash /</text>
  <text x="310" y="166" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">coverage?</text>

  <!-- yes → left → Keep smaller -->
  <line x1="220" y1="158" x2="170" y2="158" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="193" y="148" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="50" y="142" width="114" height="32" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="107" y="155" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#2a4a2a">Keep smaller</text>
  <text x="107" y="169" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#2a4a2a">N = N/2</text>

  <!-- no → right → Restore -->
  <line x1="400" y1="158" x2="450" y2="158" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="427" y="148" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <rect x="456" y="142" width="140" height="32" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="526" y="155" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#5a3800">Restore — try</text>
  <text x="526" y="169" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#5a3800">bottom half</text>

  <!-- repeat label + down arrow -->
  <line x1="310" y1="182" x2="310" y2="202" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="298" y="196" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">repeat</text>

  <!-- Byte-level cleanup -->
  <rect x="185" y="208" width="250" height="40" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="310" y="223" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">Byte-level cleanup pass</text>
  <text x="310" y="239" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">try zeroing each byte</text>

  <line x1="310" y1="248" x2="310" y2="268" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Diamond: Zero byte still triggers? centred at 310,290 -->
  <polygon points="310,266 400,290 310,314 220,290" fill="#ffffff" stroke="#2d2a26" stroke-width="1.2"/>
  <text x="310" y="283" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">Zero byte still</text>
  <text x="310" y="297" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#4a4640">triggers same?</text>

  <!-- yes → left → Keep zero -->
  <line x1="220" y1="290" x2="170" y2="290" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="193" y="280" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">yes</text>
  <rect x="50" y="274" width="114" height="32" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="107" y="287" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#2a4a2a">Keep zero</text>
  <text x="107" y="301" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#2a4a2a">value irrelevant</text>

  <!-- loop-back dashed arc: from Keep zero back up to Byte-level cleanup -->
  <path d="M50,290 C20,290 20,228 185,228" fill="none" stroke="#888480" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#ah-gray)"/>

  <!-- no → right → Restore original -->
  <line x1="400" y1="290" x2="450" y2="290" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="427" y="280" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">no</text>
  <rect x="456" y="274" width="140" height="32" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="526" y="287" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#5a3800">Restore original</text>
  <text x="526" y="301" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#5a3800">byte matters</text>

  <!-- all bytes done → down to Write -->
  <line x1="310" y1="314" x2="310" y2="334" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>
  <text x="298" y="328" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">all bytes done</text>

  <!-- Write minimised file -->
  <rect x="185" y="340" width="250" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.4"/>
  <text x="310" y="357" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">Write minimised file to -o</text>
</svg>
<div class="afl-fig-caption">afl-tmin: binary search over structure, then byte-level value minimisation.</div>
</div>
</div>

Two passes. The first is a binary search over structure: it finds which regions of the input can be removed entirely while keeping the crash or coverage intact. The second is a byte-level cleanup: for each byte that survived the first pass, it tries replacing it with `0x00`. If the behavior is still the same, the value was irrelevant and gets zeroed. This is why minimized crash files so often look like a handful of meaningful bytes surrounded by null padding.

#### Why minimisation matters for triage

An unminimised crash file is often noisy. It might contain valid file headers, metadata sections, padding, and the actual triggering bytes all mixed together. That makes it hard to see what the parser is actually reacting to.

After `afl-tmin`, you have just the essential bytes. A 50KB GGUF file that crashed the tokenizer might reduce to 12 bytes: a 4-byte magic, a 2-byte version, and 6 bytes of payload that trigger the overflow. That's the bug, right there, no noise.

```bash
# Minimise a crash file:
afl-tmin \
  -i findings/main/crashes/id:000000,sig:06 \
  -o crash-min.in \
  -- ./build-afl/bin/afl-tokenizer @@

# Minimise a queue entry (preserves coverage, not crash):
afl-tmin \
  -i findings/main/queue/id:001234 \
  -o queue-min.in \
  -- ./build-afl/bin/afl-tokenizer @@

# Check what you got:
wc -c crash-min.in          # byte count
xxd crash-min.in | head     # hex dump — triggering bytes are now obvious
```

#### tmin output interpretation

```
       File size reduced by : 99.98% (51200 -> 9 bytes)
afl-tmin: trace bytes     : 6/10 preserved (60.0%)
```

`trace bytes` tells you how many of the original coverage edges are still triggered by the minimised file. 60% is normal, minimisation removes the bytes that exercise irrelevant code paths, keeping only the path that leads to the crash. If it drops to 0% the minimisation failed and the crash is non-deterministic.

#### Using tmin output in a bug report

The minimized file has two lives. First, it makes the root cause immediately obvious in code review: the triggering bytes are right there in plain sight. Second, it's the reproducer for your bug report. Maintainers can run `./binary crash-min.in` and get a clean ASan stack trace without any setup. Compare that to attaching a 50KB binary blob with instructions like 'this crashes sometimes on build X'. Nobody is touching that.

---

## 7. AddressSanitizer

Without a sanitizer, a huge fraction of the bugs AFL finds are invisible. A heap overflow writing 4 bytes past the end of an allocation might land in unused padding and not crash immediately. The program keeps running, silently corrupts adjacent state, and eventually dies hundreds of instructions later in an unrelated `free()`. AFL saves the crash, but you have no idea where the actual bug is. Worse, sometimes it never crashes at all.

ASan changes that completely. It makes bugs crash **immediately at the exact bad instruction**.

### Shadow memory architecture

ASan maintains a parallel shadow memory region alongside the program's normal address space. For every 8 bytes of application memory, one shadow byte tracks how many of those 8 bytes are currently valid. The shadow address for any pointer is a single arithmetic operation, which is what keeps the overhead manageable.

Every memory access in the instrumented binary becomes a checked version:

```c
// original:
v = *ptr;

// ASan-instrumented:
shadow = ((uintptr_t)ptr >> 3) + SHADOW_OFFSET;
if (*shadow != 0) {
    __asan_report_load(ptr, sizeof(v));  // crash at this exact line
}
v = *ptr;
```

### Red zones and quarantine

**Without ASan**, overflow silently corrupts adjacent memory:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="138" viewBox="0 0 500 138" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><text x="10" y="26.0" font-family="'EB Garamond',Georgia,serif" font-size="12" font-variant="small-caps" fill="#6b6860">Without ASan:</text><rect x="10" y="34.0" width="100" height="40" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="60.0" y="54.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">chunk header</text><rect x="118" y="34.0" width="140" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="188.0" y="54.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">your 16 bytes</text><rect x="266" y="34.0" width="140" height="40" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="336.0" y="46.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">next allocation</text><text x="336.0" y="61.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">(adjacent memory)</text><path d="M258,38.0 C258,18.0 276,18.0 276,34.0" fill="none" stroke="#c07070" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#ah)"/><text x="265" y="16.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" fill="#c07070">overflow →</text><text x="10" y="98.0" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#9a4040" font-style="italic">Silent corruption of adjacent memory — crash occurs elsewhere, cause unknown.</text></svg>
<div class="afl-fig-caption">Heap layout without ASan: overflow silently corrupts adjacent allocations.</div>
</div>
</div>

**With ASan red zones**, overflow hits poisoned memory, crash at the exact instruction:

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="138" viewBox="0 0 560 138" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><text x="10" y="26.0" font-family="'EB Garamond',Georgia,serif" font-size="12" font-variant="small-caps" fill="#6b6860">With ASan red zones:</text><rect x="10" y="34.0" width="80" height="40" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="50.0" y="46.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">RED ZONE</text><text x="50.0" y="61.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">(poisoned)</text><rect x="98" y="34.0" width="140" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="168.0" y="54.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">your 16 bytes</text><rect x="246" y="34.0" width="80" height="40" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="286.0" y="46.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">RED ZONE</text><text x="286.0" y="61.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">(poisoned)</text><rect x="334" y="34.0" width="140" height="40" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="404.0" y="54.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">next allocation</text><path d="M238,38.0 C238,16.0 254,16.0 254,34.0" fill="none" stroke="#c07070" stroke-width="1.5" marker-end="url(#ah)"/><text x="245" y="14.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" fill="#c07070">byte 17</text><text x="10" y="98.0" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#5a8a5a" font-style="italic">Shadow check fires immediately at the offending instruction — exact line reported.</text></svg>
<div class="afl-fig-caption">Heap layout with ASan: red zones cause immediate crash at the out-of-bounds access.</div>
</div>
</div>

When `free()` is called, ASan doesn't hand the memory back to the allocator immediately. Freed chunks sit in a **quarantine queue** with their shadow memory marked poisoned. Any access to quarantined memory immediately fires a use-after-free report. Without quarantine, a UAF can silently succeed right up until the memory gets reallocated for something else.

### Reading an ASan error report

```
==12345==ERROR: AddressSanitizer: heap-buffer-overflow
│                                  └─ bug class (heap-buffer-overflow = serious)
├─ process ID (12345)

WRITE of size 4 at 0x602000001a50 thread T0
│                  └─ exact virtual address of the bad access
├─ WRITE = memory was modified (more serious than READ)
└─ size 4 = 4 bytes written out of bounds

    #0 0x55f2a in llama_tokenize  src/llama.cpp:4521  ← FIX GOES HERE
    #1 0x55f2b in main  tests/afl-tokenizer.cpp:38    ← how it was called

0x602000001a50 is located 0 bytes to the right of 16-byte region
│                                   ↑ off by exactly one byte
│                                               └─ buffer was exactly 16 bytes
[0x602000001a40, 0x602000001a50)
└─ exact address range of the allocation

allocated by thread T0:
    #0 malloc
    #1 gguf_parse  src/gguf.cpp:892  ← ALLOCATION SITE (buffer created here)
```

One report and you have everything: the bug class, the exact line to fix, how big the buffer was, and where it was originally allocated. ASan hands you the answer.

### Crash type severity

| ASan error                   | Severity                | Typical root cause                             |
| ---------------------------- | ----------------------- | ---------------------------------------------- |
| `heap-buffer-overflow WRITE` | Critical, potential RCE | Missing bounds check on user-controlled length |
| `heap-buffer-overflow READ`  | High, info disclosure   | Off-by-one in parser loop                      |
| `heap-use-after-free`        | Critical, potential RCE | Dangling pointer after free                    |
| `stack-buffer-overflow`      | Critical                | Fixed-size stack buffer + variable input       |
| `global-buffer-overflow`     | High                    | Static array with variable index               |
| `SEGV on null (0x0)`         | Low, DoS only           | Missing null check                             |
| `memory leak`                | Low                     | Ownership confusion, may co-locate with UAF    |

---

## 8. Crash Triage Pipeline

Seeing that `saved crashes` counter tick above zero is exciting, but it's the beginning of the work, not the end. What you have is a file that reproducibly crashes your target. Triage is how you turn that raw file into a root cause.

AFL names crash files like `id:000000,sig:06,src:000003,op:havoc,rep:4`, encoding the crash number, the signal, the source corpus entry, the mutation stage, and how many times it reproduced. AFL deduplicates by signal and the top two stack frames, but that's a coarse filter. Multiple crash files often represent the same underlying bug triggered via different paths.

### Full triage pipeline

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="460" viewBox="0 0 520 460">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
    <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#888480"/></marker>
  </defs>

  <!-- crash file -->
  <rect x="60" y="16" width="400" height="48" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.4"/>
  <text x="260" y="33" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a2020">crash file in findings/crashes/</text>
  <text x="260" y="51" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a2020">id:000000,sig:06,src:...</text>

  <line x1="260" y1="64" x2="260" y2="86" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Step 1 -->
  <rect x="60" y="92" width="400" height="48" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="260" y="109" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">Step 1 — afl-tmin</text>
  <text x="260" y="127" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">shrink to smallest reproducer: 50KB → 12 bytes</text>

  <line x1="260" y1="140" x2="260" y2="162" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Step 2 -->
  <rect x="60" y="168" width="400" height="48" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="260" y="185" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#3a1a5a">Step 2 — ASan symbolised replay</text>
  <text x="260" y="203" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">crash type, file, line number</text>

  <line x1="260" y1="216" x2="260" y2="238" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Step 3 -->
  <rect x="60" y="244" width="400" height="48" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="260" y="261" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">Step 3 — verify on clean build</text>
  <text x="260" y="279" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">confirm bug exists without AFL instrumentation</text>

  <line x1="260" y1="292" x2="260" y2="314" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- Step 4 -->
  <rect x="60" y="320" width="400" height="48" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="260" y="337" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">Step 4 — read ASan report</text>
  <text x="260" y="355" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">bug class + location + allocation site → fix</text>

  <!-- dashed arrow to step 5 -->
  <line x1="260" y1="368" x2="260" y2="390" stroke="#888480" stroke-width="1.3" stroke-dasharray="5,3" marker-end="url(#ah-gray)"/>

  <!-- Step 5 -->
  <rect x="60" y="396" width="400" height="48" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/>
  <text x="260" y="413" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#4a4640">Step 5 — GDB</text>
  <text x="260" y="431" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#4a4640">only if ASan report is insufficient</text>
</svg>
<div class="afl-fig-caption">Crash triage pipeline: minimise, symbolise, verify, root-cause, GDB as last resort.</div>
</div>
</div>

### Step 1, Minimise with afl-tmin

```bash
afl-tmin \
  -i findings/main/crashes/id:000000 \
  -o crash-min.in \
  -- ./build-afl/bin/afl-tokenizer @@
```

It binary-searches through the crash file: remove half, check if the crash still fires with the same signal, keep the smaller version if yes, repeat. It also tries zeroing byte ranges. A 50KB crash file typically reduces to 12 to 200 bytes. The triggering pattern becomes immediately obvious.

### Step 2, Replay with symbolised ASan

```bash
ASAN_OPTIONS=symbolize=1:detect_leaks=1:abort_on_error=1 \
  ./build-afl/bin/afl-tokenizer crash-min.in 2>&1 | head -50
```

Requires the binary to be compiled with `-g`. It maps raw addresses to function names, file names, and line numbers.

### Step 3, Verify on clean build

```bash
# Build without AFL instrumentation, ASan only:
clang++ -fsanitize=address -g -O1 \
  tests/afl-tokenizer.cpp -o target-clean [other sources]

ASAN_OPTIONS=symbolize=1 ./target-clean crash-min.in
```

This step confirms the bug exists in production code, not just in the AFL-instrumented build. It also gives you a clean reproducer suitable for a bug report.

### Step 4, Root cause from the report

```
From the ASan output you immediately know:
  bug class     → severity (WRITE overflow = potential RCE)
  crash line    → llama.cpp:4521 — where to fix
  alloc site    → gguf.cpp:892 allocated 16 bytes
  overflow size → 0 bytes past end = off-by-one

Classic pattern:
  alloc:  size = header->count * sizeof(uint32_t);  // count is attacker-controlled
          buf  = malloc(size);
  crash:  for (int i = 0; i <= count; i++) {        // should be i < count
              buf[i] = process(token[i]);            // writes one past the end
          }
```

### Step 5, GDB (only when ASan is insufficient)

```bash
gdb --args ./target-clean crash-min.in

(gdb) run               # run to the crash
(gdb) bt                # full call stack — always do this first
(gdb) frame 2           # jump to your code (skip system library frames)
(gdb) info locals       # all local variables at this frame
(gdb) p buf             # print the buffer pointer value
(gdb) p len             # print the length that was passed
(gdb) x/32xb buf        # hex dump 32 bytes starting at buf
```

Reach for GDB only when the crash lands inside a system library like `memcpy` or `strlen` and you need the call stack above it, or when you need to inspect variable values to understand how a size computation went wrong. In most cases ASan's report is sufficient.

---

## Appendix, Reading the AFL++ Stats Panel

```
AFL ++4.40c {main} (...bin/afl-tokenizer) [explore]
┌─ process timing ──────────────────────┬─ overall results ────────────┐
│        run time : 0 days, 0 hrs, 3min │  cycles done : 24            │
│   last new find : 0 days, 0 hrs, 0min │  corpus count : 405          │
│ last saved crash: none seen yet       │  saved crashes : 0           │
│  last saved hang: none seen yet       │   saved hangs  : 0           │
├─ cycle progress ──────────────────────┼─ map coverage ───────────────┤
│  now processing : 270·18 (66.7%)      │  map density : 0.29% / 0.36% │
│  runs timed out : 0 (0.00%)           │ count coverage : 5.68 b/t    │
├─ stage progress ──────────────────────┼─ findings in depth ──────────┤
│       now trying: havoc               │  favored items : 19 (4.69%)  │
│    stage execs  : 91/100 (91.00%)     │    new edges on : 31 (7.65%) │
│    total execs  : 168k                │  total crashes : 0           │
│     exec speed  : 4637/sec ✓          │   total tmouts : 10          │
├─ fuzzing strategy yields ─────────────┼─ item geometry ──────────────┤
│       bit flips : 10/264, 6/263       │         levels : 4           │
│      byte flips : 0/33,  4/32         │         pending: 7           │
│     arithmetics : 3/2094, 1/2388      │        pend fav: 0           │
│      known ints : 1/244,  1/1066      │       own finds: 269         │
│      dictionary : 27/736, 33/850 ✓    │       imported : 133         │
│    havoc/splice : 152/151k            │       stability: 99.57% ✓    │
└───────────────────────────────────────┴──────────────────────────────┘
```

| Metric          | What it means                        | Good value                                  |
| --------------- | ------------------------------------ | ------------------------------------------- |
| `exec speed`    | Executions per second                | >2000 with ASan persistent mode             |
| `cycles done`   | Full passes through corpus           | Higher = more mature campaign               |
| `map density`   | % of 64KB bitmap populated           | Low (< 1%) is normal for targeted harnesses |
| `stability`     | Same input → same coverage %         | > 95%, below this = non-determinism problem |
| `dictionary`    | tries/interesting for dict mutations | Non-zero interesting = dict is contributing |
| `favored items` | Minimal set covering all edges       | Smaller = more efficient campaign           |
| `total tmouts`  | Inputs exceeding timeout             | Small number ok; large number = investigate |
| `pending`       | Favoured items not yet fully fuzzed  | 0 = all frontier inputs explored once       |

---

## 9. Parallel Fuzzing Architecture

Running a single AFL++ instance on a multi-core machine is leaving performance on the table. AFL++ is embarrassingly parallelizable. Each instance runs independently against the same target binary and shares findings through a lightweight filesystem sync mechanism. On a 16-core machine you should be running 16 instances. On a 64-core machine, 64. Throughput scales roughly linearly with core count for most targets.

### Master and secondary instances

AFL++ parallel mode has two roles: one **master** (`-M`) and any number of **secondaries** (`-S`).

```bash
# Master instance — runs deterministic stages
afl-fuzz -M fuzzer01 -i corpus/ -o findings/ -- ./target @@

# Secondary instances — skip deterministic, run havoc/splice only
afl-fuzz -S fuzzer02 -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer03 -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer04 -i corpus/ -o findings/ -- ./target @@
```

The distinction between master and secondary matters. The master runs all the deterministic stages (bit flips, arithmetics, known integers) on each corpus entry before moving to havoc. Secondaries skip straight to havoc with randomized seeds. You only ever want **one master**. Running deterministic stages on two instances simultaneously is pure duplication, byte-for-byte. All other instances should be `-S`.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="302" viewBox="0 0 700 302" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="200" height="200" rx="3" fill="none" stroke="#607aaa" stroke-width="1" stroke-dasharray="5,3"/><text x="110.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#1e3060" font-weight="500">fuzzer01  -M  master</text><rect x="20" y="62.0" width="180" height="34" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="110.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">deterministic stages</text><text x="110.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">bit flips, arith, known ints</text><line x1="110.0" y1="96.0" x2="110.0" y2="111.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="20" y="118.0" width="180" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="110.0" y="135.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">havoc + splice</text><line x1="110.0" y1="152.0" x2="110.0" y2="167.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="20" y="174.0" width="180" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="110.0" y="188.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">findings/fuzzer01/queue/</text><rect x="230" y="32.0" width="180" height="200" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/><text x="320.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#3a1a5a" font-weight="500">fuzzer02  -S</text><rect x="240" y="72.0" width="160" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="320.0" y="81.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">havoc only</text><text x="320.0" y="96.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">random schedule</text><line x1="320.0" y1="106.0" x2="320.0" y2="167.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="240" y="174.0" width="160" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="320.0" y="188.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">findings/fuzzer02/queue/</text><rect x="430" y="32.0" width="180" height="200" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/><text x="520.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#3a1a5a" font-weight="500">fuzzer03  -S</text><rect x="440" y="72.0" width="160" height="34" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="520.0" y="81.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">havoc only</text><text x="520.0" y="96.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">different schedule</text><line x1="520.0" y1="106.0" x2="520.0" y2="167.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="440" y="174.0" width="160" height="28" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="520.0" y="188.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">findings/fuzzer03/queue/</text><rect x="10" y="250.0" width="680" height="44" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="350.0" y="244.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Shared findings/ directory — sync every 30 s</text><text x="350" y="280.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" fill="#2a4a2a">each instance scans peers, imports unseen entries ↔ all benefit from all finds</text><line x1="110.0" y1="202.0" x2="110.0" y2="243.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="320.0" y1="202.0" x2="320.0" y2="243.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="520.0" y1="202.0" x2="520.0" y2="243.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/></svg>
<div class="afl-fig-caption">Parallel fuzzing architecture: one master runs deterministic stages; secondaries run havoc in parallel.</div>
</div>
</div>

### The sync mechanism, how instances share findings

AFL++ has no shared memory queue and no central coordinator. Each instance writes its findings to its own subdirectory under `findings/`. Every `AFL_SYNC_TIME` seconds (30 seconds by default), each instance scans the other subdirectories for entries it hasn't yet imported, pulls them into its own queue, and keeps running.

The sync state is tracked per-instance in a `.synced/` subdirectory that records the last-imported entry ID from each peer. This prevents double-importing the same entry across sync cycles.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="300" viewBox="0 0 760 300">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#2d2a26"/></marker>
  </defs>

  <!-- LEFT PANEL: findings/ on disk -->
  <rect x="10" y="36" width="250" height="240" rx="3" fill="none" stroke="#9a9690" stroke-width="1" stroke-dasharray="5,3"/>
  <text x="135" y="28" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" font-weight="500" fill="#4a4640">Findings/ on disk</text>

  <!-- fuzzer01/queue/ -->
  <rect x="22" y="50" width="226" height="84" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/>
  <text x="135" y="68" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#1e3060">fuzzer01/queue/</text>
  <text x="135" y="86" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">id:000000</text>
  <text x="135" y="102" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">id:000001</text>
  <text x="135" y="118" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#1e3060">id:000002</text>

  <!-- fuzzer02/queue/ -->
  <rect x="22" y="148" width="226" height="54" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/>
  <text x="135" y="166" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#3a1a5a">fuzzer02/queue/</text>
  <text x="135" y="184" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#3a1a5a">id:000000 &nbsp; id:000001</text>

  <!-- fuzzer03/queue/ -->
  <rect x="22" y="216" width="226" height="48" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/>
  <text x="135" y="234" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#2a4a2a">fuzzer03/queue/</text>
  <text x="135" y="252" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#2a4a2a">id:000000</text>

  <!-- Arrow from left panel to right panel -->
  <line x1="270" y1="156" x2="320" y2="156" stroke="#2d2a26" stroke-width="1.5" marker-end="url(#ah)"/>

  <!-- RIGHT PANEL: fuzzer02 sync cycle -->
  <rect x="330" y="36" width="418" height="240" rx="3" fill="none" stroke="#9070b0" stroke-width="1" stroke-dasharray="5,3"/>
  <text x="539" y="28" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" font-weight="500" fill="#3a1a5a">Fuzzer02 Sync Cycle</text>

  <!-- scan fuzzer01 box -->
  <rect x="344" y="52" width="390" height="82" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="539" y="74" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">scan fuzzer01/queue/</text>
  <text x="539" y="92" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">last seen: id:000001</text>
  <text x="539" y="110" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">new: id:000002 → import</text>

  <!-- down arrow -->
  <line x1="539" y1="134" x2="539" y2="158" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/>

  <!-- scan fuzzer03 box -->
  <rect x="344" y="164" width="390" height="82" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/>
  <text x="539" y="186" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="500" fill="#5a3800">scan fuzzer03/queue/</text>
  <text x="539" y="204" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">last seen: none</text>
  <text x="539" y="222" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" fill="#5a3800">new: id:000000 → import</text>
</svg>
<div class="afl-fig-caption">Queue sync mechanism: each instance tracks last-imported ID per peer to avoid re-imports.</div>
</div>
</div>

Imported entries skip deterministic stages on secondaries and go straight into the havoc queue. On the master, imported entries do get the full deterministic treatment. This is intentional: the master is the single source of exhaustive coverage for each entry in the corpus.

Watch the `imported` counter in each instance's stats panel. In a healthy parallel campaign it climbs steadily. If it's stuck at zero, your instances are all converging on the same paths. Vary the power schedules.

### Varying schedules across instances

Running all secondaries with the same power schedule is wasteful. They'll all pile onto the same high-energy corpus entries and leave the same cold paths untouched. Assign different schedules to different instances:

```bash
afl-fuzz -M fuzzer01 -p explore  -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer02 -p fast     -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer03 -p rare     -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer04 -p exploit  -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer05 -p mmopt    -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer06 -p coe      -i corpus/ -o findings/ -- ./target @@
# remaining instances cycle back through schedules
afl-fuzz -S fuzzer07 -p fast     -i corpus/ -o findings/ -- ./target @@
afl-fuzz -S fuzzer08 -p rare     -i corpus/ -o findings/ -- ./target @@
```

`rare` is especially valuable in parallel setups. It allocates energy to corpus entries covering edges that most other entries ignore. The cold paths. The ones `explore` and `exploit` consistently deprioritize. Even a single `rare` instance dedicated to those cold paths will surface bugs that a uniform `explore` campaign would never reach.

### Core count recommendations

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="200" viewBox="0 0 680 200" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="30" width="150" height="44" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="85.0" y="44.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">1× -M</text><text x="85.0" y="59.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">3× -S fast</text><text x="85" y="22" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" font-weight="500" fill="#4a4640">4-core</text><rect x="176" y="30" width="150" height="76" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="251.0" y="45.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">1× -M</text><text x="251.0" y="60.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">1× -S rare</text><text x="251.0" y="75.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">1× -S exploit</text><text x="251.0" y="90.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">5× -S fast</text><text x="251" y="22" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" font-weight="500" fill="#4a4640">8-core</text><rect x="342" y="30" width="150" height="92" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="417.0" y="46.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">1× -M</text><text x="417.0" y="61.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">2× -S rare</text><text x="417.0" y="76.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">2× -S exploit</text><text x="417.0" y="91.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">2× -S coe</text><text x="417.0" y="106.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">9× -S fast</text><text x="417" y="22" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" font-weight="500" fill="#4a4640">16-core</text><rect x="508" y="30" width="150" height="92" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="583.0" y="46.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">1× -M</text><text x="583.0" y="61.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">2× -S rare</text><text x="583.0" y="76.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">1× -S CMPLOG</text><text x="583.0" y="91.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">2× -S coe</text><text x="583.0" y="106.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">rest fast</text><text x="583" y="22" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="11" font-variant="small-caps" font-weight="500" fill="#4a4640">32+ cores</text></svg>
<div class="afl-fig-caption">Recommended parallel configurations: scale secondary count with available cores.</div>
</div>
</div>

One practical note: on a shared machine leave 1 or 2 cores free for the OS and sync I/O. AFL++ instances competing for CPU time with the OS scheduler produce erratic exec speeds and noisy coverage signals.

### Running a CMPLOG instance in parallel

CMPLOG instrumentation is expensive, roughly 2-3x slower than a plain build. In a parallel setup, run exactly one CMPLOG instance as a secondary, pointing it at the CMPLOG-instrumented binary with `-c`:

```bash
# One CMPLOG secondary alongside plain secondaries:
afl-fuzz -S fuzzer-cmplog \
  -c ./target-cmplog \
  -i corpus/ -o findings/ \
  -- ./target @@
```

The CMPLOG instance runs 2-3x slower but produces dictionary entries that every other instance benefits from via sync. One CMPLOG instance feeding a 15-instance campaign is about the right ratio. Running more CMPLOG instances costs throughput without producing proportionally more dictionary value.

### Monitoring a parallel campaign

```bash
# Watch all instances at once:
watch -n 1 'afl-whatsup findings/'

# Summary stats across all instances:
afl-whatsup -s findings/

# Check which instances are finding new paths:
grep -h "own_finds" findings/*/fuzzer_stats | sort -t: -k2 -n
```

`afl-whatsup` aggregates the `fuzzer_stats` files from all instances. the thing to watch is `unique_crashes`, if it's non-zero across any instance, that instance's `crashes/` directory has reproducers. Also watch `stability` per-instance, a single instance with low stability drags down sync quality for all peers.

---

## 10. Sanitizer Interactions

ASan is the right first choice, but it's not the only sanitizer worth running. Each sanitizer catches a different class of bug, and they can't all live in the same binary because their instrumentation conflicts. The right approach is to build separate binaries, one per sanitizer, and run dedicated campaigns or parallel instances against each.

### The sanitizer matrix

| Sanitizer | Flag                   | What it catches                                           | What it misses                               |
| --------- | ---------------------- | --------------------------------------------------------- | -------------------------------------------- |
| ASan      | `-fsanitize=address`   | heap/stack/global overflow, UAF, use-after-return         | signed integer overflow, uninitialized reads |
| UBSan     | `-fsanitize=undefined` | signed overflow, null deref, misaligned access, OOB array | memory safety, UAF                           |
| MSan      | `-fsanitize=memory`    | reads from uninitialized memory                           | overflows, UAF                               |
| LSan      | `-fsanitize=leak`      | memory leaks                                              | everything else                              |
| TSan      | `-fsanitize=thread`    | data races, lock order violations                         | single-threaded bugs                         |

The most commonly missed bug class is **signed integer overflow**. ASan ignores it completely. Signed overflow is undefined behavior in C but doesn't corrupt memory on its own, so ASan has nothing to instrument. UBSan catches it. The pattern looks like this:

```c
int32_t count = header->item_count;  // attacker-controlled, e.g. 0x40000000
int32_t total = count * sizeof(item_t);  // 0x40000000 * 8 = 0x200000000
                                          // overflows int32_t → -2147483648
size_t alloc  = (size_t)total;           // sign-extends to 0xFFFFFFFF80000000
void  *buf    = malloc(alloc);           // malloc(-2GB) → returns NULL or tiny alloc
memcpy(buf, src, count * sizeof(item_t)); // writes 2GB into tiny buffer → RCE
```

ASan sees a valid `malloc` call and a `memcpy` into the resulting pointer. Nothing looks wrong at the memory level. The overflow happened two lines earlier, in the multiplication, and ASan had no visibility into it. UBSan fires right there at the multiplication.

### Building for each sanitizer

```bash
# ASan build — primary fuzzing build
AFL_USE_ASAN=1 afl-clang-fast \
  -fsanitize=address -g -O1 \
  -o target-asan target.c

# UBSan build — catches signed overflow, misalignment, null UB
AFL_USE_UBSAN=1 afl-clang-fast \
  -fsanitize=undefined -fno-sanitize-recover=all -g -O1 \
  -o target-ubsan target.c

# MSan build — catches uninitialized reads
# Note: requires all linked libraries also built with MSan
# Clang only — GCC MSan is not production quality
AFL_USE_MSAN=1 afl-clang-fast \
  -fsanitize=memory -fsanitize-memory-track-origins=2 -g -O1 \
  -o target-msan target.c

# Combined ASan + UBSan — works, slight overhead increase
AFL_USE_ASAN=1 AFL_USE_UBSAN=1 afl-clang-fast \
  -fsanitize=address,undefined -fno-sanitize-recover=all -g -O1 \
  -o target-asan-ubsan target.c
```

`-fno-sanitize-recover=all` is not optional for UBSan when fuzzing. Without it, UBSan prints a warning to stderr and keeps running. AFL++ never sees a crash and the bug goes unrecorded. With the flag, UBSan aborts immediately on the first undefined behavior detection. AFL++ catches that abort as a crash and saves the reproducer.

### What each sanitizer catches that the others miss

**ASan-unique catches:**

- Heap buffer overflow (read and write)
- Use-after-free
- Stack buffer overflow
- Global buffer overflow
- Use-after-return (with `detect_stack_use_after_return=1`)
- Double free

**UBSan-unique catches:**

- Signed integer overflow: `INT_MAX + 1`
- Signed integer underflow: `INT_MIN - 1`
- Shift exponent overflow: `1 << 32` on a 32-bit int
- Misaligned pointer dereference: reading `uint32_t` from an odd address
- Null pointer dereference (before the segfault)
- Division by zero (catches it before the signal)
- Invalid enum value
- Type punning violation (strict aliasing)

**MSan-unique catches:**

- Reading uninitialized stack variables
- Reading uninitialized heap allocations before writing them
- Propagating uninit taint through arithmetic into branch conditions

The MSan case that matters most in parsers:

```c
struct Header hdr;
read(fd, &hdr, sizeof(hdr));  // reads exactly sizeof(hdr) bytes

// hdr.flags is now initialized — MSan is fine with this
if (hdr.flags & FLAG_EXTENDED) {
    // ...
}

// BUT: if the file is short and read() returns fewer bytes:
// hdr.flags is partially initialized — MSan fires here
// ASan sees nothing wrong — no overflow, no UAF
```

### Sanitizer interaction with AFL instrumentation

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="260" viewBox="0 0 680 260" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="270" y="10" width="140" height="32" rx="3" fill="#f4f3f0" stroke="#9a9690" stroke-width="1.2"/><text x="340.0" y="26.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#4a4640">source code</text><line x1="340.0" y1="42.0" x2="340.0" y2="57.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="210" y="64" width="260" height="40" rx="3" fill="#f2f4fa" stroke="#607aaa" stroke-width="1.2"/><text x="340.0" y="76.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">afl-clang-fast</text><text x="340.0" y="91.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#1e3060">LLVM pass — coverage bitmap hooks</text><line x1="240.0" y1="104.0" x2="126.7" y2="138.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="176.6" y="110.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">AFL_USE_ASAN=1</text><line x1="340.0" y1="104.0" x2="340.0" y2="133.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="328.0" y="122.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">AFL_USE_UBSAN=1</text><line x1="440.0" y1="104.0" x2="553.3" y2="138.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><text x="496.6" y="133.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-style="italic" fill="#6b6860">AFL_USE_MSAN=1</text><rect x="20" y="140" width="200" height="40" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="120.0" y="152.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">ASan instrumentation</text><text x="120.0" y="167.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">redzone + shadow memory</text><rect x="240" y="140" width="200" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="340.0" y="152.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">UBSan checks</text><text x="340.0" y="167.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">at every arith op</text><rect x="460" y="140" width="200" height="40" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="560.0" y="152.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">MSan shadow tracking</text><text x="560.0" y="167.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">at every memory access</text><line x1="120.0" y1="180.0" x2="120.0" y2="203.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="340.0" y1="180.0" x2="340.0" y2="203.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><line x1="560.0" y1="180.0" x2="560.0" y2="203.0" stroke="#2d2a26" stroke-width="1.3" marker-end="url(#ah)"/><rect x="20" y="210" width="200" height="30" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="120.0" y="225.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">target-asan  ~2× slowdown</text><rect x="240" y="210" width="200" height="30" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="340.0" y="225.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">target-ubsan  ~1.5× slowdown</text><rect x="460" y="210" width="200" height="30" rx="3" fill="#f7f2fa" stroke="#9070b0" stroke-width="1.2"/><text x="560.0" y="225.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#3a1a5a">target-msan  ~3× slowdown</text></svg>
<div class="afl-fig-caption">Sanitizer instrumentation stack: AFL++ coverage hooks composed with per-sanitizer checks.</div>
</div>
</div>

Sanitizer overhead varies considerably. A target running 10,000 exec/sec clean might do 5,000 with ASan, 6,500 with UBSan, and 3,000 with MSan. Account for this when allocating cores in a parallel campaign. Give fewer cores to the MSan instance since each core produces less throughput.

### Running multi-sanitizer parallel campaigns

```bash
# Primary campaign: ASan (most important)
afl-fuzz -M fuzzer-asan  -i corpus/ -o findings-asan/  -- ./target-asan  @@
afl-fuzz -S fuzzer-asan2 -i corpus/ -o findings-asan/  -- ./target-asan  @@
afl-fuzz -S fuzzer-asan3 -i corpus/ -o findings-asan/  -- ./target-asan  @@

# Secondary campaign: UBSan (catches signed overflow)
afl-fuzz -M fuzzer-ubsan -i corpus/ -o findings-ubsan/ -- ./target-ubsan @@
afl-fuzz -S fuzzer-ub2   -i corpus/ -o findings-ubsan/ -- ./target-ubsan @@

# Occasional MSan run (slow but catches uninit reads)
afl-fuzz -M fuzzer-msan  -i corpus/ -o findings-msan/  -- ./target-msan  @@
```

Keep findings directories separate per sanitizer. A crash in `findings-asan/` reproduced against `target-ubsan` might not crash at all (different bug class, different detection). Cross-contaminating queues confuses the sync mechanism.

### Reading a UBSan report

```
target.c:42:24: runtime error: signed integer overflow:
2147483647 + 1 cannot be represented in type 'int'
│                └─ value that overflowed (INT32_MAX + 1)
│           └─ column: the + operator
│      └─ line 42
└─ file

SUMMARY: UndefinedBehaviorSanitizer: undefined-behavior target.c:42:24
```

Compared to ASan reports, UBSan reports are terser, they tell you the exact expression that triggered UB, but they don't give you allocation sites. The fix is always at the reported line. The common pattern: `signed_value * attacker_controlled_value`, replace the signed multiplication with a bounds-checked version or cast to `uint64_t` before multiplying.

---

## 11. Seed Corpus Construction

The seed corpus is the most underrated variable in a fuzzing campaign. AFL++ can technically start from nothing, using a built-in empty seed, but a good corpus cuts the time to first deep coverage by orders of magnitude. Deterministic stages run faster on smaller inputs. A strong initial coverage burst means havoc starts from a more advanced position. And some code paths are simply unreachable from mutations of an empty or wrong-format seed, no matter how long you run.

### What makes a good seed

Three properties define a good seed corpus: **validity**, **minimality**, and **diversity**.

**Validity** means the input clears the parser's initial checks: magic bytes correct, version field in range, header well-formed. An invalid seed gets rejected at the first guard and produces no useful coverage. Every mutation from it also starts behind that same guard. AFL can eventually break through using CMPLOG, but you're burning energy on inputs that die in the first 20 instructions.

**Minimality** means each seed is as small as it can be while still being valid. A 200-byte seed and a 50KB seed covering the same initial code paths are not equally good. The 200-byte seed produces 250 times fewer variants per deterministic pass, so AFL cycles through it dramatically faster. Small seeds are also easier to structurally corrupt without accidentally invalidating the entire format. A 200-byte GGUF with one tensor is easy to usefully break. A 50KB GGUF with 500 tensors has so much valid structure that random mutations hit irrelevant bytes most of the time.

**Diversity** means the seeds collectively cover different code paths. Three seeds that all exercise the same parser branch are worse than one. They give AFL three redundant starting points into the same territory. The ideal corpus maps the format's feature space: one seed per major feature, one per optional section type, one per supported version.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="262" viewBox="0 0 640 262" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="290" height="210" rx="3" fill="none" stroke="#c07070" stroke-width="1" stroke-dasharray="5,3"/><text x="155.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#5a2020" font-weight="500">Bad seed corpus</text><rect x="20" y="56.0" width="272" height="46" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="156.0" y="71.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">large_valid.bin   50KB, all features</text><text x="156.0" y="86.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">slow deterministic pass</text><rect x="20" y="116.0" width="272" height="46" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="156.0" y="131.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">large_valid2.bin  48KB, same paths</text><text x="156.0" y="146.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">redundant</text><rect x="20" y="176.0" width="272" height="46" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="156.0" y="191.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">large_valid3.bin  52KB, same paths</text><text x="156.0" y="206.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">redundant</text><rect x="340" y="32.0" width="290" height="210" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="485.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Good seed corpus</text><rect x="350" y="46.0" width="272" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="486.0" y="58.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">minimal_v1.bin   200B, version 1</text><text x="486.0" y="73.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">fast, unique path</text><rect x="350" y="94.0" width="272" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="486.0" y="106.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">minimal_v2.bin   180B, version 2</text><text x="486.0" y="121.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">different code path</text><rect x="350" y="142.0" width="272" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="486.0" y="154.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">extended_hdr.bin 300B, optional section</text><text x="486.0" y="169.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">covers distinct path</text><rect x="350" y="190.0" width="272" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="486.0" y="202.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">empty_body.bin    64B, no content</text><text x="486.0" y="217.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">edge-case coverage</text></svg>
<div class="afl-fig-caption">Seed corpus quality: small, valid, diverse seeds outperform large real-world files.</div>
</div>
</div>

### Checking initial coverage with afl-cov

Before launching a campaign, check how much of the target your seed corpus actually covers. `afl-cov` runs your seeds through a gcov-instrumented binary and produces a line-level HTML coverage report.

```bash
# Build a gcov-instrumented version of the target:
gcc --coverage -g -O0 \
  tests/afl-tokenizer.cpp -o target-cov \
  [other sources and libs]

# Run seeds through it and collect coverage:
afl-cov \
  -d corpus/ \
  --coverage-cmd "./target-cov AFL_FILE" \
  --code-dir src/ \
  --overwrite

# Open coverage report:
firefox cov-web/index.html
```

Look at the coverage report before starting your campaign and identify which functions have zero coverage from your seeds. Those functions need seeds that reach them. Otherwise AFL has to build the path from scratch through mutation, which can take days, or may never happen at all if there's a hard validation gate blocking the way.

### Hand-crafting minimal valid inputs

For binary formats, the fastest approach is to read the spec and hand-construct the smallest valid file for each feature variant you care about. It's less tedious than it sounds. For most formats a minimal valid file is 50 to 200 bytes.

For GGUF specifically:

```python
import struct

def make_minimal_gguf(version=3, num_tensors=0, num_kv=0):
    """Build the smallest valid GGUF file for a given version."""
    magic  = b'GGUF'
    header = struct.pack('<I', version)           # version (LE uint32)
    header += struct.pack('<Q', num_tensors)      # tensor_count (LE uint64)
    header += struct.pack('<Q', num_kv)           # metadata_kv_count (LE uint64)
    return magic + header

# Version 1 seed — hits version-1 parsing path
open('corpus/v1_empty.gguf', 'wb').write(make_minimal_gguf(version=1))
# Version 2 seed
open('corpus/v2_empty.gguf', 'wb').write(make_minimal_gguf(version=2))
# Version 3 seed
open('corpus/v3_empty.gguf', 'wb').write(make_minimal_gguf(version=3))
# Version 3 with one tensor entry declared (body parsing)
open('corpus/v3_one_tensor.gguf', 'wb').write(make_minimal_gguf(version=3, num_tensors=1))
```

Four seeds, all under 25 bytes, covering four distinct code paths. No existing GGUF model file required. Compare that to dropping a real 2GB model file into your corpus and wondering why the campaign is slow.

For text-based formats this is even easier. Just write the minimal valid document by hand:

```bash
# JSON fuzzing seeds
echo '{}' > corpus/empty_object.json
echo '[]' > corpus/empty_array.json
echo '{"k":"v"}' > corpus/simple_kv.json
echo '{"n":0}' > corpus/number.json
echo 'null' > corpus/null.json

# XML seeds
echo '<r/>' > corpus/empty.xml
echo '<r a="v"/>' > corpus/attr.xml
echo '<r><c/></r>' > corpus/nested.xml
```

### One big seed vs many small seeds, the tradeoff

When you have a real-world example file sitting there, the temptation is to drop it straight into the corpus. Resist that for anything over a few KB.

<div class="afl-fig">
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="262" viewBox="0 0 680 262" ><defs>
  <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#2d2a26"/>
  </marker>
  <marker id="ah-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#888480"/>
  </marker>
  <marker id="ah-dash" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#9b8f80"/>
  </marker>
</defs><rect x="10" y="32.0" width="310" height="210" rx="3" fill="none" stroke="#c07070" stroke-width="1" stroke-dasharray="5,3"/><text x="165.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#5a2020" font-weight="500">One 50 KB real-world seed</text><rect x="20" y="58.0" width="290" height="50" rx="3" fill="#faf2f2" stroke="#c07070" stroke-width="1.2"/><text x="165.0" y="68.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">Deterministic stages:</text><text x="165.0" y="83.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">50,000 bytes × 8 bits × 3 passes</text><text x="165.0" y="98.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a2020">≈ 1.2 M variants — ~5 min/cycle</text><rect x="20" y="122.0" width="290" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="165.0" y="134.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Havoc: mutations scattered across 50 KB</text><text x="165.0" y="149.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">most hit irrelevant bytes — low signal</text><rect x="20" y="176.0" width="290" height="40" rx="3" fill="#faf5ee" stroke="#c09050" stroke-width="1.2"/><text x="165.0" y="188.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">Corpus bloats rapidly from large-file</text><text x="165.0" y="203.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#5a3800">havoc variants — slow cycles</text><rect x="360" y="32.0" width="310" height="210" rx="3" fill="none" stroke="#5a8a5a" stroke-width="1" stroke-dasharray="5,3"/><text x="515.0" y="26.0" text-anchor="middle" font-family="'EB Garamond',Georgia,serif" font-size="10" font-variant="small-caps" fill="#2a4a2a" font-weight="500">Four 200 B minimal seeds</text><rect x="370" y="58.0" width="290" height="50" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="515.0" y="68.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Deterministic stages:</text><text x="515.0" y="83.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">200 bytes × 8 bits × 3 passes</text><text x="515.0" y="98.0" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">≈ 4,800 variants — ~0.1 s/cycle</text><rect x="370" y="122.0" width="290" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="515.0" y="134.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Havoc: mutations on small file</text><text x="515.0" y="149.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">high probability of hitting relevant bytes</text><rect x="370" y="176.0" width="290" height="40" rx="3" fill="#f2f7f2" stroke="#5a8a5a" stroke-width="1.2"/><text x="515.0" y="188.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">Corpus stays compact — fast cycles</text><text x="515.0" y="203.5" text-anchor="middle" dominant-baseline="middle" font-family="'EB Garamond',Georgia,serif" font-size="12" font-weight="400" fill="#2a4a2a">same initial coverage achieved</text></svg>
<div class="afl-fig-caption">Seed size tradeoff: four 200-byte seeds cycle 50× faster than one 50 KB file.</div>
</div>
</div>

If you genuinely need a large real-world file because it exercises a code path that's otherwise hard to reach, run `afl-tmin` on it first to shrink it to the minimum reproducer of that coverage. Then add the minimized version.

### Using afl-cov to find missing coverage

Once your initial seeds are in place and basic coverage looks solid, let AFL run for 1 to 2 hours and then re-run the coverage check. Any function still at zero coverage is a target for an additional seed or a custom mutator.

```bash
# After 2 hours of fuzzing, check what's still uncovered:
afl-cov \
  -d findings/main/queue/ \
  --coverage-cmd "./target-cov AFL_FILE" \
  --code-dir src/ \
  --overwrite

# Functions with 0% coverage after 2 hours of fuzzing are hard to reach.
# Options:
# 1. Hand-craft a seed that reaches them
# 2. Write a custom mutator that understands the format well enough
#    to generate inputs that pass the guards in front of those functions
# 3. Check if those functions are actually reachable from your harness —
#    sometimes they require a different entry point entirely
```

Running afl-cov before the campaign to validate your seeds, then again after a short run to catch persistent blind spots, is the most reliable way to identify corpus gaps before they cost you days of campaign time.

---
