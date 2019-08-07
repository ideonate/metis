#!/usr/bin/env python3

# To run Chrome showing logs
# /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-logging --v=1

import struct
import sys
import threading
import queue
try:
    import tkinter
    from tkinter import messagebox
except ImportError:
    tkinter = None

import subprocess

# On Windows, the default I/O mode is O_TEXT. Set this to O_BINARY
# to avoid unwanted modifications of the input/output streams.
if sys.platform == "win32":
    import os, msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

# Helper function that sends a message to the webapp.
def send_message(message):
    # Write message size.
    sys.stdout.buffer.write(struct.pack('I', len(message)))
    # Write the message itself.
    sys.stdout.buffer.write(bytes(message,"utf-8"))
    sys.stdout.buffer.flush()

jpipe = None

def jpipe_run(q):
    if q:
        q.put('Starting jpipe in thread')
    try:
        jpipe = subprocess.Popen(['./run_jupyter.sh'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=1, text=True, shell=True)
    except Exception as e:
        if q:
            q.put(str(e))
        sys.exit(0)

    if q:
        q.put('Started jpipe in thread: pyversion '+sys.version)

    while jpipe.poll() is None:

        try:
            if q:
                q.put('Polled jpipe')

            #outs, errs = jpipe.communicate(None, timeout=1)
            errs = jpipe.stderr.readline()

            if q:
                q.put('Result')
                #q.put('outs: ' + outs) #.decode('utf-8'))
                q.put('errs: ' + errs) #.decode('utf-8'))

        except Exception as e:
            if q:
                q.put(str(e))

    jpipe = None
    if q:
        q.put('Finished jpipe')

def start_jpipe(q):
    thread = threading.Thread(target=jpipe_run, args=(q,))
    thread.daemon = True
    thread.start()
    #jpipe_run(q)

# Thread that reads messages from the webapp.
def read_thread_func(q):
    message_number = 0

    while 1:
        # Read the message length (first 4 bytes).
        text_length_bytes = sys.stdin.buffer.read(4)
        if len(text_length_bytes) == 0:
            if q:
                q.put(None)
            sys.exit(0)
        # Unpack message length as 4 byte integer.
        text_length = struct.unpack('i', text_length_bytes)[0]
        # Read the text (JSON object) of the message.
        text = sys.stdin.buffer.read(text_length).decode('utf-8')
        if q:
            q.put(text)
        else:
            # In headless mode just send an echo message back.
            send_message('{"echo": %s}' % text)

        if text == '{"text":"start"}':
            jtext = 'Starting pipe'
            start_jpipe(q)
        else:
            jtext = 'NOT Starting pipe'

        if q:
            q.put(jtext)


if tkinter:
    class NativeMessagingWindow(tkinter.Frame):

        def __init__(self, q):
            self.q = q
            tkinter.Frame.__init__(self, width=400, height=500)
            self.pack()
            self.text = tkinter.Text(self)
            self.text.grid(row=0, column=0, padx=10, pady=10, columnspan=2)
            self.text.config(state=tkinter.DISABLED, height=20, width=90)
            self.messageContent = tkinter.StringVar()
            self.sendEntry = tkinter.Entry(self, textvariable=self.messageContent)
            self.sendEntry.grid(row=1, column=0, padx=10, pady=10)
            self.sendButton = tkinter.Button(self, text="Send", fg="red", command=self.onSend)
            self.sendButton.grid(row=1, column=1, padx=10, pady=10)
            self.after(100, self.processMessages)

        def processMessages(self):
            while not self.q.empty():
                message = self.q.get_nowait()
                if message == None:
                    self.quit()
                    return
                self.log("Received %s" % message)
            self.after(100, self.processMessages)

        def onSend(self):
            text = '{"text": "' + self.messageContent.get() + '"}'
            self.log('Sending %s' % text)
            try:
                send_message(text)
            except IOError:
                messagebox.showinfo('Native Messaging Example',
                                      'Failed to send message.')
                sys.exit(1)
        def log(self, message):

            self.text.config(state=tkinter.NORMAL)
            self.text.insert(tkinter.END, message + "\n")
            self.text.config(state=tkinter.DISABLED)
def Main():
    if not tkinter:
        send_message('"tkinter python module wasn\'t found. Running in headless ' +
                     'mode. Please consider installing tkinter."')
        read_thread_func(None)
        sys.exit(0)
    q = queue.Queue()
    main_window = NativeMessagingWindow(q)
    main_window.master.title('Native Messaging Example')
    thread = threading.Thread(target=read_thread_func, args=(q,))
    thread.daemon = True
    thread.start()
    main_window.mainloop()
    sys.exit(0)

if __name__ == '__main__':
    Main()
