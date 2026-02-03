---
title: "Fuzzing Xpdf: Infinite Recursion"
date: "2026-01-26"
excerpt: "Discovering CVE-2019-13288 in Xpdf 3.02 using AFL++."
---

I used AFL++ to fuzz **Xpdf 3.02**, a legacy PDF viewer, and reproduced a known vulnerability: **CVE-2019-13288**. This bug causes an infinite recursion loop when parsing malformed PDF files, leading to stack exhaustion and a crash.

## The Target

We're targeting Xpdf 3.02.
```bash
wget https://dl.xpdfreader.com/old/xpdf-3.02.tar.gz
```

## Instrumentation

I compiled Xpdf using `afl-clang-fast` to inject coverage instrumentation.

```bash
export LLVM_CONFIG="llvm-config-11"
CC=$HOME/AFLplusplus/afl-clang-fast CXX=$HOME/AFLplusplus/afl-clang-fast++ ./configure --prefix="$HOME/fuzzing_xpdf/install/"
make
make install
```

## The Crash

After about an hour of fuzzing, AFL++ found multiple crashes.

<img src="/images/posts/afl-xpdf/crash-screen.png" alt="AFL Screen" />

I analyzed one of the crashes using GDB.

```bash
gdb --args pdftotext crash_input
```

The stack trace revealed an infinite recursion loop in the parser:

```
#60804 Parser::getObj ...
#60805 XRef::fetch ...
#60806 Object::fetch ...
#60807 Dict::lookup ...
#60808 Object::dictLookup ...
#60809 Parser::makeStream ...
...
#60853 XRef::fetch ...
```

The cycle repeats: `Parser::getObj` → `Parser::makeStream` → `Object::dictLookup` → `XRef::fetch`.

## The Bug

Xpdf failed to detect recursive object resolution. If a PDF object referred to itself (e.g., in a `/Length` field), the parser would follow the reference endlessly until the stack overflowed.

**The Fix:** Track visited objects during resolution and error out if a cycle is detected.

```cpp
if (resolving.count(key)) {
    error(errSyntaxError, -1, "Recursive object reference detected");
    return;
}
```
