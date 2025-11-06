# test_sender.py
# Spawns the native host as a subprocess, sends one properly framed message,
# reads and prints the framed response.

import subprocess, struct, json, sys, os

HOST_PY = os.path.join(os.path.dirname(__file__), "voicetype_host.py")
PY = "python"  # change to full path to python.exe if needed

proc = subprocess.Popen([PY, HOST_PY], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def send(obj):
    b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    header = struct.pack('<I', len(b))
    proc.stdin.write(header + b)
    proc.stdin.flush()

def recv():
    # read 4-byte header
    raw = proc.stdout.read(4)
    if not raw or len(raw) < 4:
        return None
    length = struct.unpack('<I', raw)[0]
    data = proc.stdout.read(length)
    return json.loads(data.decode('utf-8'))

# send a test tone request
req = { "requestId": "test-1", "cmd": "tone", "text": "I am happy you cannot come", "tone": "casual", "rephrase": True }
print("Sending:", req)
send(req)
resp = recv()
print("Response:", resp)

# print any stderr from the host (helpful)
stderr = proc.stderr.read().decode('utf-8')
if stderr:
    print("HOST STDERR:\n", stderr, file=sys.stderr)

proc.terminate()
