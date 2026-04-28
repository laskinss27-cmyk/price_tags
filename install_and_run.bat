@echo off
chcp 65001 >nul
echo =========================================
echo  Генератор ценников — dom-automation.ru
echo =========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Python не найден.
    echo Скачайте Python с https://python.org и установите.
    pause
    exit /b 1
)

echo Устанавливаю зависимости...
pip install -r requirements.txt --quiet

echo.
echo Запускаю программу...
python price_tag_app.py

pause
