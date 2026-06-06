import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

function DropdownMenu({ children, ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props}>{children}</MenuPrimitive.Root>
}

function DropdownMenuTrigger({
  children,
  className,
  ...props
}: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </MenuPrimitive.Trigger>
  )
}

function DropdownMenuContent({
  children,
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  ...props
}: MenuPrimitive.Popup.Props & {
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-[closed]:scale-95 data-[closed]:opacity-0 data-[open]:scale-100 data-[open]:opacity-100",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  children,
  className,
  ...props
}: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.Item>
  )
}

function DropdownMenuSeparator() {
  return <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
