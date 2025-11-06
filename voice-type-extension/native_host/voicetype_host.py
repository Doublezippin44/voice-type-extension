# voicetype_host.py
# Native Messaging host for Chrome to control a local system-wide voice-typing loop.
# It listens for length-prefixed JSON messages from Chrome and responds similarly.
#
# Protocol:
#  Chrome -> host: {"cmd":"start"} or {"cmd":"stop"}
#  Host -> Chrome: {"ok": true, "status": "started"} etc.

import sys, struct, json, threading, time
import speech_recognition as sr
import pyautogui

# ---- configuration ----
PHRASE_TIME_LIMIT = 6  # seconds per listen
# ------------------------

stop_event = threading.Event()
listening_thread = None

def write_message(obj):
    b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(b)))
    sys.stdout.buffer.write(b)
    sys.stdout.buffer.flush()

def read_message():
    raw_len = sys.stdin.buffer.read(4)
    if not raw_len or len(raw_len) < 4:
        return None
    length = struct.unpack('<I', raw_len)[0]
    if length == 0:
        return None
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode('utf-8'))

def type_text(text):
    # types text into whichever UI element is focused
    pyautogui.write(text, interval=0.02)
    pyautogui.press('space')

def listen_loop():
    r = sr.Recognizer()
    mic = sr.Microphone()
    with mic as source:
        r.adjust_for_ambient_noise(source, duration=1.0)
    while not stop_event.is_set():
        with mic as source:
            try:
                audio = r.listen(source, phrase_time_limit=PHRASE_TIME_LIMIT)
            except Exception as e:
                # micro error or interrupted
                continue
        try:
            text = r.recognize_google(audio)  # online Google recognizer
        except sr.UnknownValueError:
            continue
        except sr.RequestError:
            # network error — notify once and continue
            write_message({"ok": False, "error": "recognition_service_unavailable"})
            time.sleep(1)
            continue
        # type recognized text
        try:
            type_text(text)
            write_message({"ok": True, "event": "typed", "text": text})
        except Exception as e:
            write_message({"ok": False, "error": f"typing_failed:{e}"})

def start_listening():
    global listening_thread, stop_event
    if listening_thread and listening_thread.is_alive():
        return False
    stop_event.clear()
    listening_thread = threading.Thread(target=listen_loop, daemon=True)
    listening_thread.start()
    return True

def stop_listening():
    global listening_thread, stop_event
    stop_event.set()
    if listening_thread:
        listening_thread.join(timeout=1.0)
    listening_thread = None
    return True

def main():
    # announce ready (optional)
    write_message({"ok": True, "status": "host_ready"})
    while True:
        msg = read_message()
        if msg is None:
            # stdin closed, exit
            break
        cmd = msg.get("cmd") if isinstance(msg, dict) else None
        if cmd == "start":
            ok = start_listening()
            write_message({"ok": True, "status": "started" if ok else "already_started"})
        elif cmd == "stop":
            ok = stop_listening()
            write_message({"ok": True, "status": "stopped"})
        elif cmd == "ping":
            write_message({"ok": True, "status": "pong"})
        else:
            write_message({"ok": False, "error": "unknown_cmd", "received": msg})

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # crash message for debugging
        try:
            write_message({"ok": False, "error": f"host_crashed: {e}"})
        except:
            pass
        raise
