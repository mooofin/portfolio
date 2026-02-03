---
title: "Strings Don't Lie, Packers Do"
date: "2025-12-29"
---

*Note - always check for UPX, wasted half an hour because i didnt unpack the binary*

## Binary Analysis

```bash
$ file './flag{key1+key2}'
./flag{key1+key2}: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux.so.2, for GNU/Linux 2.6.32,
BuildID[sha1]=77c06ef6af332d2e5def19f42f2b60fcf2c5d2e6, not stripped
```

Key observations:
- 32-bit ELF binary
- Dynamically linked (requires 32-bit libraries)
- Not stripped (symbols intact - easier to analyze)

## Initial Execution

```bash
$ ./flag{key1+key2}
[No output]
```

The binary runs but produces no output. Maybe the key is in the binary itself?

## Detecting the Packer

```bash
$ strings './flag{key1+key2}' | grep -i upx
$Info: This file is packed with the UPX executable packer http://upx.sf.net $
$Id: UPX 3.91 Copyright (C) 1996-2013 the UPX Team. All Rights Reserved. $
PROT_EXEC|PROT_WRITE failed.
```

The binary is packed with UPX (Ultimate Packer for eXecutables) version 3.91.

## Unpacking with UPX

```bash
$ upx -d './flag{key1+key2}'
                       Ultimate Packer for eXecutables
                          Copyright (C) 1996 - 2025
UPX 5.0.2       Markus Oberhumer, Laszlo Molnar & John Reiser   Jul 20th 2025

        File size         Ratio      Format      Name
   --------------------   ------   -----------   -----------
[WARNING] bad b_info at 0x12948
[WARNING] ... recovery at 0x12944
    194808 <-     85996   44.14%   linux/i386    flag{key1+key2}

Unpacked 1 file.
```

## Searching for Key-Related Strings

```bash
$ strings './flag{key1+key2}' | grep -i key
You don't have the first part of key yet
You dont have the entire key yet.... :(
keyjoin.12717834333337631731.tmp.c
mapnode_find_key
map_key_to_index
mapnode_subkeys
map_keys_1
SortedMap_keys
mapnode_remove_key
DenseArray_key
map_keys
```

Important strings:
1. `"You don't have the first part of key yet"`
2. `"You dont have the entire key yet.... :("`

These error messages indicate the binary checks for keys and displays messages when conditions aren't met.

## Main Function Analysis

```bash
$ objdump -d -M intel './flag{key1+key2}' | grep -A 50 "<main>:"
```

Output:
```assembly
08068f89 <main>:
 8068f89:	8d 4c 24 04          	lea    ecx,[esp+0x4]
 8068f8d:	83 e4 f0             	and    esp,0xfffffff0
 8068f90:	ff 71 fc             	push   DWORD PTR [ecx-0x4]
 8068f93:	55                   	push   ebp
 8068f94:	89 e5                	mov    ebp,esp
 8068f96:	51                   	push   ecx
 8068f97:	83 ec 04             	sub    esp,0x4
 8068f9a:	89 c8                	mov    eax,ecx
 8068f9c:	83 ec 08             	sub    esp,0x8
 8068f9f:	ff 70 04             	push   DWORD PTR [eax+0x4]
 8068fa2:	ff 30                	push   DWORD PTR [eax]
 8068fa4:	e8 f3 93 ff ff       	call   806239c <_vinit>
 8068fa9:	83 c4 10             	add    esp,0x10
 8068fac:	e8 cb 8f ff ff       	call   8061f7c <main__main>
 8068fb1:	b8 00 00 00 00       	mov    eax,0x0
 8068fb6:	8b 4d fc             	mov    ecx,DWORD PTR [ebp-0x4]
 8068fb9:	c9                   	leave
 8068fba:	8d 61 fc             	lea    esp,[ecx-0x4]
 8068fbd:	c3                   	ret
```

- `main` calls `_vinit` for initialization
- Then calls `main__main` at address `0x8061f7c`
- Returns 0

### Analyzing main__main

```bash
$ objdump -d -M intel './flag{key1+key2}' | grep -A 50 "8061f7c <main__main>:"
```

