#!/bin/bash

# Expect $1 is a virtualenvwrapper name
# Expect $2 is the homedir
# Expect $3 is the port

source ~/.bash_profile

if [ "$1" != "" ]; then
  workon "$1"
fi

if [ "$3" != "" ]; then
  jupyter notebook stop "$3"
fi
