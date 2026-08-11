before going on this , id want to let the basic of VirtualAlloc and VirtualAllocEx to be known to the reader , if yk this , skip to the next section .


https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualalloc


VirtualAlloc is the primary user mode stuff for allocating pages in the "current process" , if you wanna allocate in another process's then use VirtualAllocEx

I like this comment - https://news.ycombinator.com/item?id=31964221 , read about this as well .


Every call at the end reaches NtAllocateVirtualMemory which manipulates the VAD and can also manipulate the page table itself .


One thing to keep in mind is that allocation on NTkernel is a 2 step process ,reserve and commit .
Read this if you wanna know how vad works [www.sans.org/blog/analysis-user-data-vads-extraction-precise-data-notepad-memory-hunting-malware-behavior] . In short when you reserve you're asking NTkernel to pls give me a memory adress , i have a bunch of virtual memory pages which i wanna allocate .

The other one is mem-commit which the windows documentation explains very well "The function also guarantees that when the caller later initially accesses the memory, the contents will be zero. Actual physical pages are not allocated unless/until the virtual addresses are actually accessed". Something interesting that you can leave out is VirtualAlloc-returned page  doesn't belong to any DLL and has no PDB symbols and the fun thing we will use which is it has no entry in the process's RUNTIME_FUNCTION


Keep this in mind later - To reserve and commit pages in one step, call VirtualAlloc with MEM_COMMIT | MEM_RESERVE. 


VEHguard internals. 


https://learn.microsoft.com/en-us/windows/win32/debug/vectored-exception-handling . 

If that confuses or dosent explain it properly , it's basically a callback that windows uses when an execption occurs 
before any __try or catch tries to run . To add one we use AddVectoredContinueHandler function (errhandlingapi.h) , it takes a (FirstHandler, YourFunction) , passing 1 to it makes our handler at the front of the internal chain which manages the order of what is to be called and 0 puts it at the back .





Every process in windows has ntdll.dll loaded onto it , it is what every syscall needs to be ran through to make it commmunicate  to the kernel via syscalls. This thread has some answers for any more things that pique the readers interest [https://www.reddit.com/r/sysadmin/comments/vqcf67/windows_undocumented_emergency_restart/]


Now we can try to see how exactly these get resolved and the context switching happens , load up ntdll into IDA and let it finish downloading symbols 


blog\vehguard\image1.png


see the  LdrpVectorHandlerList , this is what keeps the list of what the priority order is of calling it .


decompile and lets search for the loop where it has to 


blog\vehguard\image2.png

handlers are encoded (RtlDecodePointer)  anti-corruption mitigation , and returning -1 breaks the loop, returns 1, which is ended up as "handled".


blog\vehguard\image3.png


See the entry block !, RSP now points at an EXCEPTION_RECORD + CONTEXT the kernel prepared and then it checks if it's a  WOW64 (32-bit-on-64-bit) process by testing if Wow64PrepareForException is set , 

Block 3 is the main dispatch , RtlDispatchException walks the VEH list (through RtlpCallVectoredHandlers which we just reversed) and returns 1 if handled, 0 if not 
blog\vehguard\image4.png

now we should see how the handled patch will be dispatched throughout ,
blog\vehguard\image5.png

After  VehHandler returns -1, execution reaches this block, and RtlGuardRestoreContext reads the CONTEXT* (still on rsp) and marks every register


moving onto how RtlGuardRestoreContext which should be where it passes the  modified RIP onto the CPU .

blog\vehguard\image6.png


pretty huge , but  lets start buy tracing the CFG from the first entry basic block .

blog\vehguard\image7.png


the first arg is the struct we will need to modify in our entry VEH-handler ,

blog\vehguard\image8.png


next instructions are pretty explanatory ; KiUserExceptionDispatcher calls  with edx = 0 (null ExceptionRecord) , jump straight to loc_180035A17. 

blog\vehguard\image9.png


Now this is a wrapper around RtlRestoreContext is the core primitive, these are just CFG validations or checking somethings mostly .

blog\vehguard\image10.png

but if you look at the right blocks of these context struct is being copied to a local stack buffer before being restored. this is so the restore process can safely trash registers without losing track of the source


below that is RcFrameConsolidation which is where the actual register-by-register restoration happens.




From all these we can try to form a mini mental model of veh the 
RtlRestoreContext primitive that passes on context to theCPU registers. It copies the caller-supplied CONTEXT into a local stack buffer via rep movsq ,then jumps to RcFrameConsolidation which restores every register . when u set ctx->Rip = g_RetGadget inside VehHandler, our conext passes to   RtlDispatchException which passes to RtlGuardRestoreContext validation which passes to  RtlRestoreContext copy which passes to  RcFrameConsolidation wheich then the RIP register 


latex here !







