from notebook.notebookapp import NotebookApp

kwargs = {}
argv = ['--no-browser']

app = NotebookApp.instance(**kwargs)
app.initialize(argv)

print(app.server_info())

app.start()

print('{"cmd":"stopped"}')

