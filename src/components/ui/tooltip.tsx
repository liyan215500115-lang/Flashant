import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

function TooltipProvider({ children, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>
}

function Tooltip({ children, ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
}

function TooltipTrigger({ children, ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger {...props}>{children}</TooltipPrimitive.Trigger>
}

function TooltipContent({ children, ...props }: TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner>
        <TooltipPrimitive.Popup
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95"
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
