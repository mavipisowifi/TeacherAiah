; ============================================================================
; TEACHERaiah — custom NSIS installer include
;
; electron-builder automatically includes build/installer.nsh (this file) when
; building the NSIS installer. The customHeader macro runs in the script header,
; BEFORE the MUI license page is inserted, so defining MUI_LICENSEPAGE_CHECKBOX
; here converts the Terms of Service & Privacy Policy page from the default
; "I accept / I don't accept" radio buttons into a single checkbox that the user
; must TICK before the Next / Install button becomes enabled.
;
; The license text itself comes from build/eula.txt (wired via build.nsis.license
; in package.json).
; ============================================================================

!macro customHeader
  !define MUI_LICENSEPAGE_CHECKBOX
  !define MUI_LICENSEPAGE_CHECKBOX_TEXT "I have read and agree to the Terms of Service and Privacy Policy"
!macroend
