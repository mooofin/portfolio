---
title: "Fuzzing libexif: LTO & Memcpy"
date: "2026-01-26"
excerpt: "Using AFL++ with LTO to find memory corruption in libexif 0.6.14."
---

Fuzzing libraries like **libexif** can be tricky because of coverage collisions. For this exercise, I used **AFL++ with LTO (Link Time Optimization)** to get collision-free edge coverage, providing a much sharper view of the program's execution state.

## Setup & LTO Build

Standard AFL builds can suffer from bitmap collisions. AFL++'s LTO mode (`afl-clang-lto`) assigns unique, deterministic IDs to every edge at link time.

```bash
export LLVM_CONFIG="llvm-config-11"
CC=afl-clang-lto ./configure --enable-shared=no --prefix="$HOME/fuzzing_libexif/install/"
make
make install
```

## The Crash

I fuzzed the `exif` command-line utility against a corpus of JPEG images. AFL++ quickly found a crash.

I analyzed it using GDB (and GEF):

```bash
#0  __memcpy_avx_unaligned_erms ()
#1  memcpy ()
#2  exif_mnote_data_canon_load (ne=0x5555557bb690, ...)
#3  exif_data_load_data (...)
```

The crash happens in `exif_mnote_data_canon_load` at a `memcpy` call.

## Analysis

The stack trace points to the **Canon MakerNote** parser.

```c
// exif-mnote-data-canon.c
memcpy (d->entries[i].data, buf + o + s, d->entries[i].size);
```

This is a classic **out-of-bounds read/write**. The parser reads a length field from the malicious EXIF data (`d->entries[i].size`) and uses it in `memcpy` without verifying that the source `buf` actually contains that many bytes.

The fix involves checking that the offset and size fall within the bounds of the input buffer before attempting the copy.
