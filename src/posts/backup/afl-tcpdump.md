---
title: "Fuzzing TCPdump: Catching Leaks with ASan"
date: "2026-01-26"
excerpt: "Combining AFL++ with AddressSanitizer to find memory safety bugs in tcpdump."
---

**AddressSanitizer (ASan)** is a game-changer for fuzzing. Instead of waiting for a segfault that might not happen until millions of instructions later (or never), ASan crashes the program *immediately* upon an invalid memory access (buffer overflow, use-after-free, leaks).

For this exercise, I fuzzed **tcpdump 4.9.2** (linked against **libpcap 1.8.0**).

## Build with ASan

To enable ASan in AFL++, we simply set `AFL_USE_ASAN=1`.

**Building libpcap:**
```bash
cd libpcap-1.8.0/
export LLVM_CONFIG="llvm-config-11"
CC=afl-clang-lto ./configure --enable-shared=no --prefix="$HOME/fuzzing_tcpdump/install/"
AFL_USE_ASAN=1 make
```
We disable shared libraries to avoid runtime linking headaches with ASan.

**Building tcpdump:**
```bash
cd tcpdump-4.9.2/
AFL_USE_ASAN=1 CC=afl-clang-lto ./configure --prefix="$HOME/fuzzing_tcpdump/install/"
AFL_USE_ASAN=1 make install
```

## The Core Pattern Issue

AFL++ refused to start initially because of the system's core dump handling.

```
[-] SYSTEM ERROR: Pipe at the beginning of 'core_pattern'
```

ASan and AFL++ both need to intercept crashes. I fixed this by directing core dumps to a static file/null:

```bash
echo core | sudo tee /proc/sys/kernel/core_pattern
```

## Results

Running the fuzzer with ASan enabled makes it much more sensitive.

```bash
afl-fuzz -i corpus -o out -s 123 -- ./tcpdump -r @@
```

ASan catches memory leaks that would otherwise go unnoticed:
```
==228472==ERROR: LeakSanitizer: detected memory leaks
Direct leak of 7 byte(s) in 1 object(s) allocated from:
    #0 malloc ...
    #1 main ...
```

This setup provides high-quality, reproducible crashes that are easy to triage.
