@echo off
echo Starting frontend development server...

:: Change directory to the frontend folder
cd frontend

:: Check if cd was successful
if %errorlevel% neq 0 (
    echo Error: Could not find the 'frontend' directory.
    pause
    exit /b %errorlevel%
)

:: Install npm dependencies
echo Running npm install...
call npm install

:: Start the development server
echo Running npm run dev...
call npm run dev

echo Script finished.
pause