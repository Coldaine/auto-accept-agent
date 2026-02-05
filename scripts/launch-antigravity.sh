#!/bin/bash
# launch-antigravity.sh
# Launches Antigravity (or Cursor) with Chrome DevTools Protocol (CDP) enabled
# This is required for Auto Accept to work
#
# Usage:
#   ./launch-antigravity.sh              # Launches Antigravity
#   ./launch-antigravity.sh cursor       # Launches Cursor instead
#   ./launch-antigravity.sh code         # Launches VS Code instead
#
# Port: 9000 (default CDP port for Auto Accept)

set -e

IDE="${1:-antigravity}"
PORT="${2:-9000}"

# Normalize IDE name
IDE_LOWER=$(echo "$IDE" | tr '[:upper:]' '[:lower:]')
case "$IDE_LOWER" in
    antigravity)
        IDE_NAME="Antigravity"
        ;;
    cursor)
        IDE_NAME="Cursor"
        ;;
    code|vscode)
        IDE_NAME="Code"
        ;;
    *)
        echo "Unknown IDE: $IDE"
        echo "Supported: antigravity, cursor, code"
        exit 1
        ;;
esac

echo "============================================"
echo "  Auto Accept - CDP Launcher"
echo "============================================"
echo ""
echo "IDE:  $IDE_NAME"
echo "CDP Port: $PORT"
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Darwin)
        # macOS
        APP_PATH="/Applications/${IDE_NAME}.app"
        if [ ! -d "$APP_PATH" ]; then
            # Try user Applications folder
            APP_PATH="$HOME/Applications/${IDE_NAME}.app"
        fi

        if [ ! -d "$APP_PATH" ]; then
            echo "ERROR: Could not find $IDE_NAME.app"
            echo "Searched:"
            echo "  - /Applications/${IDE_NAME}.app"
            echo "  - $HOME/Applications/${IDE_NAME}.app"
            exit 1
        fi

        echo "Path: $APP_PATH"
        echo ""

        # Check if already running
        if pgrep -x "$IDE_NAME" > /dev/null 2>&1; then
            echo "WARNING: $IDE_NAME is already running."
            echo "For CDP to work, you should close all $IDE_NAME windows first."
            echo ""
            read -p "Close existing instances and continue? (y/N) " response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo "Closing $IDE_NAME..."
                pkill -x "$IDE_NAME" || true
                sleep 2
            else
                echo "Aborted. Please close $IDE_NAME manually and try again."
                exit 1
            fi
        fi

        echo "Launching $IDE_NAME with CDP enabled..."
        open -n -a "$IDE_NAME" --args \
            --remote-debugging-port="$PORT" \
            --disable-gpu-driver-bug-workarounds \
            --ignore-gpu-blacklist
        ;;

    Linux)
        # Linux - try to find the binary
        POSSIBLE_PATHS=(
            "/usr/bin/${IDE_LOWER}"
            "/usr/local/bin/${IDE_LOWER}"
            "$HOME/.local/bin/${IDE_LOWER}"
            "/opt/${IDE_NAME}/${IDE_LOWER}"
            "/snap/bin/${IDE_LOWER}"
        )

        EXE_PATH=""
        for path in "${POSSIBLE_PATHS[@]}"; do
            if [ -x "$path" ]; then
                EXE_PATH="$path"
                break
            fi
        done

        # Also try 'which'
        if [ -z "$EXE_PATH" ]; then
            EXE_PATH=$(which "$IDE_LOWER" 2>/dev/null || true)
        fi

        if [ -z "$EXE_PATH" ]; then
            echo "ERROR: Could not find $IDE_NAME binary"
            echo "Searched:"
            for path in "${POSSIBLE_PATHS[@]}"; do
                echo "  - $path"
            done
            exit 1
        fi

        echo "Path: $EXE_PATH"
        echo ""

        # Check if already running
        if pgrep -x "$IDE_LOWER" > /dev/null 2>&1; then
            echo "WARNING: $IDE_NAME is already running."
            echo "For CDP to work, you should close all $IDE_NAME windows first."
            echo ""
            read -p "Close existing instances and continue? (y/N) " response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo "Closing $IDE_NAME..."
                pkill -x "$IDE_LOWER" || true
                sleep 2
            else
                echo "Aborted. Please close $IDE_NAME manually and try again."
                exit 1
            fi
        fi

        echo "Launching $IDE_NAME with CDP enabled..."
        nohup "$EXE_PATH" \
            --remote-debugging-port="$PORT" \
            --disable-gpu-driver-bug-workarounds \
            --ignore-gpu-blacklist \
            > /dev/null 2>&1 &
        ;;

    *)
        echo "ERROR: Unsupported OS: $OS"
        exit 1
        ;;
esac

echo ""
echo "SUCCESS! $IDE_NAME launched with CDP on port $PORT"
echo ""
echo "Next steps:"
echo "  1. Wait for $IDE_NAME to fully load"
echo "  2. Click the Auto Accept status bar item to enable"
echo "  3. You should see 'Personal Accept: ACTIVE'"
echo ""
echo "To verify CDP is working, run:"
echo "  curl -s http://127.0.0.1:$PORT/json/list | head -20"
