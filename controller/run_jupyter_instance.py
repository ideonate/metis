import json
import sys, os
import threading


stdoutlock = threading.Lock()


def read_stdin(stdoutlock, app):
    while 1:
        l = sys.stdin.readline()
        try:
            d = json.loads(l)
            with stdoutlock:
                print(json.dumps({'read_stdin_received':l}))
                sys.stdout.flush()
            if d['cmd'] == 'stop':
                app.stop()
        except json.JSONDecodeError as jde:
            with stdoutlock:
                print(json.dumps({'decodeerr':str(jde)}))
                sys.stdout.flush()


# Set PYTHONPATH so kernel_launcher can run in the right env
os.environ['PYTHONPATH'] = os.pathsep.join(sys.path)

# Init the Jupyter app

kwargs = {}
argv = ['--no-browser']

jupyterlab = False
if len(sys.argv) > 1:
    jupyterlab = sys.argv[1] == 'lab'

if jupyterlab:
    from jupyterlab.labapp import LabApp
    app = LabApp.instance(**kwargs)
else:
    from notebook.notebookapp import NotebookApp
    app = NotebookApp.instance(**kwargs)

# import logging
# app.log_level = logging.DEBUG

app.initialize(argv)

with stdoutlock:
    print(json.dumps({'sys.path': sys.path}))
    print(json.dumps({'sys.executable': sys.executable}))
    print(json.dumps({'os.environ': dict(os.environ)}))

    print(json.dumps({'server_info': app.server_info()}))
    sys.stdout.flush()

inthread = threading.Thread(target=read_stdin, args=(stdoutlock, app,))
inthread.daemon = True
inthread.start()

app.start()

with stdoutlock:
    print(json.dumps({'cmd':'stopped'}))
    sys.stdout.flush()

