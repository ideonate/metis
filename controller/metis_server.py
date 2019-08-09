#!/usr/bin/env python3

# To run Chrome showing logs
# /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-logging --v=1

import struct
import sys
import threading
import queue
import json
#try:
#    import tkinter
#    from tkinter import messagebox
#except ImportError:
#    tkinter = None

tkinter = None

import subprocess

uidtojqueues = {};

fromjqueue = queue.Queue()

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


def jpipe_run(req, fromjqueue, q):
    # 0 = loading, 1 = stopped, 2 = launching server, 3 = running, 4 = stopping
    uid = req['uid']
    jpipe = None

    if q:
        q.put('Starting jpipe in thread for uid {}'.format(uid))

    try:
        virtualenv = req['virtualenv']
        homedir = req['homedir']
        jpipe = subprocess.Popen(['./run_jupyter.sh', virtualenv, homedir], stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=1, text=True, shell=False)

    except Exception as e:
        if q:
            q.put(str(e))
        fromjqueue.put({'uid': uid, 'status': 1, 'msg': 'Failed jpipe: '+str(e)})
        sys.exit(0)

    fromjqueue.put({'uid': uid, 'msg': 'Started jpipe'})

    if q:
        q.put('Started jpipe in thread: pyversion '+sys.version)

    while jpipe.poll() is None:

        try:
            # outs, errs = jpipe.communicate(None, timeout=1)
            outs = jpipe.stdout.readline()

            if q:
                q.put('outs: ' + outs) #.decode('utf-8'))
                #q.put('errs: ' + errs) #.decode('utf-8'))

            try:
                d = json.loads(outs)

                if 'server_info' in d:
                    fromjqueue.put({'uid': uid, 'status': 3, 'server_info': d['server_info']})

            except json.JSONDecodeError as jde:
                if q:
                    q.put(str(jde))
                fromjqueue.put({'uid': uid, 'status': 4, 'msg': 'JSON decode error: '+outs})

        except Exception as e:
            if q:
                q.put(str(e))
            fromjqueue.put({'uid': uid, 'status': 4, 'msg': str(e)})

    jpipe = None
    if q:
        q.put('Finished jpipe')
    fromjqueue.put({'uid': uid, 'status': 1, 'msg': 'STOPPED jpipe'})

def jport_stop(req, fromjqueue, q):
    try:
        uid = req['uid']
        port = req['server_info']['port']
        virtualenv = req['virtualenv']
        homedir = req['homedir']

        if q:
            q.put('Stopping jport for uid {} port {}'.format(uid, port))

        fromjqueue.put({'uid': uid, 'msg': 'Stopping port'})
        p = subprocess.run(['./stop_jupyter.sh', virtualenv, homedir, str(port)], text=True, shell=False, capture_output=True)
        fromjqueue.put({'uid': uid, 'msg': p.stderr + p.stdout})

    except Exception as e:
        if q:
            q.put(str(e))
        fromjqueue.put({'uid': uid, 'status': 1, 'msg': 'Failed jport: '+str(e)})
        sys.exit(0)


def start_jpipe(req, fromjqueue, q):
    thread = threading.Thread(target=jpipe_run, args=(req, fromjqueue, q,))
    thread.daemon = True
    thread.start()

def stop_jport(req, fromjqueue, q):
    thread = threading.Thread(target=jport_stop, args=(req, fromjqueue, q,))
    thread.daemon = True
    thread.start()

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
            pass #send_message('{"echo": %s}' % text)

        req = json.loads(text)

        uid = req['uid'] # TODO check exists

        if uid in uidtojqueues: # thread-safe because we only read input in this thread

            if req['cmd'] == 'stop': # stop is initiated through another process
                stop_jport(req, fromjqueue, q)

            else: # Don't currently have any way to catch these messages anyway - only start!
                tojqueue = uidtojqueues[uid]
                tojqueue.put(req)

        else:
            uidtojqueues[uid] = queue.Queue()
            if req['cmd'] == 'start':
                start_jpipe(req, fromjqueue, q)

            if q:
                q.put('Starting pipe')

# Thread to read aggregated messages from fromjqueue and send back to chrome
def out_thread_func(fromjqueue, q):

    while 1:
        msg = fromjqueue.get() # Will wait
        send_message(json.dumps(msg))

        if q:
            q.put('Replied with msg: '+json.dumps(msg))

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
    q = None
    if not tkinter:
        send_message('"tkinter python module wasn\'t found. Running in headless ' +
                     'mode. Please consider installing tkinter."')
        #read_thread_func(None)
        #sys.exit(0)

    else:
        q = queue.Queue()
        main_window = NativeMessagingWindow(q)
        main_window.master.title('Native Messaging Example')

    outthread = threading.Thread(target=out_thread_func, args=(fromjqueue, q,))
    outthread.daemon = True
    outthread.start()

    inthread = threading.Thread(target=read_thread_func, args=(q,))
    if tkinter:
        inthread.daemon = True
    inthread.start()

    if tkinter:
        main_window.mainloop()


if __name__ == '__main__':
    Main()
