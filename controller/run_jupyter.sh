#!/bin/bash

# Expect $1 is a virtualenvwrapper name
# Except $2 is the homedir

source ~/.bash_profile

#workon jupyterdev-venv
#python3 ./run_jupyter_instance.py
#exit

if [ "$1" != "" ]; then
  workon "$1"
fi

rji='.'

if [ "$2" != "" ]; then
  rji=`pwd`
  cd "$2"
fi

rji="${rji}/run_jupyter_instance.py"

#jupyter notebook
python3 "$rji"
