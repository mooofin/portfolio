---
title: "I Use a Gap Buffer, Bitch."
date: "2026-01-26"
excerpt: "Fast as fuck terminal editing in C++20."
---

**FUCK VIM.**

And Honeymoon doesn’t run a Lisp interpreter that eats 4GB of RAM on startup.

A minimal, Emacs-inspired terminal text editor written in **C++20**.

Fast as fuck.

## Features

* **Visual Mode**
  `Ctrl-Space` to mark. Move. `Ctrl-W` to cut.
  Just like Emacs, but without the pinky pain.
  (Okay, maybe some pinky pain.)

## Architecture

The code is split into three namespaces:

* `honeymoon::kernel`
  Core editor logic.

* `honeymoon::driver`
   Raw mode, TTY I/O, screen rendering.

* `honeymoon::mem`
  A templated gap buffer implementation.

### The Gap Buffer
Instead of a simple string or a rope (which can be complex), Honeymoon uses a **Gap Buffer**. This is a dynamic array with a "gap" (a sequence of unused entries) that moves with the cursor. This makes insertions and deletions at the cursor position extremely efficient—O(1) in most cases—without the overhead of shifting the entire document.

```cpp
// Simplified concept
['H', 'e', 'l', 'l', 'o', _, _, _, _, 'W', 'o', 'r', 'l', 'd']
                          ^ Gap starts here
```

## Build

You need a C++20 compiler and `make`.

* Linux: you’re fine.
* Windows: WSL or sm.

```bash
make
./honeymoon filename.txt
```

## Controls

If you know Vim, I’m sorry.

<p align="center">
  <img src="/images/posts/honeymoon/honeymoon-blog.gif" alt="gif">
</p>

## Internals

For a deeper dive into the technical details (ANSI, custom drivers, etc.), check out the full internals documentation:
[mooofin.github.io/honeymoon/index.html](https://mooofin.github.io/honeymoon/index.html)
