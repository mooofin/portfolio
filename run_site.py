#!/usr/bin/env python3
"""
Website server runner with automatic port selection
Usage: python3 run_site.py
"""

import http.server
import socketserver
import os
import sys
import webbrowser
from pathlib import Path

# Try ports in order
PORTS = [8000, 8001, 8080, 3000, 5000]
DIRECTORY = Path(__file__).parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)


def find_free_port():
    """Find first available port from the list"""
    for port in PORTS:
        try:
            import socket

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(("localhost", port))
            sock.close()
            if result != 0:  # Port is free
                return port
        except:
            pass
    return 8000  # Default fallback


def main():
    port = find_free_port()
    os.chdir(DIRECTORY)

    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            url = f"http://localhost:{port}"
            print(f"╔══════════════════════════════════════╗")
            print(f"║  🌐 Website running at:              ║")
            print(f"║  {url:<36}  ║")
            print(f"╚══════════════════════════════════════╝")
            print(f"\nPress Ctrl+C to stop\n")

            # Open browser
            webbrowser.open(url)

            # Serve forever
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✓ Server stopped")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
