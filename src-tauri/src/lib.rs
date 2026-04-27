#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_window_state::StateFlags;

    // Persist window position + maximized/fullscreen/visible/decoration state,
    // but NOT size. Size is always taken from tauri.conf.json on launch so the
    // widget always opens at the canonical layout dimensions; users can
    // drag-resize within a session but it won't persist on next boot.
    let window_state_flags =
        StateFlags::POSITION
            | StateFlags::MAXIMIZED
            | StateFlags::FULLSCREEN
            | StateFlags::VISIBLE
            | StateFlags::DECORATIONS;

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags)
                .build(),
        )
        .plugin(tauri_plugin_oauth::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
