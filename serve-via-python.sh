#!/bin/sh
cd www
start "http://localhost:20728"
python -m http.server 20728