Key sections:
```assembly
08061f7c <main__main>:
 8061f82:	c7 45 d8 17 00 00 00 	mov    DWORD PTR [ebp-0x28],0x17
 8061f89:	c7 45 dc 8c 09 00 00 	mov    DWORD PTR [ebp-0x24],0x98c
 8061f90:	83 7d d8 2d          	cmp    DWORD PTR [ebp-0x28],0x2d
 8061f94:	75 07                	jne    8061f9d <main__main+0x21>
 8061f96:	e8 64 00 00 00       	call   8061fff <main__one>
 8061f9b:	eb 29                	jmp    8061fc6 <main__main+0x4a>
```

Summary:
- Line `8061f82`: Stores value `0x17` (decimal 23) in local variable
- Line `8061f89`: Stores value `0x98c` (decimal 2444) in local variable
- Line `8061f90`: Compares first value with `0x2d` (decimal 45)
- Since 23 ≠ 45, the jump at `8061f94` is taken
- Line `8061f96`: This call is SKIPPED because the comparison failed

The binary intentionally prevents the key functions from being called by using incorrect comparison values.

## KEY 1: Analyzing main__one

```bash
$ objdump -d -M intel './flag{key1+key2}' | grep -A 150 "8061fff <main__one>:"
```

Key sections:
```assembly
08061fff <main__one>:
 8062030:	c7 45 a8 2d 00 00 00 	mov    DWORD PTR [ebp-0x58],0x2d
 8062037:	83 7d a8 1f          	cmp    DWORD PTR [ebp-0x58],0x1f
 806203b:	0f 8f 93 00 00 00    	jg     80620d4 <main__one+0xd5>
```

Loop analysis:
```assembly
 8062058:	c7 45 a4 02 00 00 00 	mov    DWORD PTR [ebp-0x5c],0x2
 806207e:	83 7d a4 0b          	cmp    DWORD PTR [ebp-0x5c],0xb
 8062082:	7e dd                	jle    8062061 <main__one+0x62>
```

- Initialize counter to 2
- Push counter value to array
- Increment counter by 1
- Compare counter with 0xb (11)
- If counter ≤ 11, loop

Result: Creates array `[2, 3, 4, 5, 6, 7, 8, 9, 10, 11]`

Then:
```assembly
 806208a:	6a 08                	push   0x8
 806208c:	6a 02                	push   0x2
 806209b:	e8 d0 43 ff ff       	call   8056470 <array_slice>
```

Call: `array_slice(array, 2, 8)`

Result: Slices array from index 2 to 8 → `[4, 5, 6, 7, 8, 9]`

**KEY1 = "456789"**

## KEY 2: Analyzing main__two

```bash
$ objdump -d -M intel './flag{key1+key2}' | grep -A 250 "8062131 <main__two>:"
```

Memory addresses loaded:
- `0x806a03d`
- `0x806a03f`
- `0x806a041`
- `0x806a043`
- `0x806a045`

Each address is followed by length 1, suggesting single character strings.

```bash
$ objdump -s --start-address=0x806a014 --stop-address=0x806a050 './flag{key1+key2}'
```

Output:
```
./flag{key1+key2}:     file format elf32-i386

Contents of section .rodata:
 806a014 596f7520 646f6e27 74206861 76652074  You don't have t
 806a024 68652066 69727374 20706172 74206f66  he first part of
 806a034 206b6579 20796574 004a004b 004c0071   key yet.J.K.L.q
 806a044 00350039 00550031 00330037           .5.9.U.1.3.7
```

Character mapping:
```
Offset   Hex     ASCII   Character
------   -----   -----   ---------
806a03d  4a 00   J \0    'J'
806a03f  4b 00   K \0    'K'
806a041  4c 00   L \0    'L'
806a043  71 00   q \0    'q'
806a045  35 00   5 \0    '5'
```

The code references only the first 5 addresses, so:

**KEY2 = "JKLq5"**

## Solution

### Final Keys
- KEY1: `456789`
- KEY2: `JKLq5`

### Flag Format
The challenge filename is `flag{key1+key2}`, which means:

```
flag{456789+JKLq5}
```
