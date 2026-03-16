@echo off
echo Building ChakrasPlayer Executable...
py -m pip install pyinstaller
py -m PyInstaller ChakrasPlayer.spec --noconfirm

if not exist "Builds" mkdir "Builds"

:: Robust timestamp for Windows (Independent of locale)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%_%datetime:~8,2%%datetime:~10,2%%datetime:~12,2%

copy dist\ChakrasPlayer.exe "Builds\ChakrasPlayer_%TIMESTAMP%.exe"

echo.
echo Build finished successfully!
echo Binary: dist\ChakrasPlayer.exe
echo Versioned backup: Builds\ChakrasPlayer_%TIMESTAMP%.exe
echo.
pause
