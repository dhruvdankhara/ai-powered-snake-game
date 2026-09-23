@echo off
title AI-Powered Snake Game with Laya LLM
echo ========================================================
echo   Starting AI-Powered Snake Game with Laya Decision Engine
echo ========================================================
echo.

where uv >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using Astral uv environment...
    uv run python main.py
) else (
    echo Using Python directly...
    python main.py
)

pause
