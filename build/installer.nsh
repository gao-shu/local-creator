; local-creator NSIS custom macros
; UX:
; - First install: user can change install directory (allowToChangeInstallationDirectory)
; - Upgrade: reuse old directory (electron-builder skips DIRECTORY page via skipPageIfUpdated)
; - Always current-user install; hide "install for whom" page

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
  StrCpy $isForceMachineInstall "0"
!macroend

!macro customCheckAppRunning
  ${if} ${isUpdated}
    DetailPrint "Waiting for ${PRODUCT_NAME} to exit..."
    Sleep 3000
  ${endif}

  nsExec::ExecToLog 'cmd /c taskkill /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1500
  nsExec::ExecToLog 'cmd /c taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1000
!macroend
