import { createContext, useContext } from 'react'

// Lightweight app-level UI context: fire toasts and open the print/PDF preview
// from any panel without prop-drilling.
export const UIContext = createContext({
  showToast: () => {},
  openPrint: () => {},
})

export function useUI() {
  return useContext(UIContext)
}
