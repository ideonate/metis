from notebook.notebookapp import NotebookApp
import json
import sys

kwargs = {}
argv = ['--no-browser']

app = NotebookApp.instance(**kwargs)
app.initialize(argv)

print(json.dumps({'server_info': app.server_info()}))
sys.stdout.flush()

app.start()

print('{"cmd":"stopped"}')
sys.stdout.flush()

