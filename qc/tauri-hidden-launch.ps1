param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath
)

$source = @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public static class MvuadSilentLauncher
{
    private const uint CREATE_SUSPENDED = 0x00000004;
    private const uint STARTF_USESHOWWINDOW = 0x00000001;
    private const short SW_HIDE = 0;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_HIDEWINDOW = 0x0080;
    private static readonly IntPtr HWND_BOTTOM = new IntPtr(1);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public uint dwX;
        public uint dwY;
        public uint dwXSize;
        public uint dwYSize;
        public uint dwXCountChars;
        public uint dwYCountChars;
        public uint dwFillAttribute;
        public uint dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(
        string applicationName,
        string commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags
    );

    private static void HideProcessWindows(uint processId)
    {
        EnumWindows((window, _) =>
        {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner == processId)
            {
                ShowWindowAsync(window, SW_HIDE);
                SetWindowPos(
                    window,
                    HWND_BOTTOM,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_HIDEWINDOW
                );
            }
            return true;
        }, IntPtr.Zero);
    }

    public static void Run(string executablePath)
    {
        var startup = new STARTUPINFO();
        startup.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        startup.dwFlags = STARTF_USESHOWWINDOW;
        startup.wShowWindow = SW_HIDE;
        PROCESS_INFORMATION process;
        var started = CreateProcess(
            executablePath,
            "\"" + executablePath + "\"",
            IntPtr.Zero,
            IntPtr.Zero,
            false,
            CREATE_SUSPENDED,
            IntPtr.Zero,
            System.IO.Path.GetDirectoryName(executablePath),
            ref startup,
            out process
        );
        if (!started)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        var watchdogReady = new ManualResetEventSlim(false);
        var watchdog = new Thread(() =>
        {
            watchdogReady.Set();
            while (true)
            {
                try
                {
                    using (var target = Process.GetProcessById((int)process.dwProcessId))
                    {
                        HideProcessWindows(process.dwProcessId);
                        if (target.HasExited) break;
                    }
                }
                catch
                {
                    break;
                }
                Thread.Sleep(20);
            }
        });
        watchdog.IsBackground = true;
        watchdog.Start();
        if (!watchdogReady.Wait(5000))
        {
            throw new InvalidOperationException("Hidden watchdog did not become ready");
        }
        HideProcessWindows(process.dwProcessId);
        if (ResumeThread(process.hThread) == UInt32.MaxValue)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        Console.WriteLine("MVUAD_HIDDEN_WATCHDOG_READY=" + process.dwProcessId);
        Console.Out.Flush();

        try
        {
            using (var target = Process.GetProcessById((int)process.dwProcessId))
            {
                target.WaitForExit();
            }
        }
        finally
        {
            CloseHandle(process.hThread);
            CloseHandle(process.hProcess);
        }
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
[MvuadSilentLauncher]::Run((Resolve-Path -LiteralPath $ExecutablePath).Path)
