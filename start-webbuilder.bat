@echo off
echo Starting WebBuilder Backend...
cd webbuilder-main
uvicorn main:app --reload --port 8000
