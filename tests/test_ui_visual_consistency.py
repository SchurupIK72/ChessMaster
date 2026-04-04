from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_auth_page_keeps_single_brand_title_and_readable_inputs():
    auth_text = read("client/src/pages/auth.tsx")

    assert 'const authInputClassName =' in auth_text
    assert "text-neutral-950" in auth_text
    assert "placeholder:text-neutral-500" in auth_text
    assert auth_text.count("className={authInputClassName}") == 6
    assert 'className="text-4xl font-bold text-white"' in auth_text
    assert "rounded-full border border-white/15 bg-white/5" not in auth_text


def test_game_status_removes_change_rules_button_and_elapsed_time_row():
    status_text = read("client/src/components/game-status.tsx")

    assert 'Change Rules' not in status_text
    assert 'Spectator Mode' not in status_text
    assert 'Game Time:' not in status_text
    assert "elapsedTime:" not in status_text
    assert "onChangeRules:" not in status_text
    assert "canChangeRules?" not in status_text
    assert "Time Control:" in status_text


def test_game_page_exposes_settings_placeholder_and_clean_controls():
    page_text = read("client/src/pages/chess-game.tsx")
    placeholder_text = read("client/src/components/game-settings-placeholder.tsx")

    assert 'import GameSettingsPlaceholder from "@/components/game-settings-placeholder";' in page_text
    assert 'const [showSettingsModal, setShowSettingsModal] = useState(false);' in page_text
    assert 'aria-label="Открыть настройки"' in page_text
    assert 'onClick={() => setShowSettingsModal(true)}' in page_text
    assert '<GameSettingsPlaceholder' in page_text
    assert 'open={showSettingsModal}' in page_text
    assert 'Redo' not in page_text
    assert 'className="border-white/15 bg-white text-black hover:bg-neutral-200"' in page_text
    assert "Undo" in page_text

    assert "Настройки" in placeholder_text
    assert "Вернуться к партии" in placeholder_text
    assert "Будет доступно в следующей итерации." in placeholder_text
    assert "<Dialog" in placeholder_text
