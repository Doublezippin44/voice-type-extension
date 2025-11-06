#!/usr/bin/env python3
# voicetype_host.py (robust version)
import sys
import struct
import json
import re
import traceback

# safety limit for message size (32 MB is Python internal read limit; pick smaller)
MAX_MSG_BYTES = 8 * 1024 * 1024  # 8 MB

def read_message():
    """
    Read one native messaging message from stdin.
    Native messaging uses 4-byte little-endian unsigned int length header.
    Returns parsed JSON object or None if EOF or invalid input.
    """
    try:
        raw_len = sys.stdin.buffer.read(4)
    except Exception as e:
        print(f"read error (header): {e}", file=sys.stderr)
        return None

    if not raw_len or len(raw_len) < 4:
        # no data (normal when run interactively); return None to indicate EOF/no-msg
        return None

    # unpack little-endian unsigned int
    try:
        msg_len = struct.unpack('<I', raw_len)[0]
    except Exception as e:
        print(f"read error (unpack header): {e}", file=sys.stderr)
        return None

    # sanity check on length
    if msg_len <= 0 or msg_len > MAX_MSG_BYTES:
        print(f"Invalid message length: {msg_len} (max {MAX_MSG_BYTES})", file=sys.stderr)
        # consume and discard if possible to avoid blocking (but usually can't)
        try:
            _ = sys.stdin.buffer.read(msg_len)
        except Exception:
            pass
        return None

    try:
        raw = sys.stdin.buffer.read(msg_len)
        if not raw or len(raw) < msg_len:
            print("Incomplete message payload", file=sys.stderr)
            return None
        return json.loads(raw.decode('utf-8'))
    except Exception as e:
        print(f"read_message error: {e}", file=sys.stderr)
        return None

def send_message(obj):
    try:
        b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('<I', len(b)))
        sys.stdout.buffer.write(b)
        sys.stdout.buffer.flush()
    except Exception as e:
        print(f"send_message error: {e}", file=sys.stderr)

def tone_adjust(text, tone):
    t = text.strip()
    swaps = {
        'casual': [
            (r'\bdo not\b', "don't"),
            (r'\bcannot\b', "can't"),
            (r'\bI am\b', "I'm"),
            (r'\bthank you\b', "thanks"),
            (r'\bok\b', "ok")
        ],
        'friendly': [
            (r'\bdo not\b', "don't"),
            (r'\bcannot\b', "can't"),
            (r'\bI am\b', "I'm"),
            (r'\bregards\b', "best"),
            (r'\bsincerely\b', "cheers")
        ],
        'formal': [
            (r"\bI'm\b", "I am"),
            (r"\bcan't\b", "cannot"),
            (r"\bdon't\b", "do not"),
            (r'\bthanks\b', "thank you"),
            (r'\bok\b', "okay")
        ]
    }
    if tone in swaps:
        for pat, rep in swaps[tone]:
            t = re.sub(pat, rep, t, flags=re.IGNORECASE)
    t = re.sub(r'([.?!])\s*', r'\1 ', t).strip()
    if tone == 'friendly' and len(t) < 60 and not re.match(r'^(hi|hello|hey)\b', t, flags=re.IGNORECASE):
        t = 'Hi — ' + t
    if tone == 'formal':
        t = re.sub(r'\bhey\b', 'Hello', t, flags=re.IGNORECASE)
    return t

def main():
    print("voicetype_host starting", file=sys.stderr)
    try:
        while True:
            msg = read_message()
            if msg is None:
                # No message available now. When run manually this returns None and we continue
                # waiting a bit to avoid a tight spin loop. When Chrome connects it'll send a message.
                import time
                time.sleep(0.1)
                continue

            # Expect: { requestId: "...", cmd: "tone", text: "...", tone: "...", rephrase: true/false }
            request_id = msg.get('requestId')
            cmd = msg.get('cmd')
            if cmd == 'tone':
                text = msg.get('text', '')
                tone = msg.get('tone', 'none')
                rephrase = msg.get('rephrase', True)
                result = text
                try:
                    if rephrase and tone and tone != 'none':
                        result = tone_adjust(text, tone)
                except Exception:
                    result = text
                send_message({'requestId': request_id, 'ok': True, 'result': result, 'original': text})
            else:
                send_message({'requestId': request_id, 'ok': False, 'error': 'unknown_cmd'})
    except KeyboardInterrupt:
        print("voicetype_host exiting (KeyboardInterrupt)", file=sys.stderr)
    except Exception:
        traceback.print_exc(file=sys.stderr)

if __name__ == '__main__':
    main()
