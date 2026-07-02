@echo off
SET APP_DIR=C:\egbp\frontend\
SET NODE=%APP_DIR%node_portable\node.exe

"%NODE%" "%APP_DIR%node_modules\serve\build\main.js" "%APP_DIR%dist" -l 3000 --single
pause