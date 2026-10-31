"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    // Sonner (2.0.x), al salir el foco de los avisos, lo devuelve SIEMPRE al
    // elemento de antes: con Tab eso es una trampa de teclado (no se puede
    // pasar del aviso a nada más). Su onBlur corre antes que este, así que
    // aquí se respeta adónde iba el Tab; si iba fuera de la página, se suelta.
    <div
      className="contents"
      onBlur={(e) => {
        const destino = e.relatedTarget
        if (destino instanceof HTMLElement) {
          if (!e.currentTarget.contains(destino)) destino.focus()
        } else if (e.target.isConnected) {
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }}
    >
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
        {...props}
      />
    </div>
  )
}

export { Toaster }
