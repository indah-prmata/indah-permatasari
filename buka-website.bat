@echo off
rem Buka website secara lokal (perlu Python). Tutup jendela ini untuk mematikan server.
cd /d "%~dp0"
start "" http://127.0.0.1:8137
python -m http.server 8137 --bind 127.0.0.1
